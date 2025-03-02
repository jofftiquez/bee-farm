const { delay, clickAtPosition } = require('./utils');

/**
 * Decide whether to swipe left or right on a profile
 * @param {Object} page Puppeteer page object
 * @param {boolean} isVerified Whether the profile is verified
 * @returns {string} 'left' or 'right' based on decision
 */
async function decideSwipeDirection(page, isVerified) {
    console.log('Deciding swipe direction...');
    
    // If profile is not verified, always swipe left
    if (!isVerified) {
        console.log('Profile is not verified, swiping left ⬅️');
        return 'left';
    }
    
    // For verified profiles, implement your own logic here
    // This is a simple example that randomly swipes right 30% of the time
    const randomChance = Math.random();
    if (randomChance < 0.30) {
        console.log('Profile is verified and passed random chance check, swiping right ➡️');
        return 'right';
    }
    
    console.log('Profile is verified but didn\'t pass random chance check, swiping left ⬅️');
    return 'left';
}

/**
 * Perform the actual swiping action
 * @param {Object} page Puppeteer page object
 * @param {string} direction 'left' or 'right'
 * @param {Object} buttonPositions The positions of the like and pass buttons
 */
async function performSwipe(page, direction, buttonPositions) {
    console.log(`Performing ${direction} swipe...`);
    
    try {
        if (direction === 'right') {
            // Click the like button
            console.log('Clicking like button...');
            await clickAtPosition(page, buttonPositions.likeButtonX, buttonPositions.likeButtonY);
        } else {
            // Click the pass button
            console.log('Clicking pass button...');
            await clickAtPosition(page, buttonPositions.passButtonX, buttonPositions.passButtonY);
        }
        
        // Wait a bit after swiping
        await delay(1000 + Math.random() * 1000);
        console.log('Swipe completed');
    } catch (error) {
        console.error('Error while swiping:', error.message);
    }
}

/**
 * Process a single profile
 * @param {Object} page Puppeteer page object
 * @param {Object} buttonPositions The positions of the like and pass buttons
 * @param {boolean} isVerified Whether the profile is verified
 */
async function processProfile(page, buttonPositions, isVerified) {
    try {
        // Decide which way to swipe
        const swipeDirection = await decideSwipeDirection(page, isVerified);
        
        // Perform the swipe
        await performSwipe(page, swipeDirection, buttonPositions);
        
        // Return the direction we swiped for tracking
        return swipeDirection;
    } catch (error) {
        console.error('Error processing profile:', error.message);
        // Default to left swipe on error
        return 'left';
    }
}

module.exports = {
    decideSwipeDirection,
    performSwipe,
    processProfile
}; 