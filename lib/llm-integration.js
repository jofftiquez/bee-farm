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
const DEFAULT_LLM_ENDPOINT = 'http://localhost:11434/api/generate';

/**
 * Get the Llama 3 endpoint URL from environment or fallback to default
 * @returns {string} The endpoint URL
 */
function getLlamaEndpoint() {
    return process.env.LLAMA_ENDPOINT || DEFAULT_LLM_ENDPOINT;
}

/**
 * Generate a prompt for profile compatibility analysis
 * @param {Object} profileInfo - Information about the profile
 * @param {Object} userPreferences - User preferences
 * @returns {string} - Prompt for the LLM
 */
function generateCompatibilityPrompt(profileInfo, userPreferences) {
    // Extract profile text for analysis
    let profileText = '';
    if (profileInfo.hasBio) {
        profileText += `Bio: ${profileInfo.bio}\n`;
    }
    
    if (profileInfo.attributes && profileInfo.attributes.length > 0) {
        profileText += `Interests/Attributes: ${profileInfo.attributes.join(', ')}\n`;
    }
    
    if (!profileInfo.hasBio && (!profileInfo.attributes || profileInfo.attributes.length === 0)) {
        profileText = `Full profile text: ${profileInfo.fullText || 'No text available'}\n`;
    }

    // Format the user's preferences
    const userInterests = userPreferences.interests.join(', ');
    const userDescription = userPreferences.personalDescription || 'No personal description provided';
    const userAvoidKeywords = userPreferences.avoidKeywords ? userPreferences.avoidKeywords.join(', ') : 'None';
    
    // Build the complete prompt
    return `
You are a dating profile compatibility assistant. Analyze the compatibility between a user and a dating profile.

USER PREFERENCES:
Personal description: ${userDescription}
Interests: ${userInterests}
Avoid Keywords: ${userAvoidKeywords}

PROFILE TO ANALYZE:
Name: ${profileInfo.name || 'Unknown'}
Age: ${profileInfo.age || 'Unknown'}
${profileInfo.occupation ? `Occupation: ${profileInfo.occupation}\n` : ''}
${profileInfo.education ? `Education: ${profileInfo.education}\n` : ''}
${profileText}

Analyze how compatible this profile is with the user's preferences. Consider:
1. Shared interests
2. Values alignment
3. Potential conversation topics
4. Overall compatibility

Then provide:
1. A compatibility score between 0.0 and 1.0
2. A brief explanation (max 3 sentences)
3. The exact score as "score: X.X" on its own line at the end

Format: 
- Analysis: Your analysis here
- score: 0.X
`;
}

/**
 * Parse the LLM response to extract the compatibility score and analysis
 * @param {string} llmResponse - The raw response from the LLM
 * @returns {Object} - Parsed response with score and analysis
 */
function parseCompatibilityResponse(llmResponse) {
    try {
        // Extract the score using regex
        const scoreMatch = llmResponse.match(/score:\s*([0-9]\.[0-9])/i);
        let score = 0.5; // Default fallback score
        
        if (scoreMatch && scoreMatch[1]) {
            score = parseFloat(scoreMatch[1]);
            // Validate score is within range
            if (score < 0 || score > 1) {
                logger.log(`Invalid LLM score ${score}, clamping to range 0-1`, logger.LOG_LEVELS.WARNING, 'LLM');
                score = Math.max(0, Math.min(1, score));
            }
        } else {
            logger.log('Could not extract numeric score from LLM response, using default', logger.LOG_LEVELS.WARNING, 'LLM');
        }
        
        // Clean up the analysis text, removing the score line
        let analysis = llmResponse
            .replace(/score:\s*[0-9]\.[0-9]/i, '')
            .replace(/Analysis:/i, '')
            .trim();
            
        return {
            score,
            analysis
        };
    } catch (error) {
        logger.log(`Error parsing LLM response: ${error.message}`, logger.LOG_LEVELS.ERROR, 'LLM');
        return {
            score: 0.5,
            analysis: 'Could not analyze compatibility (error parsing response)'
        };
    }
}

/**
 * Analyze profile compatibility using Llama 3
 * @param {Object} profileInfo - Profile information extracted from page
 * @param {Object} userPreferences - User preferences for matching
 * @returns {Object} - Analysis result with compatibility score
 */
async function analyzeWithLlama(profileInfo, userPreferences) {
    logger.log('Analyzing profile compatibility using Llama 3...', logger.LOG_LEVELS.INFO, 'LLM');
    
    try {
        const endpoint = getLlamaEndpoint();
        const prompt = generateCompatibilityPrompt(profileInfo, userPreferences);
        
        // Log the prompt for debugging
        logger.log('Sending prompt to Llama 3', logger.LOG_LEVELS.DEBUG, 'LLM');
        
        // API request to Llama 3
        const response = await axios.post(endpoint, {
            model: 'llama3:latest',
            prompt: prompt,
            stream: false,
            temperature: 0.1,  // Low temperature for more consistent results
            max_tokens: 300
        });
        
        // Extract the generated text
        const generatedText = response.data.response || response.data.generated_text || '';
        
        if (!generatedText) {
            throw new Error('Empty response from LLM API');
        }
        
        // Parse the response
        const result = parseCompatibilityResponse(generatedText);
        
        logger.log(`LLM Compatibility Score: ${result.score.toFixed(2)}`, 
            result.score >= 0.6 ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.INFO, 
            'LLM');
        
        return {
            score: result.score,
            analysis: result.analysis,
            rawResponse: generatedText
        };
    } catch (error) {
        logger.log(`Error using Llama 3: ${error.message}`, logger.LOG_LEVELS.ERROR, 'LLM');
        
        // Return a fallback result
        return {
            score: 0.5,
            analysis: 'Could not analyze using LLM (API error)',
            error: error.message
        };
    }
}

/**
 * Check if the Llama API is accessible
 * @returns {Promise<boolean>} True if the API is accessible
 */
async function checkLlamaApiConnection() {
    try {
        const endpoint = getLlamaEndpoint();
        logger.log(`Checking Llama API at endpoint: ${endpoint}`, logger.LOG_LEVELS.DEBUG, 'LLM');
        
        // For Ollama-style endpoints, use the tags endpoint to check available models
        if (endpoint.includes('11434')) {
            const tagsEndpoint = endpoint.replace('/api/generate', '/api/tags');
            logger.log(`Using tags endpoint: ${tagsEndpoint}`, logger.LOG_LEVELS.DEBUG, 'LLM');
            const response = await axios.get(tagsEndpoint, { timeout: 3000 });
            
            // Check if our model is in the list of available models
            const models = response.data?.models || [];
            const modelNames = models.map(m => m.name);
            logger.log(`Available models: ${modelNames.join(', ')}`, logger.LOG_LEVELS.DEBUG, 'LLM');
            
            // Verify if our target model exists
            if (!modelNames.includes('llama3:latest')) {
                logger.log('Warning: llama3:latest model not found in available models', logger.LOG_LEVELS.WARNING, 'LLM');
                // Return true anyway since we can likely use another llama3 model
            }
        } else {
            // For other endpoints, try a minimal request
            logger.log(`Using direct model query to endpoint: ${endpoint}`, logger.LOG_LEVELS.DEBUG, 'LLM');
            await axios.post(endpoint, {
                model: 'llama3:latest',
                prompt: 'Hello',
                stream: false,
                max_tokens: 1
            }, { timeout: 3000 });
        }
        logger.log('Llama API connection successful', logger.LOG_LEVELS.DEBUG, 'LLM');
        return true;
    } catch (error) {
        logger.log(`Llama API connection check failed: ${error.message}`, logger.LOG_LEVELS.DEBUG, 'LLM');
        return false;
    }
}

module.exports = {
    analyzeWithLlama,
    checkLlamaApiConnection
}; 