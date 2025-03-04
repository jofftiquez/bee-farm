/**
 * Simple test script for the Llama integration
 * Run with: node test-llama.js
 */

const llmIntegration = require('./lib/llm-integration');
const logger = require('./lib/logger');
const axios = require('axios');

// Test profile and preferences
const testProfile = {
  name: 'Test User',
  age: '30',
  bio: 'I love hiking, reading, and technology. I enjoy outdoor activities and quiet evenings with a good book.',
  attributes: ['hiking', 'technology', 'reading', 'outdoors'],
  hasBio: true,
  fullText: 'Test User, 30. I love hiking, reading, and technology. I enjoy outdoor activities and quiet evenings with a good book.'
};

const testPrefs = {
  personalDescription: 'I like outdoor activities and books. Looking for someone who shares my interests and has an active lifestyle.',
  interests: ['hiking', 'reading', 'cooking', 'travel'],
  llmSettings: { 
    enabled: true, 
    minComparisonScore: 0.6 
  }
};

// Define test endpoints
const endpoints = [
  'http://localhost:11434/api/generate',   // Default Ollama endpoint
  'http://127.0.0.1:11434/api/generate',   // Alternative localhost IP
  'http://localhost:8000/api/generate',    // Alternative port
  'http://localhost:1234/v1/chat/completions'  // OpenAI-compatible endpoint
];

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
    
    return true;
  } catch (error) {
    logger.log(`Error with endpoint ${endpoint}: ${error.message}`, logger.LOG_LEVELS.ERROR, 'TEST');
    return false;
  }
}

async function runTest() {
  logger.section('LLAMA TEST');
  
  // First check the connection
  logger.log('Testing Llama API connection...', logger.LOG_LEVELS.INFO, 'TEST');
  const isConnected = await llmIntegration.checkLlamaApiConnection();
  
  if (!isConnected) {
    logger.log('❌ Llama API connection failed', logger.LOG_LEVELS.ERROR, 'TEST');
    logger.log('Please check if Ollama is running and accessible at http://localhost:11434', logger.LOG_LEVELS.INFO, 'TEST');
    logger.log('Trying alternative endpoints...', logger.LOG_LEVELS.INFO, 'TEST');
    
    // Try all endpoints with a simple prompt
    let success = false;
    for (const endpoint of endpoints) {
      const result = await testSimplePrompt(endpoint);
      if (result) {
        success = true;
        logger.log(`✅ Endpoint ${endpoint} works!`, logger.LOG_LEVELS.SUCCESS, 'TEST');
        logger.log(`Update your configuration to use this endpoint.`, logger.LOG_LEVELS.INFO, 'TEST');
        break;
      }
    }
    
    if (!success) {
      logger.log('All endpoints failed. Please make sure Ollama is running.', logger.LOG_LEVELS.ERROR, 'TEST');
      logger.log('Install Ollama from https://ollama.ai/', logger.LOG_LEVELS.INFO, 'TEST');
      logger.log('Then run: ollama pull llama3', logger.LOG_LEVELS.INFO, 'TEST');
    }
    
    return;
  }
  
  logger.log('✅ Llama API connection successful', logger.LOG_LEVELS.SUCCESS, 'TEST');
  
  // Test simple prompt first
  logger.log('Testing simple prompt before full analysis...', logger.LOG_LEVELS.INFO, 'TEST');
  const endpoint = llmIntegration.getLlamaEndpoint(testPrefs);
  const simplePromptWorks = await testSimplePrompt(endpoint);
  
  if (!simplePromptWorks) {
    logger.log('Simple prompt failed. The LLM API may be unstable.', logger.LOG_LEVELS.ERROR, 'TEST');
    return;
  }
  
  // Now test the analysis
  logger.log('Testing profile analysis with Llama...', logger.LOG_LEVELS.INFO, 'TEST');
  try {
    const result = await llmIntegration.analyzeWithLlama(testProfile, testPrefs);
    
    // Display the results
    logger.log(`Profile analysis completed! Score: ${result.score.toFixed(2)}`, 
      result.score >= 0.6 ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.WARNING, 
      'TEST');
    
    logger.log(`Analysis: ${result.analysis}`, logger.LOG_LEVELS.INFO, 'TEST');
    
    // Extra debugging info
    logger.log('Full API response for debugging:', logger.LOG_LEVELS.DEBUG, 'TEST');
    logger.log(result.rawResponse, logger.LOG_LEVELS.DEBUG, 'TEST');
    
  } catch (error) {
    logger.log(`❌ Error during Llama analysis: ${error.message}`, logger.LOG_LEVELS.ERROR, 'TEST');
    if (error.response) {
      logger.log(`Status: ${error.response.status}`, logger.LOG_LEVELS.ERROR, 'TEST');
      logger.log(`Data: ${JSON.stringify(error.response.data)}`, logger.LOG_LEVELS.ERROR, 'TEST');
    }
  }
}

// Run the test
runTest().catch(err => {
  console.error('Unexpected error:', err);
}); 