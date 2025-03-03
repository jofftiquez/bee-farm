const { delay, clickAtPosition } = require('./utils');
const { checkAvoidKeywords, analyzeProfileAlignment } = require('./profile-analysis');
const logger = require('./logger');
const config = require('./config');

// Track swipe statistics
let totalSwipes = 0;
let rightSwipes = 0;
let fallbackRightSwipes = 0;
let alignmentRightSwipes = 0;

/**
 * Get current swipe statistics
 * @returns {Object} Object containing swipe statistics
 */
function getSwipeStats() {
    const rightSwipePercentage = (rightSwipes / totalSwipes) * 100 || 0;
    const fallbackPercentage = (fallbackRightSwipes / rightSwipes) * 100 || 0;
    const alignmentPercentage = (alignmentRightSwipes / rightSwipes) * 100 || 0;
    
    return {
        total: totalSwipes,
        right: rightSwipes,
        rightPercentage: rightSwipePercentage,
        fallbackCount: fallbackRightSwipes,
        fallbackPercentage: fallbackPercentage,
        alignmentCount: alignmentRightSwipes,
        alignmentPercentage: alignmentPercentage
    };
}

/**
 * Log current swipe statistics
 */
function logSwipeStats() {
    const stats = getSwipeStats();
    logger.section('Swipe Statistics');
    logger.log(`Total profiles: ${stats.total}`, logger.LOG_LEVELS.INFO, 'STATS');
    logger.log(`Right swipes: ${stats.right} (${stats.rightPercentage.toFixed(1)}% of total)`, logger.LOG_LEVELS.INFO, 'STATS');
    logger.log(`  - From alignment: ${stats.alignmentCount} (${stats.alignmentPercentage.toFixed(1)}% of right swipes)`, logger.LOG_LEVELS.INFO, 'STATS');
    logger.log(`  - From fallback: ${stats.fallbackCount} (${stats.fallbackPercentage.toFixed(1)}% of right swipes)`, logger.LOG_LEVELS.INFO, 'STATS');
}

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
    totalSwipes++;
    
    // Step 1: If profile is not verified, always swipe left
    if (!isVerified) {
        logger.log('Profile is not verified, swiping left', logger.LOG_LEVELS.WARNING, 'DECISION');
        logSwipeStats();
        return 'left';
    }
    
    // Step 2: Check if both bio and attributes are missing, swipe left
    if (!profileInfo.hasBio && (!profileInfo.attributes || profileInfo.attributes.length === 0)) {
        logger.log('Both bio and attributes are missing, swiping left', logger.LOG_LEVELS.WARNING, 'DECISION');
        logSwipeStats();
        return 'left';
    }
    
    // Step 3: If bio is required but not present, swipe left
    if (userPreferences.requireBio && !profileInfo.hasBio) {
        logger.log('No bio found, swiping left', logger.LOG_LEVELS.WARNING, 'DECISION');
        logSwipeStats();
        return 'left';
    }
    
    // Step 4: Check for keywords to avoid
    let textToCheck = profileInfo.bio || '';
    
    // Add attributes to the text to check if they exist
    if (profileInfo.attributes && profileInfo.attributes.length > 0) {
        textToCheck += ' ' + profileInfo.attributes.join(' ');
    }
    
    // Add full text if available as fallback
    if (profileInfo.fullText) {
        textToCheck += ' ' + profileInfo.fullText;
    }
    
    const keywordCheckResult = checkAvoidKeywords(
        textToCheck, 
        userPreferences.avoidKeywords
    );
    
    if (keywordCheckResult.shouldAvoid) {
        logger.log(`Found avoid keywords: ${keywordCheckResult.foundKeywords.join(', ')}, swiping left`, 
                  logger.LOG_LEVELS.WARNING, 'DECISION');
        logSwipeStats();
        return 'left';
    }
    
    // Step 5: Analyze alignment with user interests
    const alignmentResult = await analyzeProfileAlignment(profileInfo, userPreferences);
    
    if (alignmentResult.isAligned) {
        rightSwipes++;
        alignmentRightSwipes++;
        logger.log(`Profile is aligned with interests (${alignmentResult.alignmentLevel}), swiping right`, 
                  logger.LOG_LEVELS.SUCCESS, 'DECISION');
        logger.log(`✨ Interest-based right swipe`, logger.LOG_LEVELS.SUCCESS, 'DECISION');
        logSwipeStats();
        return 'right';
    }
    
    // Step 6: If profile is verified but not aligned, use 18% right swipe fallback
    // This maintains the optimal Elo-based ratio for non-aligned but verified profiles
    const randomChance = Math.random();
    if (randomChance <= 0.18) { // 18% chance to swipe right
        rightSwipes++;
        fallbackRightSwipes++;
        logger.log(`Profile not well aligned (${alignmentResult.alignmentLevel}) but applying 18% right swipe chance`, 
                  logger.LOG_LEVELS.SUCCESS, 'DECISION');
        logger.log(`🎲 Fallback algorithm right swipe (${(randomChance * 100).toFixed(1)}% vs 18% threshold)`, 
                  logger.LOG_LEVELS.SUCCESS, 'DECISION');
        logSwipeStats();
        return 'right';
    }
    
    logger.log(`Profile not aligned (${alignmentResult.alignmentLevel}) and didn't meet 18% chance`, 
              logger.LOG_LEVELS.WARNING, 'DECISION');
    logger.log(`❌ Fallback check failed (${(randomChance * 100).toFixed(1)}% > 18% threshold)`, 
              logger.LOG_LEVELS.WARNING, 'DECISION');
    logSwipeStats();
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
        
        // Get delay range from config
        const minDelay = config.swiping.delays.afterSwipe.min;
        const maxRandomDelay = config.swiping.delays.afterSwipe.max - minDelay;
        
        // Wait a bit after swiping with randomized delay
        await delay(minDelay + Math.random() * maxRandomDelay);
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