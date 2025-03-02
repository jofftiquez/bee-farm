const { delay, clickAtPosition } = require('./utils');
const { checkAvoidKeywords, analyzeProfileAlignment } = require('./profile-analysis');
const logger = require('./logger');

/**
 * Decide whether to swipe left or right on a profile
 * @param {Object} page Puppeteer page object
 * @param {boolean} isVerified Whether the profile is verified
 * @param {Object} profileInfo Profile information including bio
 * @param {Object} userPreferences User preferences for matching
 * @returns {string} 'left' or 'right' based on decision
 */
async function decideSwipeDirection(page, isVerified, profileInfo, userPreferences) {
    logger.section('Decision Process');
    
    // Step 1: If profile is not verified, always swipe left
    if (!isVerified) {
        logger.log('Profile is not verified, swiping left', logger.LOG_LEVELS.WARNING, 'DECISION');
        return 'left';
    }
    
    // Step 2: If bio is required but not present, swipe left
    if (userPreferences.requireBio && !profileInfo.hasBio) {
        logger.log('No bio found, swiping left', logger.LOG_LEVELS.WARNING, 'DECISION');
        return 'left';
    }
    
    // Step 3: Check for keywords to avoid
    const keywordCheckResult = checkAvoidKeywords(
        profileInfo.bio + ' ' + profileInfo.fullText, 
        userPreferences.avoidKeywords
    );
    
    if (keywordCheckResult.shouldAvoid) {
        logger.log(`Found avoid keywords: ${keywordCheckResult.foundKeywords.join(', ')}, swiping left`, 
                  logger.LOG_LEVELS.WARNING, 'DECISION');
        return 'left';
    }
    
    // Step 4: Analyze alignment with user interests
    const alignmentResult = await analyzeProfileAlignment(profileInfo, userPreferences);
    
    if (alignmentResult.isAligned) {
        logger.log(`Profile is aligned with interests (${alignmentResult.alignmentLevel}), swiping right`, 
                  logger.LOG_LEVELS.SUCCESS, 'DECISION');
        return 'right';
    }
    
    logger.log(`Profile doesn't align well with interests (${alignmentResult.alignmentLevel}), swiping left`, 
              logger.LOG_LEVELS.WARNING, 'DECISION');
    return 'left';
}

/**
 * Perform the actual swiping action
 * @param {Object} page Puppeteer page object
 * @param {string} direction 'left' or 'right'
 * @param {Object} buttonPositions The positions of the like and pass buttons
 */
async function performSwipe(page, direction, buttonPositions) {
    logger.log(`Performing ${direction} swipe...`, 
              direction === 'right' ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.INFO, 
              'ACTION');
    
    try {
        if (direction === 'right') {
            // Click the like button
            logger.log('Clicking like button...', logger.LOG_LEVELS.INFO, 'ACTION');
            await clickAtPosition(page, buttonPositions.likeButtonX, buttonPositions.likeButtonY);
        } else {
            // Click the pass button
            logger.log('Clicking pass button...', logger.LOG_LEVELS.INFO, 'ACTION');
            await clickAtPosition(page, buttonPositions.passButtonX, buttonPositions.passButtonY);
        }
        
        // Wait a bit after swiping
        await delay(1000 + Math.random() * 1000);
        logger.log('Swipe completed', logger.LOG_LEVELS.SUCCESS, 'ACTION');
    } catch (error) {
        logger.log(`Error while swiping: ${error.message}`, logger.LOG_LEVELS.ERROR, 'ACTION');
    }
}

/**
 * Process a single profile
 * @param {Object} page Puppeteer page object
 * @param {Object} buttonPositions The positions of the like and pass buttons
 * @param {boolean} isVerified Whether the profile is verified
 * @param {Object} profileInfo Profile information including bio
 * @param {Object} userPreferences User preferences for matching
 */
async function processProfile(page, buttonPositions, isVerified, profileInfo, userPreferences) {
    try {
        // Decide which way to swipe
        const swipeDirection = await decideSwipeDirection(page, isVerified, profileInfo, userPreferences);
        
        // Perform the swipe
        await performSwipe(page, swipeDirection, buttonPositions);
        
        // Return the direction we swiped for tracking
        return swipeDirection;
    } catch (error) {
        logger.log(`Error processing profile: ${error.message}`, logger.LOG_LEVELS.ERROR, 'PROCESS');
        // Default to left swipe on error
        return 'left';
    }
}

module.exports = {
    decideSwipeDirection,
    performSwipe,
    processProfile
}; 