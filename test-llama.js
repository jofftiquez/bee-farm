/**
 * Simple test script for the Llama integration
 * Run with: node test-llama.js
 */

const llmIntegration = require('./lib/llm-integration');
const logger = require('./lib/logger');
const axios = require('axios');
const fs = require('fs');

// Add sample test data 
const testProfile = {
  name: 'Alex',
  age: 28,
  bio: 'I love hiking, reading, and exploring new restaurants. Looking for someone with similar interests who enjoys outdoor activities.',
  interests: ['hiking', 'reading', 'food', 'travel', 'outdoors']
};

const testPrefs = {
  interests: ['hiking', 'reading', 'nature', 'camping'],
  avoidKeywords: ['partying', 'clubbing', 'smoking']
};

// Define all possible endpoints to test
const ENDPOINTS_TO_TEST = [
    'http://127.0.0.1:11434/api/generate',
    'http://localhost:11434/api/generate',
    'http://127.0.0.1:11434/v1/chat/completions', 
    'http://localhost:11434/v1/chat/completions',
    'http://localhost:8000/api/generate'
];

/**
 * Test each endpoint with a simple prompt
 */
async function testAllEndpoints() {
  console.log('===== TESTING ALL LLAMA API ENDPOINTS =====');
  
  // Test each endpoint
  for (const endpoint of ENDPOINTS_TO_TEST) {
    console.log(`\n----- Testing endpoint: ${endpoint} -----`);
    
    try {
      // 1. Check if the endpoint is available
      const tagsEndpoint = endpoint.replace('/generate', '/tags').replace('/v1/chat/completions', '/tags');
      console.log(`Checking models at: ${tagsEndpoint}`);
      
      try {
        const tagsResponse = await axios.get(tagsEndpoint, { timeout: 5000 });
        console.log('Available models: ', tagsResponse.data.models ? tagsResponse.data.models.join(', ') : 'Unknown format');
        console.log('✅ Connection check: PASSED');
      } catch (e) {
        console.log(`❌ Connection check FAILED: ${e.message}`);
        console.log('Skipping further tests for this endpoint');
        continue;
      }
      
      // 2. Test with a simple prompt
      console.log('\nTesting simple prompt...');
      try {
        const simpleResult = await testSimplePrompt(endpoint);
        console.log(`✅ Simple prompt test: ${simpleResult.success ? 'PASSED' : 'FAILED'}`);
        if (simpleResult.response) {
          console.log(`Response: ${simpleResult.response.substring(0, 100)}...`);
        }
      } catch (e) {
        console.log(`❌ Simple prompt test FAILED: ${e.message}`);
      }
      
      // 3. Test with profile analysis
      console.log('\nTesting profile analysis...');
      try {
        const analysisResult = await testProfileAnalysis(endpoint);
        
        if (analysisResult.success) {
          console.log(`✅ Profile analysis test: PASSED`);
          console.log(`Score: ${analysisResult.score.toFixed(2)}`);
          console.log(`Response: ${analysisResult.fullResponse.substring(0, 100)}...`);
          
          // Save this endpoint as working for future reference
          console.log(`\n✅ Found working endpoint: ${endpoint}`);
          fs.writeFileSync('working_endpoint.txt', endpoint, 'utf8');
          console.log('Saved to working_endpoint.txt');
          
          // No need to test further endpoints
          console.log('\n===== TESTING COMPLETE - WORKING ENDPOINT FOUND =====');
          return { success: true, endpoint };
        } else {
          console.log(`❌ Profile analysis test FAILED: ${analysisResult.error}`);
        }
      } catch (e) {
        console.log(`❌ Profile analysis test FAILED: ${e.message}`);
      }
    } catch (error) {
      console.log(`❌ Error testing endpoint ${endpoint}: ${error.message}`);
    }
  }
  
  console.log('\n===== TESTING COMPLETE - NO WORKING ENDPOINT FOUND =====');
  return { success: false };
}

async function testSimplePrompt(endpoint) {
  logger.log(`Testing simple prompt with endpoint: ${endpoint}`, logger.LOG_LEVELS.INFO, 'TEST');
  
  try {
    // Simple prompt to test the endpoint
    const prompt = "Hello, how are you?";
    let response;
    
    if (endpoint.includes('/v1/chat/completions')) {
      // OpenAI-compatible format
      response = await axios.post(
        endpoint,
        {
          model: "llama3",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 20
        },
        { timeout: 10000 }
      );
      logger.log(`Response: ${JSON.stringify(response.data)}`, logger.LOG_LEVELS.DEBUG, 'TEST');
    } else {
      // Ollama format
      response = await axios.post(
        endpoint,
        {
          model: "llama3:latest",
          prompt: prompt,
          stream: false,
          temperature: 0.7,
          max_tokens: 20
        },
        { timeout: 10000 }
      );
      const generatedText = response.data.response || response.data.generated_text || '';
      logger.log(`Response: ${generatedText}`, logger.LOG_LEVELS.INFO, 'TEST');
    }
    
    return { success: true, response };
  } catch (error) {
    logger.log(`Error with endpoint ${endpoint}: ${error.message}`, logger.LOG_LEVELS.ERROR, 'TEST');
    return { success: false };
  }
}

/**
 * Test profile analysis with the Llama API
 * @param {string} endpoint The endpoint to test with
 * @returns {Object} Test result object with success boolean
 */
async function testProfileAnalysis(endpoint) {
  console.log('Testing profile analysis with Llama...');
  
  try {
    // Create a compatible prompt structure with the test data
    const prompt = generateTestPrompt(testProfile, testPrefs);
    
    console.log(`Sending analysis request to ${endpoint} with test profile`);
    console.log(`Prompt length: ${prompt.length} characters`);
    
    // Make the API request
    const response = await axios.post(endpoint, {
      model: 'llama3:latest',
      prompt: prompt,
      stream: false,
      temperature: 0.2,
      max_tokens: 150
    }, { timeout: 10000 }); // Increased timeout for longer request
    
    // Extract the text from the response
    const responseText = response.data.response || response.data.generated_text || '';
    
    if (!responseText) {
      console.log('Empty response from Llama API');
      return { success: false, error: 'Empty response' };
    }
    
    console.log('Response received successfully!');
    console.log(`Response length: ${responseText.length} characters`);
    
    // Extract the compatibility score
    const scoreMatch = responseText.match(/compatibility score:\s*(0\.\d+|1\.0|1)/i) || 
                       responseText.match(/score:\s*(0\.\d+|1\.0|1)/i) ||
                       responseText.match(/(0\.\d+|1\.0|1)/);
    
    let score = 0.5; // Default score
    
    if (scoreMatch && scoreMatch[1]) {
      score = parseFloat(scoreMatch[1]);
      console.log(`Extracted compatibility score: ${score}`);
    } else {
      console.log('Could not extract a score from response');
    }
    
    console.log(`Profile analysis score: ${score.toFixed(2)}`);
    console.log(`Full API response for debugging: ${responseText.substring(0, 200)}...`);
    
    return { 
      success: true, 
      score, 
      fullResponse: responseText 
    };
  } catch (error) {
    console.log(`Error in profile analysis: ${error.message}`);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Generate a test prompt for the Llama API
 * @param {Object} profileData Test profile data
 * @param {Object} userPrefs Test user preferences
 * @returns {string} Formatted prompt for the Llama API
 */
function generateTestPrompt(profileData, userPrefs) {
  // Extract user interests
  const userInterests = userPrefs.interests || [];
  const userAvoidKeywords = userPrefs.avoidKeywords || [];
  
  // Extract profile information
  const profileName = profileData.name || 'Unknown';
  const profileAge = profileData.age || 'Unknown';
  const profileBio = profileData.bio || '';
  const profileInterests = profileData.interests || [];
  
  // Create a simple, structured prompt
  return `
You are a dating profile compatibility assistant.

User's preferences:
- Interests: ${userInterests.join(', ') || 'None specified'}
- Keywords to avoid: ${userAvoidKeywords.join(', ') || 'None specified'}

Profile to evaluate:
- Name: ${profileName}
- Age: ${profileAge}
- Bio: ${profileBio}
- Interests: ${profileInterests.join(', ') || 'None specified'}

Compare these two profiles and provide:
1. A compatibility score from 0.0 to 1.0 (where 0.0 is completely incompatible and 1.0 is perfect match)
2. A brief explanation for your score

Format your response as:
Compatibility score: [number between 0.0-1.0]
[Your brief explanation]
`.trim();
}

async function runTest() {
  try {
    // Run full endpoint testing
    const endpointResult = await testAllEndpoints();
    
    if (!endpointResult.success) {
      console.log('Failed to find a working Llama API endpoint. Please check your server configuration.');
      return;
    }
    
    // We've found a working endpoint
    console.log(`\n===== SUMMARY =====`);
    console.log(`Working endpoint found: ${endpointResult.endpoint}`);
    console.log('Llama API connection test completed successfully.');
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Run the test
runTest().catch(err => {
  console.error('Unexpected error:', err);
}); 