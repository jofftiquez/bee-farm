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
    
    // Get swipe right percentage from user preferences first, fall back to config default
    const swipeRightPercentage = userPreferences.swipeRightPercentage || config.swiping.defaultSwipeRightPercentage;
    // Convert percentage to decimal for comparison (e.g., 20% becomes 0.2)
    const swipeRightThreshold = swipeRightPercentage / 100;
    
    // Step 1: If profile is not verified and user requires verified, swipe left
    if (userPreferences.requireVerified && !isVerified) {
        logger.log('Profile is not verified, swiping left', logger.LOG_LEVELS.WARNING, 'DECISION');
        logSwipeStats();
        return 'left';
    }
    
    // Step 2: Check if profile has any useful information for decision making
    // We now use a more comprehensive check using the combined profile text if available
    const hasUsefulInfo = profileInfo.combinedProfileText?.length > 0 || 
                          profileInfo.hasBio || 
                          (profileInfo.attributes && profileInfo.attributes.length > 0);
    
    if (!hasUsefulInfo) {
        logger.log('Profile has no useful information (bio, attributes, or other profile details), swiping left', 
            logger.LOG_LEVELS.WARNING, 'DECISION');
        logSwipeStats();
        return 'left';
    }
    
    // Step 3: If bio is required but not present, check if we have other substantial information
    if (userPreferences.requireBio && !profileInfo.hasBio) {
        // If we have attributes or other info, we can still consider the profile
        if (profileInfo.hasAttributes || profileInfo.location || 
            (profileInfo.sections && profileInfo.sections.length > 0)) {
            logger.log('No bio found but profile has other information, continuing evaluation', 
                logger.LOG_LEVELS.INFO, 'DECISION');
        } else {
            logger.log('No bio found and no other significant information, swiping left', 
                logger.LOG_LEVELS.WARNING, 'DECISION');
            logSwipeStats();
            return 'left';
        }
    }
    
    // Step 4: Check for keywords to avoid
    // Use the enhanced combined profile text if available
    let textToCheck = '';
    
    if (profileInfo.combinedProfileText) {
        textToCheck = profileInfo.combinedProfileText;
        logger.log('Using combined profile text for keyword analysis', logger.LOG_LEVELS.INFO, 'DECISION');
    } else {
        // Fallback to legacy approach
        textToCheck = profileInfo.bio || '';
        
        // Add attributes to the text to check if they exist
        if (profileInfo.attributes && profileInfo.attributes.length > 0) {
            textToCheck += ' ' + profileInfo.attributes.join(' ');
        }
        
        // Add location if available
        if (profileInfo.location) {
            textToCheck += ' ' + profileInfo.location;
        }
        
        // Add full text if available as fallback
        if (profileInfo.fullText) {
            textToCheck += ' ' + profileInfo.fullText;
        }
    }
    
    const keywordCheckResult = checkAvoidKeywords(
        textToCheck, 
        userPreferences.avoidKeywords
    );
    
    if (keywordCheckResult.shouldAvoid) {
        const reason = `Found avoid keywords: ${keywordCheckResult.foundKeywords.join(', ')}`;
        logger.displayDecision('left', reason, 0);
        logSwipeStats();
        return 'left';
    }
    
    // Step 5: Analyze alignment with user interests
    const alignmentResult = await analyzeProfileAlignment(profileInfo, userPreferences);
    
    if (alignmentResult.isAligned) {
        rightSwipes++;
        alignmentRightSwipes++;
        const reason = `Aligned with interests (${alignmentResult.alignmentLevel})`;
        logger.displayDecision('right', reason, alignmentResult.alignmentScore);
        logSwipeStats();
        return 'right';
    }
    
    // Step 6: If profile is not aligned, use user-defined swipe right percentage as fallback
    const randomChance = Math.random();
    if (randomChance <= swipeRightThreshold) { // Use user-configured threshold
        rightSwipes++;
        fallbackRightSwipes++;
        const reason = `Random chance (${(randomChance * 100).toFixed(1)}% < ${swipeRightPercentage}% threshold)`;
        logger.displayDecision('right', reason, alignmentResult.alignmentScore);
        logSwipeStats();
        return 'right';
    }
    
    const reason = `Not aligned (${alignmentResult.alignmentLevel}) and failed random chance (${(randomChance * 100).toFixed(1)}% > ${swipeRightPercentage}%)`;
    logger.displayDecision('left', reason, alignmentResult.alignmentScore);
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