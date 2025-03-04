const path = require('path');
const { question, delay, clickAtPosition } = require('./utils');
const logger = require('./logger');

/**
 * Wait for DOM elements to be loaded
 * @param {Object} page Puppeteer page object
 * @param {number} maxWaitTime Maximum time to wait in milliseconds
 * @param {number} checkInterval Interval between checks in milliseconds
 * @returns {Promise<boolean>} True if elements are detected
 */
async function waitForElementsToLoad(page, maxWaitTime = 5000, checkInterval = 500) {
    logger.log('Waiting for action buttons to load...', logger.LOG_LEVELS.INFO, 'UI');
    
    const startTime = Date.now();
    let elementsExist = false;
    
    while (Date.now() - startTime < maxWaitTime) {
        // Check if elements exist
        elementsExist = await page.evaluate(() => {
            // Look for any of these selectors that would indicate the page is ready
            const selectors = [
                '[data-qa-role="encounters-action-like"]',
                '[data-qa-role="encounters-action-dislike"]',
                '[aria-label="Like"]',
                '[aria-label="Pass"]',
                '.encounters-action',
                '.profile-card',
                '.encounters-user'
            ];
            
            for (const selector of selectors) {
                if (document.querySelector(selector)) {
                    return true;
                }
            }
            return false;
        });
        
        if (elementsExist) {
            logger.log(`UI elements found after ${Date.now() - startTime}ms`, logger.LOG_LEVELS.SUCCESS, 'UI');
            // Add extra delay to ensure everything is properly rendered
            await delay(1000);
            return true;
        }
        
        // Wait before checking again
        await delay(checkInterval);
    }
    
    logger.log(`Timed out waiting for UI elements after ${maxWaitTime}ms`, logger.LOG_LEVELS.WARNING, 'UI');
    return false;
}

/**
 * Find the like and pass buttons on the Bumble interface with retries
 * @param {Object} page Puppeteer page object
 * @param {number} maxRetries Maximum number of retries before giving up
 * @param {number} retryDelay Delay between retries in ms
 * @returns {Object} Coordinates for the like and pass buttons
 */
async function findActionButtons(page, maxRetries = 3, retryDelay = 3000) {
    logger.log('Finding action buttons...', logger.LOG_LEVELS.INFO, 'UI');
    
    let attempt = 0;
    let buttonsFound = false;
    let buttonPositions = null;
    
    while (attempt < maxRetries && !buttonsFound) {
        if (attempt > 0) {
            logger.log(`Retry ${attempt}/${maxRetries} to find action buttons...`, logger.LOG_LEVELS.INFO, 'UI');
            await delay(retryDelay);
        }
        
        // Wait for the DOM to load properly before trying to find elements
        await waitForElementsToLoad(page, 10000, 1000);
        
        try {
            const result = await findActionButtonsOnce(page);
            if (result.buttonPositions.likeButtonX && result.buttonPositions.passButtonX) {
                buttonPositions = result.buttonPositions;
                buttonsFound = true;
                logger.log(`Successfully found both buttons on attempt ${attempt + 1}`, logger.LOG_LEVELS.SUCCESS, 'UI');
                break;
            }
        } catch (error) {
            logger.log(`Error finding buttons on attempt ${attempt + 1}: ${error.message}`, logger.LOG_LEVELS.ERROR, 'UI');
        }
        
        attempt++;
    }
    
    if (!buttonsFound) {
        logger.log(`Failed to find buttons after ${maxRetries} attempts. Using fallback positions.`, logger.LOG_LEVELS.WARNING, 'UI');
        
        // Fallback to default positions based on typical screen dimensions
        const dimensions = await page.evaluate(() => {
            return { width: window.innerWidth, height: window.innerHeight };
        });
        
        buttonPositions = {
            likeButtonX: Math.round(dimensions.width * 0.75), 
            likeButtonY: Math.round(dimensions.height * 0.85),
            passButtonX: Math.round(dimensions.width * 0.25), 
            passButtonY: Math.round(dimensions.height * 0.85)
        };
        
        logger.log(`Using fallback button positions: LIKE at (${buttonPositions.likeButtonX}, ${buttonPositions.likeButtonY}), PASS at (${buttonPositions.passButtonX}, ${buttonPositions.passButtonY})`, 
                  logger.LOG_LEVELS.WARNING, 'UI');
    }
    
    return { buttonPositions };
}

/**
 * Single attempt to find action buttons
 * @param {Object} page Puppeteer page object
 * @returns {Object} Coordinates for the like and pass buttons
 */
async function findActionButtonsOnce(page) {
    let likePos = null;
    let passPos = null;
    
    // Try to find buttons using the provided data-qa-role attributes
    const buttonsFound = await page.evaluate(() => {
        // Look for the exact attributes the user provided
        const likeButton = document.querySelector('[data-qa-role="encounters-action-like"]');
        const dislikeButton = document.querySelector('[data-qa-role="encounters-action-dislike"]');
        
        // If not found with exact attributes, try other possible selectors
        const likeButtonAlt = likeButton || 
            document.querySelector('[aria-label="Like"]') || 
            document.querySelector('[class*="like-button"]') ||
            document.querySelector('[class*="likeButton"]');
            
        const dislikeButtonAlt = dislikeButton || 
            document.querySelector('[aria-label="Pass"]') || 
            document.querySelector('[class*="dislike-button"]') ||
            document.querySelector('[class*="passButton"]');
        
        const result = {
            found: false,
            like: null,
            pass: null
        };
        
        // Get position of buttons if found
        if (likeButtonAlt) {
            const likeRect = likeButtonAlt.getBoundingClientRect();
            result.like = {
                x: Math.round(likeRect.left + likeRect.width / 2),
                y: Math.round(likeRect.top + likeRect.height / 2),
                found: true,
                selector: likeButton ? 'data-qa-role="encounters-action-like"' : 'alternative selector'
            };
        }
        
        if (dislikeButtonAlt) {
            const dislikeRect = dislikeButtonAlt.getBoundingClientRect();
            result.pass = {
                x: Math.round(dislikeRect.left + dislikeRect.width / 2),
                y: Math.round(dislikeRect.top + dislikeRect.height / 2),
                found: true,
                selector: dislikeButton ? 'data-qa-role="encounters-action-dislike"' : 'alternative selector'
            };
        }
        
        result.found = (result.like && result.like.found) || (result.pass && result.pass.found);
        
        return result;
    });
    
    // If buttons were found, use their coordinates
    if (buttonsFound.found) {
        if (buttonsFound.like && buttonsFound.like.found) {
            likePos = { x: buttonsFound.like.x, y: buttonsFound.like.y };
            logger.log(`Found LIKE button at (${likePos.x}, ${likePos.y}) using ${buttonsFound.like.selector}`, 
                       logger.LOG_LEVELS.SUCCESS, 'UI');
        } else {
            logger.log('Could not find LIKE button automatically.', logger.LOG_LEVELS.WARNING, 'UI');
        }
        
        if (buttonsFound.pass && buttonsFound.pass.found) {
            passPos = { x: buttonsFound.pass.x, y: buttonsFound.pass.y };
            logger.log(`Found PASS button at (${passPos.x}, ${passPos.y}) using ${buttonsFound.pass.selector}`, 
                       logger.LOG_LEVELS.SUCCESS, 'UI');
        } else {
            logger.log('Could not find PASS button automatically.', logger.LOG_LEVELS.WARNING, 'UI');
        }
    } else {
        logger.log('Could not find buttons automatically using data-qa-role attributes.', logger.LOG_LEVELS.WARNING, 'UI');
    }
    
    // If any button wasn't found, fall back to manual entry or suggested positions
    if (!likePos || !passPos) {
        logger.log('\nFalling back to manual coordinate entry...', logger.LOG_LEVELS.INFO, 'UI');
        
        // Get viewport dimensions for intelligent suggestions
        const dimensions = await page.evaluate(() => {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        });
        
        logger.log(`Your browser window size is: ${dimensions.width} x ${dimensions.height}`, logger.LOG_LEVELS.INFO, 'UI');
        
        // Suggest positions based on screen dimensions if needed
        if (!likePos) {
            const suggestedLikeX = Math.round(dimensions.width * 0.75); // Right side
            const suggestedLikeY = Math.round(dimensions.height * 0.85); // Bottom area
            
            logger.log(`Suggested LIKE button position: (${suggestedLikeX}, ${suggestedLikeY})`, logger.LOG_LEVELS.INFO, 'UI');
            const likeX = await question('Enter X coordinate for LIKE button: ');
            const likeY = await question('Enter Y coordinate for LIKE button: ');
            
            likePos = { x: parseInt(likeX) || suggestedLikeX, y: parseInt(likeY) || suggestedLikeY };
        }
        
        if (!passPos) {
            const suggestedPassX = Math.round(dimensions.width * 0.25); // Left side
            const suggestedPassY = Math.round(dimensions.height * 0.85); // Bottom area
            
            logger.log(`Suggested PASS button position: (${suggestedPassX}, ${suggestedPassY})`, logger.LOG_LEVELS.INFO, 'UI');
            const passX = await question('Enter X coordinate for PASS button: ');
            const passY = await question('Enter Y coordinate for PASS button: ');
            
            passPos = { x: parseInt(passX) || suggestedPassX, y: parseInt(passY) || suggestedPassY };
        }
    }
    
    // Create the buttonPositions object in the format expected by the rest of the app
    const buttonPositions = {
        likeButtonX: likePos?.x || 0,
        likeButtonY: likePos?.y || 0,
        passButtonX: passPos?.x || 0,
        passButtonY: passPos?.y || 0
    };
    
    logger.log('\nFinal button positions:', logger.LOG_LEVELS.INFO, 'UI');
    logger.log(`LIKE button: (${buttonPositions.likeButtonX}, ${buttonPositions.likeButtonY})`, logger.LOG_LEVELS.INFO, 'UI');
    logger.log(`PASS button: (${buttonPositions.passButtonX}, ${buttonPositions.passButtonY})`, logger.LOG_LEVELS.INFO, 'UI');
    
    return { buttonPositions };
}

/**
 * Test if the detected buttons work correctly
 * @param {Object} page Puppeteer page object
 * @param {Object} buttonPositions Button positions object
 */
async function testButtons(page, buttonPositions) {
    logger.log('Testing LIKE button...', logger.LOG_LEVELS.INFO, 'UI');
    await clickAtPosition(page, buttonPositions.likeButtonX, buttonPositions.likeButtonY);
    await delay(2000);
    
    const likeWorked = await question('Did the LIKE button work correctly? (Y/n): ');
    
    if (likeWorked.toLowerCase() !== 'y') {
        const newLikeX = await question('Enter new X coordinate for LIKE button: ');
        const newLikeY = await question('Enter new Y coordinate for LIKE button: ');
        buttonPositions.likeButtonX = parseInt(newLikeX) || buttonPositions.likeButtonX;
        buttonPositions.likeButtonY = parseInt(newLikeY) || buttonPositions.likeButtonY;
    }
    
    logger.log('Testing PASS button...', logger.LOG_LEVELS.INFO, 'UI');
    await clickAtPosition(page, buttonPositions.passButtonX, buttonPositions.passButtonY);
    await delay(2000);
    
    const passWorked = await question('Did the PASS button work correctly? (Y/n): ');
    
    if (passWorked.toLowerCase() !== 'y') {
        const newPassX = await question('Enter new X coordinate for PASS button: ');
        const newPassY = await question('Enter new Y coordinate for PASS button: ');
        buttonPositions.passButtonX = parseInt(newPassX) || buttonPositions.passButtonX;
        buttonPositions.passButtonY = parseInt(newPassY) || buttonPositions.passButtonY;
    }
    
    return buttonPositions;
}

/**
 * Find and handle a match notification
 * @param {Object} page Puppeteer page object
 */
async function handleMatchNotification(page) {
    logger.log('Checking for match notification...', logger.LOG_LEVELS.INFO, 'UI');
    try {
        // Wait a short time for any match dialog to appear
        await delay(1500);
        
        // Check for "Continue Bumbling" button using multiple possible selectors
        const continueBumblingExists = await page.evaluate(() => {
            // Look for button with specific text
            const buttons = Array.from(document.querySelectorAll('button'));
            const continueBumblingBtn = buttons.find(btn => 
                btn.textContent && btn.textContent.includes('Continue Bumbling')
            );
            
            // Look for alternative selectors
            const altSelectors = [
                '[data-qa-role="continue-bumbling"]',
                '[aria-label="Continue Bumbling"]',
                '[class*="continue-button"]',
                '.continue-bumbling',
                // Common selectors that might contain a continue button in a match dialog
                '.match-notification button',
                '.match-dialog button',
                '.encounters-match button'
            ];
            
            const altButton = altSelectors.map(sel => document.querySelector(sel)).find(el => el);
            
            // Return position if button found
            if (continueBumblingBtn) {
                const rect = continueBumblingBtn.getBoundingClientRect();
                return {
                    found: true,
                    x: Math.round(rect.left + rect.width / 2),
                    y: Math.round(rect.top + rect.height / 2),
                    method: 'text-match'
                };
            } else if (altButton) {
                const rect = altButton.getBoundingClientRect();
                return {
                    found: true,
                    x: Math.round(rect.left + rect.width / 2),
                    y: Math.round(rect.top + rect.height / 2),
                    method: 'selector-match'
                };
            }
            
            return { found: false };
        });
        
        if (continueBumblingExists.found) {
            logger.log(`Match detected! Clicking "Continue Bumbling" button using ${continueBumblingExists.method}...`, 
                       logger.LOG_LEVELS.INFO, 'UI');
            await clickAtPosition(page, continueBumblingExists.x, continueBumblingExists.y);
            logger.log('Match dialog dismissed, continuing to swipe.', logger.LOG_LEVELS.INFO, 'UI');
            
            // Add a short delay after dismissing the match dialog
            await delay(1000);
        }
    } catch (error) {
        logger.log('No match notification found, continuing...', logger.LOG_LEVELS.INFO, 'UI');
    }
}

module.exports = {
    findActionButtons,
    findActionButtonsOnce,
    waitForElementsToLoad,
    testButtons,
    handleMatchNotification
}; 