// Main application for Bumble automation with anti-detection measures
const path = require('path');
const fs = require('fs').promises;

// Import modules
const { delay, question, rl, simulateProfileCheck, ensureDirectoryExists, loadUserPreferences, clickAtPosition } = require('./lib/utils');
const { initBrowser, checkLoginStatus, waitForLogin, closeBrowser } = require('./lib/browser');
const { findActionButtons, testButtons, handleMatchNotification } = require('./lib/ui-detection');
const { isProfilePhotoVerified } = require('./lib/profile-verification');
const { processProfile } = require('./lib/swipe-logic');
const { setupSignalHandlers } = require('./lib/cleanup');
const { extractProfileInfo } = require('./lib/profile-analysis');
const { saveSession, loadSession, scheduleSessionSaving, getSessionFingerprint } = require('./lib/session');
const logger = require('./lib/logger');

// Variables to track resources that need cleanup
let browser = null;
let userPreferences = null;
let clearSessionInterval = null;

// Cleanup function to delete screenshot and close resources
async function cleanup() {
    logger.section('Cleanup');
    
    // Cancel the session saving interval if it exists
    if (clearSessionInterval) {
        clearSessionInterval();
        logger.log('Session saving stopped', logger.LOG_LEVELS.DEBUG, 'CLEANUP');
    }
    
    // Save the session before closing
    if (browser && browser.page) {
        try {
            await saveSession(browser.page);
            logger.log('Final session state saved', logger.LOG_LEVELS.SUCCESS, 'CLEANUP');
        } catch (error) {
            logger.log(`Error saving final session: ${error.message}`, logger.LOG_LEVELS.ERROR, 'CLEANUP');
        }
    }
    
    // Close readline interface
    if (rl) {
        rl.close();
    }
    
    // Close browser if open
    if (browser) {
        try {
            await closeBrowser();
            logger.log('Browser closed.', logger.LOG_LEVELS.SUCCESS, 'CLEANUP');
        } catch (err) {
            // Browser might already be closed
        }
    }
    
    logger.log('Cleanup complete. Goodbye!', logger.LOG_LEVELS.SUCCESS, 'CLEANUP');
}

(async () => {
    try {
        logger.section('Startup');
        
        // Create screenshots directory
        const screenshotDir = path.join(process.cwd(), 'screenshots');
        await ensureDirectoryExists(screenshotDir);
        logger.log(`Screenshots directory: ${screenshotDir}`, logger.LOG_LEVELS.INFO, 'SETUP');
        
        // Path for user preferences file
        const preferencesFilePath = path.join(process.cwd(), 'user_preferences.json');
        
        // Load user preferences or prompt user to create them
        userPreferences = await loadUserPreferences(preferencesFilePath);
        
        // Get session fingerprint for more consistent sessions
        const fingerprint = await getSessionFingerprint();
        logger.log(`Session fingerprint: ${fingerprint}`, logger.LOG_LEVELS.DEBUG, 'SESSION');
        
        // Load session cookies if available
        logger.log('Checking for saved session...', logger.LOG_LEVELS.INFO, 'SESSION');
        const cookies = await loadSession();
        
        // Browser dimensions set for full screen mode
        const browserDimensions = {
            width: 1920,  // Higher resolution for modern screens
            height: 1080  // Will be maximized using --start-maximized flag
        };
        
        // Initialize the browser with cookies if available
        logger.log('Initializing browser...', logger.LOG_LEVELS.INFO, 'SETUP');
        const result = await initBrowser({
            cookies: cookies,
            windowSize: browserDimensions,
            // Randomize slowMo slightly for more natural interaction
            slowMo: Math.floor(Math.random() * 10) + 5
        });
        
        browser = result.browser;
        const page = result.page;
        
        // Set up session saving at regular intervals
        clearSessionInterval = scheduleSessionSaving(page);
        
        // Set up signal handlers for graceful shutdown
        setupSignalHandlers(browser, cleanup);
        
        // Check if we're already logged in
        logger.log('Checking authentication status...', logger.LOG_LEVELS.INFO, 'AUTH');
        const isLoggedIn = await checkLoginStatus(page);
        
        if (isLoggedIn) {
            logger.log('Already logged in! Session was successfully restored.', logger.LOG_LEVELS.SUCCESS, 'AUTH');
            
            // Save session after successful login
            await saveSession(page);
        } else {
            logger.log('Not logged in. Please log into Bumble when the browser opens.', logger.LOG_LEVELS.WARNING, 'AUTH');
            logger.log('Your login will be remembered for future sessions.', logger.LOG_LEVELS.INFO, 'AUTH');
            
            // Wait for login to complete
            await waitForLogin(page);
            
            // Save session after manual login
            await saveSession(page);
        }

        logger.section('Button Detection');
        logger.log('Please navigate to the swiping interface if not already there.', logger.LOG_LEVELS.INFO, 'SETUP');
        
        // Randomize the prompt to avoid detection patterns
        const promptMessages = [
            'Press Enter when you are ready and have a profile visible...',
            'Navigate to the swiping screen and press Enter when ready...',
            'When you can see profiles to swipe on, press Enter to continue...'
        ];
        
        const randomPrompt = promptMessages[Math.floor(Math.random() * promptMessages.length)];
        await question(randomPrompt);
        
        // Find the action buttons
        const { buttonPositions, screenshotPath } = await findActionButtons(page, screenshotDir);
        
        // Allow user to test the button positions
        logger.section('Button Test');
        const shouldTest = await question('Do you want to test the button positions? (Y/n): ');
        
        if (shouldTest.toLowerCase() === 'y') {
            await testButtons(page, buttonPositions);
        }
        
        // Display user preferences
        logger.displayPreferences(userPreferences);
        
        // Track swipe patterns to maintain optimal distribution
        let swipeCount = 0;
        let likesCount = 0;
        let sessionStartTime = Date.now();
        
        // Session limits to avoid detection (randomized)
        const maxSessionTime = (Math.floor(Math.random() * 30) + 45) * 60 * 1000; // 45-75 minutes
        const maxSwipes = Math.floor(Math.random() * 50) + 50; // 50-100 swipes per session
        
        logger.section('Starting Swipe Loop');
        logger.log(`👍 button: (${buttonPositions.likeButtonX}, ${buttonPositions.likeButtonY})`, logger.LOG_LEVELS.INFO, 'BUTTONS');
        logger.log(`👎 button: (${buttonPositions.passButtonX}, ${buttonPositions.passButtonY})`, logger.LOG_LEVELS.INFO, 'BUTTONS');
        logger.log(`Session limits: ${Math.round(maxSessionTime/60000)} minutes or ${maxSwipes} swipes`, logger.LOG_LEVELS.INFO, 'SESSION');
        
        while (true) {
            // Check session limits to avoid detection
            const sessionTimeElapsed = Date.now() - sessionStartTime;
            if (sessionTimeElapsed >= maxSessionTime) {
                logger.log(`Session time limit reached (${Math.round(sessionTimeElapsed/60000)} minutes). Ending session.`, 
                          logger.LOG_LEVELS.WARNING, 'SESSION');
                break;
            }
            
            if (swipeCount >= maxSwipes) {
                logger.log(`Session swipe limit reached (${swipeCount} swipes). Ending session.`, 
                          logger.LOG_LEVELS.WARNING, 'SESSION');
                break;
            }
            
            swipeCount++;
            
            logger.section(`Profile #${swipeCount}`);
            
            // First check if profile is photo verified before doing any profile interactions
            const isPhotoVerified = await isProfilePhotoVerified(page, screenshotDir);
            
            // Extract profile information regardless of verification status
            const profileInfo = await extractProfileInfo(page, screenshotDir);
            
            // If not photo verified, immediately swipe left without profile checking
            if (!isPhotoVerified) {
                logger.log(`Profile is NOT photo verified - Automatically swiping Left (PASS)`, 
                          logger.LOG_LEVELS.WARNING, 'PROFILE');
                          
                await processProfile(page, buttonPositions, false, profileInfo, userPreferences);
                
                // Add random delay between swipes with more variability to appear human
                const waitTime = Math.random() * 3000 + 800;
                await delay(waitTime);
                continue; // Skip to next profile
            }
            
            // Profile is verified - proceed with bio analysis
            logger.log(`Profile IS photo verified - Proceeding with analysis...`, 
                      logger.LOG_LEVELS.SUCCESS, 'PROFILE');
            
            // Simulate a real user checking the profile
            await simulateProfileCheck(page);
            
            // Process the profile based on the extracted information and preferences
            const swipeDirection = await processProfile(page, buttonPositions, isPhotoVerified, profileInfo, userPreferences);
            
            // Update stats if we swiped right
            if (swipeDirection === 'right') {
                likesCount++;
                
                // After liking, check for match notification and handle it
                logger.log('Checking for match notification...', logger.LOG_LEVELS.INFO, 'MATCH');
                await handleMatchNotification(page);
            }
            
            // Every 8-12 profiles, save the session to mimic browser behavior
            if (swipeCount % (Math.floor(Math.random() * 5) + 8) === 0) {
                await saveSession(page);
            }
            
            // Add random delay between swipes (more variance for natural behavior)
            const minDelay = 800; // Minimum 0.8 seconds
            const maxRandomDelay = 5000; // Up to 5 additional seconds
            
            // Use a non-uniform distribution to occasionally have longer pauses
            let waitTime;
            if (Math.random() < 0.8) {
                // 80% of the time, use a shorter delay (0.8-3 seconds)
                waitTime = Math.random() * 2200 + minDelay;
            } else {
                // 20% of the time, use a longer delay (3-6 seconds)
                waitTime = Math.random() * maxRandomDelay + 3000;
            }
            
            await delay(waitTime);
            
            // Every 10 swipes, display statistics
            if (swipeCount % 10 === 0) {
                logger.displayStats(swipeCount, likesCount);
                
                // Calculate and log session metrics
                const elapsedMinutes = Math.round((Date.now() - sessionStartTime) / 60000);
                const remainingSwipes = maxSwipes - swipeCount;
                const remainingMinutes = Math.round((maxSessionTime - (Date.now() - sessionStartTime)) / 60000);
                
                logger.log(`Session progress: ${elapsedMinutes} minutes elapsed, ${remainingMinutes} minutes remaining`, 
                          logger.LOG_LEVELS.INFO, 'SESSION');
                logger.log(`Swipe progress: ${swipeCount}/${maxSwipes} (${remainingSwipes} remaining)`, 
                          logger.LOG_LEVELS.INFO, 'SESSION');
            }
            
            // Implement rest periods to simulate natural usage patterns
            // Track the time spent swiping
            if (!global.swipeStartTime) {
                global.swipeStartTime = Date.now();
                global.lastRestTime = Date.now();
            }
            
            // Check if it's time for a rest period (every 15-20 minutes)
            const minutesSinceLastRest = (Date.now() - global.lastRestTime) / (1000 * 60);
            
            // More random rest frequency to avoid patterns
            const restFrequency = Math.floor(Math.random() * 8) + 13; // 13-20 minutes
            
            if (minutesSinceLastRest >= restFrequency) {
                // Time for a rest period
                // More random duration
                const restDuration = Math.floor(Math.random() * 8) + 3; // 3-10 minutes
                
                logger.section('Rest Period');
                logger.log(`Taking a break for ${restDuration} minutes to simulate natural behavior.`, 
                          logger.LOG_LEVELS.INFO, 'REST');
                logger.log(`Will resume swiping at ${new Date(Date.now() + restDuration * 60 * 1000).toLocaleTimeString()}`, 
                          logger.LOG_LEVELS.INFO, 'REST');
                
                // Save session before taking a break
                await saveSession(page);
                
                // Wait for the rest duration
                await delay(restDuration * 60 * 1000);
                
                // Update last rest time
                global.lastRestTime = Date.now();
                
                logger.section('Resuming Activity');
                logger.log(`Rest period complete. Resuming swiping...`, logger.LOG_LEVELS.SUCCESS, 'REST');
            }
        }
        
        logger.section('Session Complete');
        logger.log(`Session ended after ${swipeCount} swipes (${likesCount} likes)`, logger.LOG_LEVELS.SUCCESS, 'SESSION');
        logger.log(`Session duration: ${Math.round((Date.now() - sessionStartTime) / 60000)} minutes`, logger.LOG_LEVELS.INFO, 'SESSION');
        
        // Save final session
        await saveSession(page);
        
    } catch (error) {
        logger.log(`An error occurred: ${error.message}`, logger.LOG_LEVELS.ERROR, 'SYSTEM');
        console.error(error);
    } finally {
        // Clean up resources when script finishes
        await cleanup();
    }
})();
