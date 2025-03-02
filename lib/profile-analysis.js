const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');
const config = require('./config');

/**
 * Extract profile bio and relevant information from the DOM
 * @param {Object} page Puppeteer page object
 * @param {string} screenshotDir Directory for saving screenshots
 * @returns {Object} Profile information including bio text
 */
async function extractProfileInfo(page, screenshotDir) {
    logger.log('Extracting profile information...', logger.LOG_LEVELS.INFO, 'PROFILE');
    
    try {
        // Take a screenshot for debugging
        const bioScreenshotPath = path.join(screenshotDir, 'profile_bio.png');
        await page.screenshot({ path: bioScreenshotPath });
        logger.log(`Profile screenshot saved to: ${bioScreenshotPath}`, logger.LOG_LEVELS.DEBUG, 'PROFILE');
        
        // Extract profile information from the DOM
        const profileInfo = await page.evaluate(() => {
            // Primary bio selector (from user's shared DOM structure)
            const bioElement = document.querySelector('.encounters-story-about__text');
            const bioText = bioElement ? bioElement.textContent.trim() : '';
            
            // Extract tags/attributes from pills (from user's shared DOM structure)
            const pillElements = document.querySelectorAll('.encounters-story-about__badge .pill');
            const attributes = Array.from(pillElements).map(pill => {
                const titleElement = pill.querySelector('.pill__title');
                return titleElement ? titleElement.textContent.trim() : '';
            }).filter(text => text.length > 0);
            
            // Fallback bio selectors if primary one isn't found
            if (!bioText) {
                const fallbackBioSelectors = [
                    '[data-qa-role="profile-bio"]',
                    '.profile-content .profile-section-bio',
                    '.profile__bio',
                    '[data-qa-role="profile-about"]',
                    '.encounters-story-experience__content'
                ];
                
                for (const selector of fallbackBioSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        return {
                            bio: element.textContent.trim(),
                            hasBio: true,
                            attributes: attributes,
                            fullText: document.body.innerText
                        };
                    }
                }
            }
            
            // Try to find name and age
            const nameAgeMatch = document.body.innerText.match(/([A-Za-z]+),?\s*(\d{1,2})/);
            const name = nameAgeMatch ? nameAgeMatch[1] : 'Unknown';
            const age = nameAgeMatch ? nameAgeMatch[2] : 'Unknown';
            
            return {
                name,
                age,
                bio: bioText || 'No bio found',
                hasBio: bioText.length > 0,
                attributes: attributes,
                interests: attributes, // For compatibility with existing code
                fullText: document.body.innerText
            };
        });
        
        // Display profile information in a structured format
        logger.displayProfile(profileInfo);
        
        // Save the bio to a file for debugging
        const bioFilePath = path.join(screenshotDir, `profile_bio_${Date.now()}.txt`);
        await fs.writeFile(bioFilePath, 
            `Name: ${profileInfo.name}\n` +
            `Age: ${profileInfo.age}\n` +
            `Bio: ${profileInfo.bio}\n` +
            `Attributes: ${profileInfo.attributes ? profileInfo.attributes.join(', ') : 'None'}\n\n` +
            `Full profile text:\n${profileInfo.fullText}`
        );
        logger.log(`Profile information saved to: ${bioFilePath}`, logger.LOG_LEVELS.DEBUG, 'PROFILE');
        
        return profileInfo;
    } catch (error) {
        logger.log(`Error extracting profile information: ${error.message}`, logger.LOG_LEVELS.ERROR, 'PROFILE');
        // Return a valid but empty profile info object on error
        return {
            name: 'Unknown',
            age: 'Unknown',
            hasBio: false,
            bio: '',
            attributes: [],
            interests: [],
            fullText: '',
            error: error.message
        };
    }
}

/**
 * Check if the bio contains any keywords to avoid
 * @param {string} bio The profile bio text
 * @param {Array<string>} avoidKeywords List of keywords to avoid
 * @returns {Object} Result with found keywords and decision
 */
function checkAvoidKeywords(bioText, avoidKeywords) {
    logger.log('Checking for avoid keywords...', logger.LOG_LEVELS.INFO, 'KEYWORDS');
    
    const textLower = bioText.toLowerCase();
    const foundKeywords = [];
    
    for (const keyword of avoidKeywords) {
        const keywordLower = keyword.toLowerCase();
        if (textLower.includes(keywordLower)) {
            foundKeywords.push(keyword);
        }
    }
    
    const result = {
        foundKeywords,
        shouldAvoid: foundKeywords.length > 0
    };
    
    if (result.shouldAvoid) {
        logger.log(`Found ${foundKeywords.length} avoid keywords: ${foundKeywords.join(', ')}`, logger.LOG_LEVELS.WARNING, 'KEYWORDS');
    } else {
        logger.log('No avoid keywords found', logger.LOG_LEVELS.SUCCESS, 'KEYWORDS');
    }
    
    return result;
}

/**
 * Analyze profile alignment with user interests (placeholder for LLM integration)
 * @param {Object} profileInfo The profile information
 * @param {Object} userPreferences User preferences and interests
 * @returns {Object} Analysis result with alignment score
 */
async function analyzeProfileAlignment(profileInfo, userPreferences) {
    logger.log('Analyzing profile alignment with user interests...', logger.LOG_LEVELS.INFO, 'ALIGNMENT');
    
    // Determine the text to analyze: combine bio and attributes if both exist
    let analysisText = '';
    
    if (profileInfo.hasBio && profileInfo.attributes && profileInfo.attributes.length > 0) {
        // Both bio and attributes exist, combine them
        analysisText = profileInfo.bio + ' ' + profileInfo.attributes.join(' ');
        logger.log('Using combined bio and attributes for analysis', logger.LOG_LEVELS.INFO, 'ALIGNMENT');
    } else if (profileInfo.hasBio) {
        // Only bio exists
        analysisText = profileInfo.bio;
        logger.log('Using only bio for analysis (no attributes found)', logger.LOG_LEVELS.INFO, 'ALIGNMENT');
    } else if (profileInfo.attributes && profileInfo.attributes.length > 0) {
        // Only attributes exist
        analysisText = profileInfo.attributes.join(' ');
        logger.log('Using only attributes for analysis (no bio found)', logger.LOG_LEVELS.INFO, 'ALIGNMENT');
    } else {
        // Neither bio nor attributes exist (this case is now handled in swipe-logic.js)
        analysisText = profileInfo.fullText || '';
        logger.log('No bio or attributes found, using full text for analysis', logger.LOG_LEVELS.WARNING, 'ALIGNMENT');
    }
    
    // Extract keywords from user interests
    const userKeywords = userPreferences.interests.flatMap(interest => 
        interest.toLowerCase().split(/\s+/)
    );
    
    // Count matching keywords in profile analysis text
    const analysisTextLower = analysisText.toLowerCase();
    let matchCount = 0;
    
    // Use minKeywordLength from config
    const minKeywordLength = config.profile.alignment.minKeywordLength;
    
    for (const keyword of userKeywords) {
        if (keyword.length > minKeywordLength && analysisTextLower.includes(keyword)) {
            matchCount++;
        }
    }
    
    // Check for matching interests
    const profileInterestsLower = profileInfo.attributes.map(i => i.toLowerCase());
    const matchingInterests = userPreferences.interests.filter(interest => 
        profileInterestsLower.some(profileInterest => 
            profileInterest.includes(interest.toLowerCase()) || 
            interest.toLowerCase().includes(profileInterest)
        )
    );
    
    // Get weights from config
    const keywordWeight = config.profile.alignment.weights.keyword;
    const interestWeight = config.profile.alignment.weights.interest;
    
    // Calculate simple alignment score (0 to 1)
    const keywordAlignmentScore = userKeywords.length > 0 ? matchCount / userKeywords.length : 0;
    const interestAlignmentScore = userPreferences.interests.length > 0 ? 
        matchingInterests.length / userPreferences.interests.length : 0;
    
    // Combined score with weights from config
    const alignmentScore = (keywordAlignmentScore * keywordWeight) + (interestAlignmentScore * interestWeight);
    
    // Decision threshold from config or user preferences
    const alignmentThreshold = userPreferences.alignmentThreshold || config.profile.alignment.threshold;
    const isAligned = alignmentScore >= alignmentThreshold;
    
    // Get level thresholds from config
    const lowThreshold = config.profile.alignment.levels.low;
    const mediumThreshold = config.profile.alignment.levels.medium;
    
    const result = {
        alignmentScore,
        alignmentLevel: alignmentScore < lowThreshold ? 'Low' : 
                        alignmentScore < mediumThreshold ? 'Medium' : 'High',
        isAligned,
        matchingInterests,
        matchCount,
        analysisText, // Add the analysis text to the result for debugging
        analysis: `Profile has ${matchCount} keyword matches and ${matchingInterests.length} matching interests`,
        llmAnalysis: null // This will be populated when LLM integration is added
    };
    
    logger.log(`Alignment analysis: ${result.alignmentLevel} (${Math.round(alignmentScore * 100)}%)`, 
        result.isAligned ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.INFO, 'ALIGNMENT');
    logger.log(`Decision: ${isAligned ? 'Aligned ✅' : 'Not aligned ❌'}`, 
        result.isAligned ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.WARNING, 'ALIGNMENT');
    
    return result;
}

module.exports = {
    extractProfileInfo,
    checkAvoidKeywords,
    analyzeProfileAlignment
}; 