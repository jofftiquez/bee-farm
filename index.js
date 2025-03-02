// Main application for Bumble automation
const path = require('path');
const fs = require('fs').promises;

// Import modules
const { delay, question, rl, simulateProfileCheck, ensureDirectoryExists, clickAtPosition } = require('./lib/utils');
const { initBrowser, checkLoginStatus, waitForLogin, closeBrowser } = require('./lib/browser');
const { findActionButtons, testButtons, handleMatchNotification } = require('./lib/ui-detection');
const { isProfilePhotoVerified } = require('./lib/profile-verification');
const { processProfile } = require('./lib/swipe-logic');
const { setupSignalHandlers } = require('./lib/cleanup');

// Variables to track resources that need cleanup
let browser = null;

// Cleanup function to delete screenshot and close resources
async function cleanup() {
    console.log('\nCleaning up resources...');
    
    // Close readline interface
    if (rl) {
        rl.close();
    }
    
    // Close browser if open
    if (browser) {
        try {
            await closeBrowser();
            console.log('Browser closed.');
        } catch (err) {
            // Browser might already be closed
        }
    }
    
    console.log('Cleanup complete. Goodbye!');
}

(async () => {
    try {
        // Create screenshots directory
        const screenshotDir = path.join(process.cwd(), 'screenshots');
        await ensureDirectoryExists(screenshotDir);
        
        // Initialize the browser
        console.log('Initializing browser...');
        const result = await initBrowser();
        browser = result.browser;
        const page = result.page;
        
        // Set up signal handlers for graceful shutdown
        setupSignalHandlers(browser, closeBrowser);
        
        // Check if we're already logged in
        console.log('Checking authentication status...');
        const isLoggedIn = await checkLoginStatus(page);
        
        if (isLoggedIn) {
            console.log('✅ Already logged in! Session was successfully restored.');
        } else {
            console.log('⚠️ Not logged in. Please log into Bumble when the browser opens.');
            console.log('Your login will be remembered for future sessions.');
            
            // Wait for login to complete
            await waitForLogin(page);
        }

        console.log('\n==== AUTOMATIC BUTTON DETECTION ====');
        console.log('Please navigate to the swiping interface if not already there.');
        
        await question('Press Enter when you are ready and have a profile visible...');
        
        // Find the action buttons
        const { buttonPositions, screenshotPath } = await findActionButtons(page, screenshotDir);
        
        // Allow user to test the button positions
        console.log('\n==== BUTTON TEST ====');
        const shouldTest = await question('Do you want to test the button positions? (y/n): ');
        
        if (shouldTest.toLowerCase() === 'y') {
            await testButtons(page, buttonPositions);
        }
        
        // Allow user to set like probability
        console.log('\n==== ALGORITHM SETTINGS ====');
        console.log('Based on the Elo rating system analysis, the optimal right swipe ratio is 18%');
        const likePercentage = await question('Enter percentage chance to like profiles (default: 18): ') || 18;
        
        // Document rest time feature
        console.log('\n==== REST TIME FEATURE ====');
        console.log('To simulate natural human behavior, the bot will:');
        console.log('- Take a break every 15-20 minutes (randomly determined)');
        console.log('- Rest for 5-10 minutes during each break (randomly determined)');
        console.log('- Completely stop activity during rest periods');
        console.log('- Resume automatically after the rest period ends');
        console.log('This helps make the swiping pattern look more natural and reduces the risk of detection.');
        console.log('==============================\n');
        
        // Track swipe patterns to maintain optimal distribution
        let swipeCount = 0;
        let likesCount = 0;
        const likeChance = parseInt(likePercentage) / 100;
        
        console.log(`\nStarting swipe loop with ${likePercentage}% chance to like...`);
        console.log('👍 button: ' + JSON.stringify({x: buttonPositions.likeButtonX, y: buttonPositions.likeButtonY}));
        console.log('👎 button: ' + JSON.stringify({x: buttonPositions.passButtonX, y: buttonPositions.passButtonY}));
        
        while (true) {
            swipeCount++;
            
            // First check if profile is photo verified before doing any profile interactions
            console.log(`\n[${swipeCount}] Checking if profile is photo verified...`);
            const isPhotoVerified = await isProfilePhotoVerified(page, screenshotDir);
            
            // If not photo verified, immediately swipe left without profile checking
            if (!isPhotoVerified) {
                console.log(`[${swipeCount}] ❌ Profile is NOT photo verified - Automatically swiping Left (PASS)`);
                await processProfile(page, buttonPositions, false);
                
                // Add random delay between swipes
                const waitTime = Math.random() * 3000 + 800;
                await delay(waitTime);
                continue; // Skip to next profile
            }
            
            // Profile is verified - proceed with normal decision logic
            console.log(`[${swipeCount}] ✅ Profile IS photo verified - Checking profile details...`);
            
            // Only simulate profile check for verified profiles
            await simulateProfileCheck(page);
            
            // Calculate current like ratio
            const currentLikeRatio = likesCount / swipeCount;
            
            // Dynamic probability adjustment to maintain target ratio
            let adjustedLikeChance = likeChance;
            
            // If we've swiped enough to have meaningful data
            if (swipeCount > 10) {
                // If we're liking too much, reduce chance to like
                if (currentLikeRatio > likeChance) {
                    adjustedLikeChance = Math.max(0.05, likeChance * 0.9);
                } 
                // If we're liking too little, increase chance to like
                else if (currentLikeRatio < likeChance * 0.8) {
                    adjustedLikeChance = Math.min(0.3, likeChance * 1.1);
                }
            }
            
            // Occasionally introduce randomness to avoid pattern detection
            if (swipeCount % 10 === 0) {
                // Every 10 swipes, mix it up a bit
                adjustedLikeChance = Math.random();
            }
            
            const shouldLike = Math.random() < adjustedLikeChance;
            
            if (shouldLike) {
                console.log(`[${swipeCount}] Decision: Swiping Right (LIKE) - Current ratio: ${Math.round(currentLikeRatio * 100)}%`);
                await processProfile(page, buttonPositions, true);
                likesCount++;
                
                // After liking, check for match notification and handle it
                console.log('Checking for match notification...');
                await handleMatchNotification(page);
            } else {
                console.log(`[${swipeCount}] Decision: Swiping Left (PASS) - Current ratio: ${Math.round(currentLikeRatio * 100)}%`);
                await processProfile(page, buttonPositions, false);
            }
            
            // Add random delay between swipes (more variance for natural behavior)
            const waitTime = Math.random() * 3000 + 800;
            await delay(waitTime);
            
            // Every 50 swipes, display statistics
            if (swipeCount % 50 === 0) {
                console.log(`\n==== SWIPE STATISTICS ====`);
                console.log(`Total swipes: ${swipeCount}`);
                console.log(`Right swipes: ${likesCount} (${Math.round(currentLikeRatio * 100)}%)`);
                console.log(`Left swipes: ${swipeCount - likesCount} (${Math.round((1 - currentLikeRatio) * 100)}%)`);
                console.log(`Target right swipe ratio: ${likePercentage}%`);
                console.log(`=========================\n`);
            }
            
            // Implement rest periods to simulate natural usage patterns
            // Track the time spent swiping
            if (!global.swipeStartTime) {
                global.swipeStartTime = Date.now();
                global.lastRestTime = Date.now();
            }
            
            // Check if it's time for a rest period (every 15-20 minutes)
            const minutesSinceLastRest = (Date.now() - global.lastRestTime) / (1000 * 60);
            const restFrequency = Math.floor(Math.random() * 6) + 15; // 15-20 minutes
            
            if (minutesSinceLastRest >= restFrequency) {
                // Time for a rest period
                const restDuration = Math.floor(Math.random() * 6) + 5; // 5-10 minutes
                
                console.log(`\n==== REST PERIOD ====`);
                console.log(`Taking a break for ${restDuration} minutes to simulate natural behavior.`);
                console.log(`Will resume swiping at ${new Date(Date.now() + restDuration * 60 * 1000).toLocaleTimeString()}`);
                console.log(`======================\n`);
                
                // Wait for the rest duration
                await delay(restDuration * 60 * 1000);
                
                // Update last rest time
                global.lastRestTime = Date.now();
                
                console.log(`\n==== RESUMING ACTIVITY ====`);
                console.log(`Rest period complete. Resuming swiping...`);
                console.log(`=============================\n`);
            }
        }
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        // Clean up resources when script finishes
        await cleanup();
    }
})();
