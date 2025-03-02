const path = require('path');
const { question, delay, clickAtPosition } = require('./utils');

/**
 * Find the like and pass buttons on the Bumble interface
 * @param {Object} page Puppeteer page object
 * @param {string} screenshotDir Directory for saving screenshots
 * @returns {Object} Coordinates for the like and pass buttons
 */
async function findActionButtons(page, screenshotDir) {
    // Take a screenshot for reference
    console.log('Taking screenshot for reference...');
    
    const screenshotPath = path.join(screenshotDir, 'bumble_screen.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved to: ${screenshotPath}`);
    
    // Find buttons using data-qa-role attributes
    console.log('Finding buttons by data-qa-role attributes...');
    
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
            console.log(`✅ Found LIKE button at (${likePos.x}, ${likePos.y}) using ${buttonsFound.like.selector}`);
        } else {
            console.log('❌ Could not find LIKE button automatically.');
        }
        
        if (buttonsFound.pass && buttonsFound.pass.found) {
            passPos = { x: buttonsFound.pass.x, y: buttonsFound.pass.y };
            console.log(`✅ Found PASS button at (${passPos.x}, ${passPos.y}) using ${buttonsFound.pass.selector}`);
        } else {
            console.log('❌ Could not find PASS button automatically.');
        }
    } else {
        console.log('❌ Could not find buttons automatically using data-qa-role attributes.');
    }
    
    // If any button wasn't found, fall back to manual entry or suggested positions
    if (!likePos || !passPos) {
        console.log('\nFalling back to manual coordinate entry...');
        
        // Get viewport dimensions for intelligent suggestions
        const dimensions = await page.evaluate(() => {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        });
        
        console.log(`Your browser window size is: ${dimensions.width} x ${dimensions.height}`);
        
        // Suggest positions based on screen dimensions if needed
        if (!likePos) {
            const suggestedLikeX = Math.round(dimensions.width * 0.75); // Right side
            const suggestedLikeY = Math.round(dimensions.height * 0.85); // Bottom area
            
            console.log(`Suggested LIKE button position: (${suggestedLikeX}, ${suggestedLikeY})`);
            const likeX = await question('Enter X coordinate for LIKE button: ');
            const likeY = await question('Enter Y coordinate for LIKE button: ');
            
            likePos = { x: parseInt(likeX) || suggestedLikeX, y: parseInt(likeY) || suggestedLikeY };
        }
        
        if (!passPos) {
            const suggestedPassX = Math.round(dimensions.width * 0.25); // Left side
            const suggestedPassY = Math.round(dimensions.height * 0.85); // Bottom area
            
            console.log(`Suggested PASS button position: (${suggestedPassX}, ${suggestedPassY})`);
            const passX = await question('Enter X coordinate for PASS button: ');
            const passY = await question('Enter Y coordinate for PASS button: ');
            
            passPos = { x: parseInt(passX) || suggestedPassX, y: parseInt(passY) || suggestedPassY };
        }
    }
    
    // Create the buttonPositions object in the format expected by the rest of the app
    const buttonPositions = {
        likeButtonX: likePos.x,
        likeButtonY: likePos.y,
        passButtonX: passPos.x,
        passButtonY: passPos.y
    };
    
    console.log(`\nFinal button positions:`);
    console.log(`LIKE button: (${buttonPositions.likeButtonX}, ${buttonPositions.likeButtonY})`);
    console.log(`PASS button: (${buttonPositions.passButtonX}, ${buttonPositions.passButtonY})`);
    
    return {
        buttonPositions,
        screenshotPath
    };
}

/**
 * Test if the detected buttons work correctly
 * @param {Object} page Puppeteer page object
 * @param {Object} buttonPositions Button positions object
 */
async function testButtons(page, buttonPositions) {
    console.log('Testing LIKE button...');
    await clickAtPosition(page, buttonPositions.likeButtonX, buttonPositions.likeButtonY);
    await delay(2000);
    
    const likeWorked = await question('Did the LIKE button work correctly? (Y/n): ');
    
    if (likeWorked.toLowerCase() !== 'y') {
        const newLikeX = await question('Enter new X coordinate for LIKE button: ');
        const newLikeY = await question('Enter new Y coordinate for LIKE button: ');
        buttonPositions.likeButtonX = parseInt(newLikeX) || buttonPositions.likeButtonX;
        buttonPositions.likeButtonY = parseInt(newLikeY) || buttonPositions.likeButtonY;
    }
    
    console.log('Testing PASS button...');
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
    console.log('Checking for match notification...');
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
            console.log(`Match detected! Clicking "Continue Bumbling" button using ${continueBumblingExists.method}...`);
            await clickAtPosition(page, continueBumblingExists.x, continueBumblingExists.y);
            console.log('Match dialog dismissed, continuing to swipe.');
            
            // Add a short delay after dismissing the match dialog
            await delay(1000);
        }
    } catch (error) {
        console.log('No match notification found, continuing...');
    }
}

module.exports = {
    findActionButtons,
    testButtons,
    handleMatchNotification
}; 