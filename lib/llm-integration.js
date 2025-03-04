const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Llama 3 integration for profile compatibility analysis
 */

/**
 * Default endpoint for Llama 3 API
 * You can modify this URL to point to your local or remote Llama 3 endpoint
 */
let DEFAULT_LLM_ENDPOINT = 'http://127.0.0.1:11434/api/generate';

// Alternative endpoints to try if the default fails
const ALTERNATIVE_ENDPOINTS = [
    'http://localhost:11434/api/generate',   // Original localhost endpoint as fallback
    'http://localhost:8000/api/generate',    // Common alternative port
    'http://localhost:1234/v1/chat/completions'  // Compatible OpenAI-style endpoint
];

// Try to read from working_endpoint.txt if it exists
try {
    const workingEndpointPath = path.join(__dirname, '..', 'working_endpoint.txt');
    if (fs.existsSync(workingEndpointPath)) {
        const savedEndpoint = fs.readFileSync(workingEndpointPath, 'utf8').trim();
        if (savedEndpoint) {
            logger.log(`Found saved working endpoint: ${savedEndpoint}`, logger.LOG_LEVELS.INFO, 'LLM');
            DEFAULT_LLM_ENDPOINT = savedEndpoint;
        }
    }
} catch (err) {
    logger.log(`Error reading working endpoint file: ${err.message}`, logger.LOG_LEVELS.WARNING, 'LLM');
}

// Track the last working endpoint
let lastWorkingEndpoint = DEFAULT_LLM_ENDPOINT;

/**
 * Get the Llama 3 endpoint URL from environment, user preferences, or fallback to default
 * @param {Object} userPreferences Optional user preferences that may contain LLM endpoint setting
 * @returns {string} The endpoint URL
 */
function getLlamaEndpoint(userPreferences = null) {
    // If we have a known working endpoint from previous checks, use that first
    if (lastWorkingEndpoint) {
        logger.log(`Using previously successful endpoint: ${lastWorkingEndpoint}`, logger.LOG_LEVELS.DEBUG, 'LLM');
        return lastWorkingEndpoint;
    }
    
    // First check environment variable
    if (process.env.LLAMA_ENDPOINT) {
        return process.env.LLAMA_ENDPOINT;
    }
    
    // Then check user preferences if available
    if (userPreferences && 
        userPreferences.llmSettings && 
        userPreferences.llmSettings.endpoint) {
        return userPreferences.llmSettings.endpoint;
    }
    
    // Finally default to the built-in endpoint
    return DEFAULT_LLM_ENDPOINT;
}

/**
 * Analyze a profile using Llama 3
 * @param {Object} profileData The extracted profile data
 * @param {Object} userPrefs User preferences
 * @returns {Object} Analysis results
 */
async function analyzeWithLlama(profileData, userPrefs) {
  try {
    // Use directly the last known working endpoint or default if none found yet
    const endpoint = lastWorkingEndpoint || DEFAULT_LLM_ENDPOINT;
    
    logger.log(`Using endpoint: ${endpoint}`, logger.LOG_LEVELS.DEBUG, 'LLM');
    
    // Generate the prompt for compatibility analysis
    const prompt = generateCompatibilityPrompt(profileData, userPrefs);
    
    logger.log(`Sending analysis request to Llama API...`, logger.LOG_LEVELS.INFO, 'LLM');
    logger.log(`Prompt length: ${prompt.length} characters`, logger.LOG_LEVELS.DEBUG, 'LLM');
    
    // Make the API request
    const response = await axios.post(endpoint, {
      model: 'llama3:latest',
      prompt: prompt,
      stream: false,
      temperature: 0.2,
      max_tokens: 150
    }, { timeout: 30000 }); // Increased timeout for longer requests
    
    // Extract the text from the response
    const responseText = response.data.response || response.data.generated_text || '';
    
    if (!responseText) {
      logger.log('Empty response from Llama API', logger.LOG_LEVELS.ERROR, 'LLM');
      return { score: 0.5, analysis: 'Analysis failed', rawResponse: 'Empty response' };
    }
    
    logger.log('Response received successfully!', logger.LOG_LEVELS.INFO, 'LLM');
    logger.log(`Response length: ${responseText.length} characters`, logger.LOG_LEVELS.DEBUG, 'LLM');
    
    // Extract the compatibility score
    const scoreMatch = responseText.match(/compatibility score:\s*(0\.\d+|1\.0|1)/i) || 
                       responseText.match(/score:\s*(0\.\d+|1\.0|1)/i) ||
                       responseText.match(/(0\.\d+|1\.0|1)/);
    
    let score = 0.5; // Default score
    
    if (scoreMatch && scoreMatch[1]) {
      score = parseFloat(scoreMatch[1]);
      logger.log(`Extracted compatibility score: ${score}`, logger.LOG_LEVELS.DEBUG, 'LLM');
    } else {
      logger.log('Could not extract a score from response', logger.LOG_LEVELS.WARNING, 'LLM');
    }
    
    // Extract or use the full text as analysis
    const analysis = responseText.trim();
    
    return { 
      score, 
      analysis, 
      rawResponse: responseText 
    };
  } catch (error) {
    logger.log(`Error in Llama analysis: ${error.message}`, logger.LOG_LEVELS.ERROR, 'LLM');
    return { 
      score: 0.5, 
      analysis: `Analysis error: ${error.message}`, 
      rawResponse: null 
    };
  }
}

/**
 * Generate a prompt for compatibility analysis
 * @param {Object} profileData Profile information
 * @param {Object} userPreferences User preferences
 * @returns {string} A formatted prompt for the LLM
 */
function generateCompatibilityPrompt(profileData, userPreferences) {
    // Extract user interests
    const userInterests = userPreferences.interests || [];
    const userAvoidKeywords = userPreferences.avoidKeywords || [];
    
    // Extract profile information
    const profileName = profileData.name || 'Unknown';
    const profileAge = profileData.age || 'Unknown';
    const profileBio = profileData.bio || '';
    const profileInterests = profileData.attributes || [];
    
    // Create a simpler, more structured prompt
    const prompt = `
You are a dating profile compatibility assistant.

User's preferences:
- Interests: ${userInterests.join(', ') || 'None specified'}
- Keywords to avoid: ${userAvoidKeywords.join(', ') || 'None specified'}

Profile to evaluate:
- Name: ${profileName}
- Age: ${profileAge}
- Bio: ${profileBio.substring(0, 200)}${profileBio.length > 200 ? '...' : ''}
- Interests: ${profileInterests.join(', ') || 'None specified'}

Compare these two profiles and provide:
1. A compatibility score from 0.0 to 1.0 (where 0.0 is completely incompatible and 1.0 is perfect match)
2. A brief explanation for your score

Format your response as:
Compatibility score: [number between 0.0-1.0]
[Your brief explanation]
`.trim();

    return prompt;
}

/**
 * Check if the Llama API is accessible and working
 * @param {boolean} tryAlternatives Whether to try alternative endpoints if primary fails
 * @returns {boolean} True if the API is accessible, false otherwise
 */
async function checkLlamaApiConnection(tryAlternatives = true) {
  let endpoint = DEFAULT_LLM_ENDPOINT;
  let tagsEndpoint = endpoint.replace('/generate', '/tags').replace('/v1/chat/completions', '/tags');
  
  logger.log(`Checking Llama API connection at ${endpoint}`, logger.LOG_LEVELS.INFO, 'LLM');
  
  try {
    // First try to get the models list
    await axios.get(tagsEndpoint, { timeout: 5000 });
    
    // If we get here, the connection works - let's test a simple prompt
    logger.log('Connection established, testing simple prompt...', logger.LOG_LEVELS.INFO, 'LLM');
    
    const response = await axios.post(endpoint, {
      model: 'llama3:latest',
      prompt: 'Hello, are you working?',
      stream: false,
      temperature: 0.1,
      max_tokens: 10
    }, { timeout: 5000 });
    
    // Save the working endpoint
    lastWorkingEndpoint = endpoint;
    
    // Save to file for future use
    try {
      const workingEndpointPath = path.join(__dirname, '..', 'working_endpoint.txt');
      fs.writeFileSync(workingEndpointPath, endpoint, 'utf8');
      logger.log(`Saved working endpoint to file: ${endpoint}`, logger.LOG_LEVELS.DEBUG, 'LLM');
    } catch (err) {
      logger.log(`Error saving working endpoint: ${err.message}`, logger.LOG_LEVELS.WARNING, 'LLM');
    }
    
    logger.log('Llama API connection successful!', logger.LOG_LEVELS.SUCCESS, 'LLM');
    return true;
  } catch (error) {
    logger.log(`Primary endpoint error: ${error.message}`, logger.LOG_LEVELS.ERROR, 'LLM');
    
    if (!tryAlternatives) {
      return false;
    }
    
    // Try alternative endpoints
    logger.log('Trying alternative endpoints...', logger.LOG_LEVELS.INFO, 'LLM');
    
    for (const altEndpoint of ALTERNATIVE_ENDPOINTS) {
      try {
        let altTagsEndpoint = altEndpoint.replace('/generate', '/tags').replace('/v1/chat/completions', '/tags');
        
        logger.log(`Trying alternative endpoint: ${altEndpoint}`, logger.LOG_LEVELS.INFO, 'LLM');
        
        // Check if the alternative endpoint works
        await axios.get(altTagsEndpoint, { timeout: 5000 });
        
        // Test simple prompt
        await axios.post(altEndpoint, {
          model: 'llama3:latest',
          prompt: 'Hello, are you working?',
          stream: false,
          temperature: 0.1,
          max_tokens: 10
        }, { timeout: 5000 });
        
        // If we get here, the alternative works!
        logger.log(`Alternative endpoint works: ${altEndpoint}`, logger.LOG_LEVELS.SUCCESS, 'LLM');
        
        // Save the working endpoint
        lastWorkingEndpoint = altEndpoint;
        
        // Save to file for future use
        try {
          const workingEndpointPath = path.join(__dirname, '..', 'working_endpoint.txt');
          fs.writeFileSync(workingEndpointPath, altEndpoint, 'utf8');
          logger.log(`Saved working endpoint to file: ${altEndpoint}`, logger.LOG_LEVELS.DEBUG, 'LLM');
        } catch (err) {
          logger.log(`Error saving working endpoint: ${err.message}`, logger.LOG_LEVELS.WARNING, 'LLM');
        }
        
        return true;
      } catch (altError) {
        logger.log(`Alternative endpoint failed: ${altError.message}`, logger.LOG_LEVELS.WARNING, 'LLM');
      }
    }
    
    logger.log('All endpoints failed', logger.LOG_LEVELS.ERROR, 'LLM');
    return false;
  }
}

module.exports = {
    analyzeWithLlama,
    checkLlamaApiConnection,
    getLlamaEndpoint
}; 