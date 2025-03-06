// Main application for Bee Farm - a Bumble Automation with anti-detection measures
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
const config = require('./lib/config');

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
            // Ensure we save both normal and all cookies
            await saveSession(browser.page);
            logger.log('Final session state saved', logger.LOG_LEVELS.SUCCESS, 'CLEANUP');
            
            // Additional check - verify that cookies are saved properly
            try {
                const cookies = await browser.page.cookies();
                if (cookies && cookies.length > 0) {
                    logger.log(`Verified ${cookies.length} cookies before closing`, logger.LOG_LEVELS.DEBUG, 'CLEANUP');
                } else {
                    logger.log('Warning: No cookies found to save', logger.LOG_LEVELS.WARNING, 'CLEANUP');
                }
            } catch (cookieError) {
                logger.log(`Cookie verification error: ${cookieError.message}`, logger.LOG_LEVELS.ERROR, 'CLEANUP');
            }
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
        
        // No longer creating screenshots directory for privacy reasons
        
        // Path for user preferences file
        const preferencesFilePath = path.join(process.cwd(), 'user_preferences.json');
        
        // Load user preferences or prompt user to create them
        userPreferences = await loadUserPreferences(preferencesFilePath);
        
        // Ask for the swipe right percentage and verified profile requirement 
        // every time the script runs, even if preferences file already exists
        logger.section('Session Settings');
        
        // Ask about requiring verified profiles
        const requireVerifiedPrompt = await question(
            `Only swipe right on verified profiles? (Y/n, current: ${userPreferences.requireVerified ? 'YES' : 'NO'}): `
        );
        if (requireVerifiedPrompt.trim() !== '') {
            userPreferences.requireVerified = requireVerifiedPrompt.toLowerCase() !== 'n';
            logger.log(`Verified profiles requirement updated to: ${userPreferences.requireVerified ? 'YES' : 'NO'}`, logger.LOG_LEVELS.INFO, 'SETTINGS');
        }
        
        // Ask for the swipe right percentage (using config default)
        const currentSwipeRight = userPreferences.swipeRightPercentage || config.swiping.defaultSwipeRightPercentage;
        const swipeRightPrompt = await question(
            `Enter swipe right percentage (1-100, current: ${currentSwipeRight}%, default: ${config.swiping.defaultSwipeRightPercentage}%): `
        );
        if (swipeRightPrompt.trim() !== '') {
            const swipeRightPercentage = parseInt(swipeRightPrompt, 10);
            if (!isNaN(swipeRightPercentage) && swipeRightPercentage >= 1 && swipeRightPercentage <= 100) {
                userPreferences.swipeRightPercentage = swipeRightPercentage;
                logger.log(`Swipe right percentage updated to: ${swipeRightPercentage}%`, logger.LOG_LEVELS.INFO, 'SETTINGS');
            } else {
                logger.log(`Invalid swipe right percentage, keeping current value: ${currentSwipeRight}%`, logger.LOG_LEVELS.WARNING, 'SETTINGS');
            }
        } else {
            logger.log(`Using swipe right percentage: ${currentSwipeRight}%`, logger.LOG_LEVELS.INFO, 'SETTINGS');
        }
        
        // Ask if the user wants to use LLM mode
        if (!userPreferences.llmSettings) {
            userPreferences.llmSettings = {
                enabled: false,
                minComparisonScore: 0.6
            };
        }
        
        const currentLlmEnabled = userPreferences.llmSettings.enabled;
        const useLlmPrompt = await question(
            `Use Llama 3 for advanced profile compatibility analysis? (y/N, current: ${currentLlmEnabled ? 'YES' : 'NO'}): `
        );
        
        if (useLlmPrompt.trim() !== '') {
            userPreferences.llmSettings.enabled = useLlmPrompt.toLowerCase() === 'y';
            logger.log(`Llama 3 analysis ${userPreferences.llmSettings.enabled ? 'ENABLED' : 'DISABLED'}`, 
                userPreferences.llmSettings.enabled ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.INFO, 
                'SETTINGS');
        }
        
        // Always ask for the minimum comparison score if LLM is enabled
        if (userPreferences.llmSettings.enabled) {
            const currentMinScore = userPreferences.llmSettings.minComparisonScore;
            const minScorePrompt = await question(
                `Enter minimum LLM compatibility score (0.0-1.0, current: ${currentMinScore}): `
            );
            
            if (minScorePrompt.trim() !== '') {
                const minScore = parseFloat(minScorePrompt);
                if (!isNaN(minScore) && minScore >= 0 && minScore <= 1) {
                    userPreferences.llmSettings.minComparisonScore = minScore;
                    logger.log(`Minimum LLM score updated to: ${minScore}`, logger.LOG_LEVELS.INFO, 'SETTINGS');
                } else {
                    logger.log(`Invalid minimum score, keeping current value: ${currentMinScore}`, logger.LOG_LEVELS.WARNING, 'SETTINGS');
                }
            } else {
                logger.log(`Using minimum LLM score: ${currentMinScore}`, logger.LOG_LEVELS.INFO, 'SETTINGS');
            }
            
            // Verify if Llama is accessible
            logger.log('Verifying Llama 3 API connection...', logger.LOG_LEVELS.INFO, 'SETTINGS');
            try {
                const llmIntegration = require('./lib/llm-integration');
                const isConnected = await llmIntegration.checkLlamaApiConnection();
                
                if (isConnected) {
                    logger.log('Llama API connection successful ✅', logger.LOG_LEVELS.SUCCESS, 'SETTINGS');
                } else {
                    logger.log('Warning: Could not connect to Llama API', logger.LOG_LEVELS.WARNING, 'SETTINGS');
                    logger.log('LLM analysis will be skipped if connection is not available during runtime', logger.LOG_LEVELS.WARNING, 'SETTINGS');
                    logger.log('See llm-integration-readme.md for setup instructions', logger.LOG_LEVELS.INFO, 'SETTINGS');
                }
            } catch (error) {
                logger.log(`Warning: Error checking Llama API: ${error.message}`, logger.LOG_LEVELS.WARNING, 'SETTINGS');
                logger.log('LLM analysis will be skipped if connection is not available during runtime', logger.LOG_LEVELS.WARNING, 'SETTINGS');
                logger.log('See llm-integration-readme.md for setup instructions', logger.LOG_LEVELS.INFO, 'SETTINGS');
            }
        }
        
        // Ask if age matters for profile matching
        if (userPreferences.agePreference === undefined) {
            userPreferences.agePreference = {
                enabled: false,
                minAge: 18,
                maxAge: 45
            };
        }
        
        const ageMattersPrompt = await question(
            `Does age matter for profile matching? (y/N, current: ${userPreferences.agePreference.enabled ? 'YES' : 'NO'}): `
        );
        
        if (ageMattersPrompt.trim() !== '') {
            userPreferences.agePreference.enabled = ageMattersPrompt.toLowerCase() === 'y';
            logger.log(`Age preference ${userPreferences.agePreference.enabled ? 'ENABLED' : 'DISABLED'}`, 
                userPreferences.agePreference.enabled ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.INFO, 
                'SETTINGS');
            
            // If enabled, ask for age range
            if (userPreferences.agePreference.enabled) {
                const currentMinAge = userPreferences.agePreference.minAge;
                const minAgePrompt = await question(
                    `Enter minimum age (18+, current: ${currentMinAge}): `
                );
                
                if (minAgePrompt.trim() !== '') {
                    const minAge = parseInt(minAgePrompt, 10);
                    if (!isNaN(minAge) && minAge >= 18) {
                        userPreferences.agePreference.minAge = minAge;
                        logger.log(`Minimum age updated to: ${minAge}`, logger.LOG_LEVELS.INFO, 'SETTINGS');
                    }
                }
                
                const currentMaxAge = userPreferences.agePreference.maxAge;
                const maxAgePrompt = await question(
                    `Enter maximum age (current: ${currentMaxAge}): `
                );
                
                if (maxAgePrompt.trim() !== '') {
                    const maxAge = parseInt(maxAgePrompt, 10);
                    if (!isNaN(maxAge) && maxAge >= userPreferences.agePreference.minAge) {
                        userPreferences.agePreference.maxAge = maxAge;
                        logger.log(`Maximum age updated to: ${maxAge}`, logger.LOG_LEVELS.INFO, 'SETTINGS');
                    }
                }
            }
        }
        
        // Ask if location matters for profile matching
        if (userPreferences.locationPreference === undefined) {
            userPreferences.locationPreference = {
                enabled: false,
                preferredLocations: []
            };
        }
        
        const locationMattersPrompt = await question(
            `Does location matter for profile matching? (y/N, current: ${userPreferences.locationPreference.enabled ? 'YES' : 'NO'}): `
        );
        
        if (locationMattersPrompt.trim() !== '') {
            userPreferences.locationPreference.enabled = locationMattersPrompt.toLowerCase() === 'y';
            logger.log(`Location preference ${userPreferences.locationPreference.enabled ? 'ENABLED' : 'DISABLED'}`, 
                userPreferences.locationPreference.enabled ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.INFO, 
                'SETTINGS');
            
            // If enabled, ask for preferred locations
            if (userPreferences.locationPreference.enabled) {
                const currentLocations = userPreferences.locationPreference.preferredLocations.join(', ') || 'None';
                const locationsPrompt = await question(
                    `Enter preferred locations (comma-separated, current: ${currentLocations}): `
                );
                
                if (locationsPrompt.trim() !== '') {
                    userPreferences.locationPreference.preferredLocations = locationsPrompt
                        .split(',')
                        .map(location => location.trim())
                        .filter(location => location.length > 0);
                    logger.log(`Preferred locations updated: ${userPreferences.locationPreference.preferredLocations.join(', ')}`, logger.LOG_LEVELS.INFO, 'SETTINGS');
                }
            }
        }
        
        // Save the updated user preferences
        await fs.writeFile(preferencesFilePath, JSON.stringify(userPreferences, null, 2));
        logger.log('User preferences saved.', logger.LOG_LEVELS.SUCCESS, 'SETTINGS');
        
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
        const { buttonPositions } = await findActionButtons(page);
        
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
        let totalSessionsCompleted = 0;
        
        while (true) { // Outer loop for multiple sessions
            // Session limits to avoid detection (randomized)
            const maxSessionMinutes = Math.floor(Math.random() * 
                (config.swiping.session.duration.max - config.swiping.session.duration.min + 1)) 
                + config.swiping.session.duration.min;
            const maxSessionTime = maxSessionMinutes * 60 * 1000; // Convert to milliseconds
            
            const maxSwipes = Math.floor(Math.random() * 
                (config.swiping.session.maxSwipes.max - config.swiping.session.maxSwipes.min + 1)) 
                + config.swiping.session.maxSwipes.min;
            
            logger.section('Starting Swipe Loop');
            logger.log(`👍 button: (${buttonPositions.likeButtonX}, ${buttonPositions.likeButtonY})`, logger.LOG_LEVELS.INFO, 'BUTTONS');
            logger.log(`👎 button: (${buttonPositions.passButtonX}, ${buttonPositions.passButtonY})`, logger.LOG_LEVELS.INFO, 'BUTTONS');
            logger.log(`Session #${totalSessionsCompleted + 1} limits: ${maxSessionMinutes} minutes or ${maxSwipes} swipes`, logger.LOG_LEVELS.INFO, 'SESSION');
            
            let sessionEnded = false;
            swipeCount = 0;
            likesCount = 0;
            sessionStartTime = Date.now();

            while (!sessionEnded) {
                // Check session limits to avoid detection
                const sessionTimeElapsed = Date.now() - sessionStartTime;
                if (sessionTimeElapsed >= maxSessionTime) {
                    logger.log(`Session time limit reached (${Math.round(sessionTimeElapsed/60000)} minutes).`, 
                              logger.LOG_LEVELS.WARNING, 'SESSION');
                    sessionEnded = true;
                    break;
                }
                
                if (swipeCount >= maxSwipes) {
                    logger.log(`Session swipe limit reached (${swipeCount} swipes).`, 
                              logger.LOG_LEVELS.WARNING, 'SESSION');
                    sessionEnded = true;
                    break;
                }
                
                swipeCount++;
                
                // Use a clear section for each profile
                logger.section(`Profile #${swipeCount}`);
                
                // Extract profile information first to get name and age
                const profileInfo = await extractProfileInfo(page);
                
                // Check if profile is photo verified
                const isPhotoVerified = await isProfilePhotoVerified(page);
                
                // Log verification status but let the swipe logic handle the decision
                if (!isPhotoVerified) {
                    if (userPreferences.requireVerified) {
                        logger.log(`Profile is NOT photo verified - Will be rejected based on your preference`,
                                 logger.LOG_LEVELS.WARNING, 'PROFILE');
                    } else {
                        logger.log(`Profile is NOT photo verified - but will be analyzed as per your preference`, 
                                 logger.LOG_LEVELS.INFO, 'PROFILE');
                    }
                } else {
                    logger.log(`Profile IS photo verified`, logger.LOG_LEVELS.SUCCESS, 'PROFILE');
                }
                
                // Simulate a real user checking the profile
                await simulateProfileCheck(page);
                
                // Process the profile based on the extracted information and preferences
                // The swipe-logic.js will handle the verification preference check
                const swipeDirection = await processProfile(page, buttonPositions, isPhotoVerified, profileInfo, userPreferences);
                
                // Add random delay between swipes with more variability to appear human
                await delay(Math.random() * 3000 + 800);
                
                // Update stats if we swiped right
                if (swipeDirection === 'right') {
                    likesCount++;
                    
                    // After liking, check for match notification and handle it
                    logger.log('Checking for match notification...', logger.LOG_LEVELS.INFO, 'MATCH');
                    await handleMatchNotification(page);
                }
                
                // Every 8-12 profiles, save the session to mimic browser behavior
                const sessionSaveFrequency = Math.floor(Math.random() * 
                    (config.swiping.session.sessionSaveFrequency.max - config.swiping.session.sessionSaveFrequency.min + 1)) 
                    + config.swiping.session.sessionSaveFrequency.min;
                    
                if (swipeCount % sessionSaveFrequency === 0) {
                    await saveSession(page);
                }
                
                // Add random delay between swipes with configurable timing
                const shortDelayProb = config.swiping.delays.betweenProfiles.shortDelayProbability;
                
                // Use a non-uniform distribution based on config probabilities
                let waitTime;
                if (Math.random() < shortDelayProb) {
                    // Short delay case
                    const shortDelayMin = config.swiping.delays.betweenProfiles.shortDelay.min;
                    const shortDelayRange = config.swiping.delays.betweenProfiles.shortDelay.max - shortDelayMin;
                    waitTime = Math.random() * shortDelayRange + shortDelayMin;
                } else {
                    // Long delay case
                    const longDelayMin = config.swiping.delays.betweenProfiles.longDelay.min;
                    const longDelayRange = config.swiping.delays.betweenProfiles.longDelay.max - longDelayMin;
                    waitTime = Math.random() * longDelayRange + longDelayMin;
                }
                
                await delay(waitTime);
                
                // Every X swipes, display statistics
                if (swipeCount % config.swiping.session.statsDisplayFrequency === 0) {
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
                
                // Check if it's time for a rest period
                const minutesSinceLastRest = (Date.now() - global.lastRestTime) / (1000 * 60);
                
                // More random rest frequency from config
                const restFrequency = Math.floor(Math.random() * 
                    (config.swiping.restPeriods.frequency.max - config.swiping.restPeriods.frequency.min + 1)) 
                    + config.swiping.restPeriods.frequency.min;
                
                if (minutesSinceLastRest >= restFrequency) {
                    // Time for a rest period
                    // More random duration from config
                    const restDuration = Math.floor(Math.random() * 
                        (config.swiping.restPeriods.duration.max - config.swiping.restPeriods.duration.min + 1)) 
                        + config.swiping.restPeriods.duration.min;
                    
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
            logger.log(`Session #${totalSessionsCompleted + 1} ended after ${swipeCount} swipes (${likesCount} likes)`, logger.LOG_LEVELS.SUCCESS, 'SESSION');
            logger.log(`Session duration: ${Math.round((Date.now() - sessionStartTime) / 60000)} minutes`, logger.LOG_LEVELS.INFO, 'SESSION');
            
            // Save session state
            await saveSession(page);
            
            totalSessionsCompleted++;
            
            // Take a longer rest between sessions (30-60 minutes)
            const betweenSessionRestMinutes = Math.floor(Math.random() * 30) + 30;
            logger.section('Extended Rest Period');
            logger.log(`Taking an extended break between sessions for ${betweenSessionRestMinutes} minutes...`, 
                      logger.LOG_LEVELS.INFO, 'REST');
            logger.log(`Next session (#${totalSessionsCompleted + 1}) will start at ${new Date(Date.now() + betweenSessionRestMinutes * 60 * 1000).toLocaleTimeString()}`, 
                      logger.LOG_LEVELS.INFO, 'REST');
            
            // Save session before extended rest
            await saveSession(page);
            
            // Wait for the extended rest duration
            await delay(betweenSessionRestMinutes * 60 * 1000);
            
            logger.section('Starting New Session');
            logger.log(`Extended rest period complete. Starting session #${totalSessionsCompleted + 1}...`, 
                      logger.LOG_LEVELS.SUCCESS, 'REST');
        }
        
    } catch (error) {
        logger.log(`An error occurred: ${error.message}`, logger.LOG_LEVELS.ERROR, 'SYSTEM');
        console.error(error);
    } finally {
        // Clean up resources when script finishes
        await cleanup();
    }
})();
