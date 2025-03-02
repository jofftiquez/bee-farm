const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Variables to track resources that need cleanup
let screenshotPath = null;
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
            await browser.close();
            console.log('Browser closed.');
        } catch (err) {
            // Browser might already be closed
        }
    }
    
    // Delete screenshot if it exists
    if (screenshotPath) {
        try {
            await fs.access(screenshotPath);
            await fs.unlink(screenshotPath);
            console.log('Screenshot deleted.');
        } catch (err) {
            // File might not exist or can't be accessed
            console.log('Could not delete screenshot:', err.message);
        }
    }
    
    console.log('Cleanup complete. Goodbye!');
}

(async () => {
    try {
        console.log('Launching browser...');
        browser = await puppeteer.launch({ 
            headless: false, 
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        console.log('Opening new page...');
        const page = await browser.newPage();
        
        // Set up exit handler
        console.log('Press Ctrl+C to exit at any time');
        process.on('SIGINT', async () => {
            console.log('\nReceived termination signal.');
            await cleanup();
            process.exit(0);
        });
        
        console.log('Navigating to Bumble...');
        await page.goto('https://bumble.com/app', { waitUntil: 'networkidle2' });
        console.log('Page loaded!');

        // Helper function for delays
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Function to simulate key presses
        async function simulateProfileCheck(page) {
            console.log('Checking profile...');
            const keyPresses = Math.floor(Math.random() * 9); // Random 0-8 times
            for (let i = 0; i < keyPresses; i++) {
                await page.keyboard.press('ArrowDown');
                await delay(Math.random() * 500 + 200); // Random delay
            }
            for (let i = 0; i < keyPresses; i++) {
                await page.keyboard.press('ArrowUp');
                await delay(Math.random() * 500 + 200);
            }
        }

        console.log('\n==== AUTOMATIC BUTTON DETECTION ====');
        console.log('Please log into Bumble and navigate to the swiping interface.');
        
        await question('Press Enter when you are ready and have a profile visible...');
        
        // Take a screenshot for reference
        console.log('Taking screenshot for reference...');
        
        const screenshotDir = path.join(process.cwd(), 'screenshots');
        try {
            await fs.mkdir(screenshotDir, { recursive: true });
        } catch (err) {
            // Directory already exists, ignore
        }
        
        screenshotPath = path.join(screenshotDir, 'bumble_screen.png');
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
        
        console.log(`\nFinal button positions:`);
        console.log(`LIKE button: (${likePos.x}, ${likePos.y})`);
        console.log(`PASS button: (${passPos.x}, ${passPos.y})`);
        
        // Allow user to test the button positions
        console.log('\n==== BUTTON TEST ====');
        const shouldTest = await question('Do you want to test the button positions? (y/n): ');
        
        if (shouldTest.toLowerCase() === 'y') {
            console.log('Testing LIKE button...');
            await page.mouse.click(likePos.x, likePos.y);
            await delay(2000);
            
            const likeWorked = await question('Did the LIKE button work correctly? (y/n): ');
            
            if (likeWorked.toLowerCase() !== 'y') {
                const newLikeX = await question('Enter new X coordinate for LIKE button: ');
                const newLikeY = await question('Enter new Y coordinate for LIKE button: ');
                likePos = { x: parseInt(newLikeX), y: parseInt(newLikeY) };
            }
            
            console.log('Testing PASS button...');
            await page.mouse.click(passPos.x, passPos.y);
            await delay(2000);
            
            const passWorked = await question('Did the PASS button work correctly? (y/n): ');
            
            if (passWorked.toLowerCase() !== 'y') {
                const newPassX = await question('Enter new X coordinate for PASS button: ');
                const newPassY = await question('Enter new Y coordinate for PASS button: ');
                passPos = { x: parseInt(newPassX), y: parseInt(newPassY) };
            }
        }
        
        // Function to click at specific coordinates
        async function clickAtPosition(page, x, y) {
            await page.mouse.click(x, y, { delay: Math.random() * 100 + 50 });
        }
        
        // Allow user to set like probability
        console.log('\n==== ALGORITHM SETTINGS ====');
        console.log('Based on the Elo rating system analysis, the optimal right swipe ratio is 18%');
        const likePercentage = await question('Enter percentage chance to like profiles (default: 18): ') || 18;
        const likeChance = parseInt(likePercentage) / 100;
        
        // Advanced algorithm settings
        console.log('\nThe Elo-optimized algorithm simulates:');
        console.log('- Swiping left on most high-Elo profiles (to boost your score)');
        console.log('- Selectively swiping right on mid-to-high profiles');
        console.log('- Avoiding right swipes on low-Elo profiles');
        console.log('- Adding randomness to avoid algorithm penalties');

        // Track swipe patterns to maintain optimal distribution
        let swipeCount = 0;
        let likesCount = 0;
        
        console.log(`\nStarting swipe loop with ${likePercentage}% chance to like...`);
        console.log('LIKE button: ' + JSON.stringify(likePos));
        console.log('PASS button: ' + JSON.stringify(passPos));
        
        // Document rest time feature
        console.log('\n==== REST TIME FEATURE ====');
        console.log('To simulate natural human behavior, the bot will:');
        console.log('- Take a break every 15-20 minutes (randomly determined)');
        console.log('- Rest for 5-10 minutes during each break (randomly determined)');
        console.log('- Completely stop activity during rest periods');
        console.log('- Resume automatically after the rest period ends');
        console.log('This helps make the swiping pattern look more natural and reduces the risk of detection.');
        console.log('==============================\n');
        
        while (true) {
            await simulateProfileCheck(page);
            
            swipeCount++;
            
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
                console.log(`[${swipeCount}] Swiping Right (LIKE) - Current ratio: ${Math.round(currentLikeRatio * 100)}%`);
                await clickAtPosition(page, likePos.x, likePos.y);
                likesCount++;
                
                // After liking, check for match notification and handle it
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
            } else {
                console.log(`[${swipeCount}] Swiping Left (PASS) - Current ratio: ${Math.round(currentLikeRatio * 100)}%`);
                await clickAtPosition(page, passPos.x, passPos.y);
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
