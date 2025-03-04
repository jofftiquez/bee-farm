/**
 * Simple test script for the Llama integration
 * Run with: node test-llama.js
 */

const llmIntegration = require('./lib/llm-integration');
const logger = require('./lib/logger');

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

async function runTest() {
  logger.section('LLAMA TEST');
  
  // First check the connection
  logger.log('Testing Llama API connection...', logger.LOG_LEVELS.INFO, 'TEST');
  const isConnected = await llmIntegration.checkLlamaApiConnection();
  
  if (!isConnected) {
    logger.log('❌ Llama API connection failed', logger.LOG_LEVELS.ERROR, 'TEST');
    logger.log('Please check if Ollama is running and accessible at http://localhost:11434', logger.LOG_LEVELS.INFO, 'TEST');
    return;
  }
  
  logger.log('✅ Llama API connection successful', logger.LOG_LEVELS.SUCCESS, 'TEST');
  
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