const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function for user prompts
function question(query) {
  // Check if the query has a default option (indicated by capital letter)
  const defaultMatch = query.match(/\(([A-Z])\/([a-z])\)/i);
  
  if (defaultMatch) {
    // Replace with proper format showing the default
    const defaultOption = defaultMatch[1].toUpperCase();
    const otherOption = defaultMatch[2].toLowerCase();
    const formattedQuery = query.replace(/\([A-Za-z]\/[A-Za-z]\)/i, `(${defaultOption}/${otherOption})`);
    
    return new Promise(resolve => {
      rl.question(formattedQuery, answer => {
        // If user just hits Enter, use the default
        if (answer.trim() === '') {
          resolve(defaultOption.toLowerCase());
        } else {
          resolve(answer);
        }
      });
    });
  }
  
  // Standard behavior for queries without defaults
  return new Promise(resolve => rl.question(query, resolve));
}

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to simulate profile checking with keyboard navigation
async function simulateProfileCheck(page) {
    try {
        // Add randomness to the behavior
        const shouldCheck = Math.random() > 0.2; // 80% chance to check profile
        
        if (!shouldCheck) {
            // Sometimes we just look at the profile briefly
            await delay(Math.random() * 1500 + 500);
            return;
        }
        
        // Get viewport size
        const dimensions = await page.evaluate(() => {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        });

        // Random number of scrolls (1-4)
        const scrollCount = Math.floor(Math.random() * 4) + 1;
        
        for (let i = 0; i < scrollCount; i++) {
            // Random scroll distance
            const scrollY = Math.floor(Math.random() * 300) + 100;
            
            // Scroll with variable speed
            await page.mouse.wheel({ deltaY: scrollY });
            
            // Random delay between scrolls
            await delay(Math.random() * 1000 + 500);
        }
        
        // Sometimes click on photos if available
        if (Math.random() > 0.5) {
            // Try to find photo pagination dots (common in dating apps)
            const dotsExist = await page.evaluate(() => {
                const dots = document.querySelectorAll('.pagination-dots, [data-qa-role="pagination-dots"], [role="pagination"]');
                return dots.length > 0;
            });
            
            if (dotsExist) {
                // Find middle area (likely where photos are)
                const middleX = dimensions.width / 2;
                const middleY = dimensions.height / 3;
                
                // Random number of photo movements (1-3)
                const photoClicks = Math.floor(Math.random() * 3) + 1;
                
                for (let i = 0; i < photoClicks; i++) {
                    // Click with small random offsets
                    const offsetX = (Math.random() - 0.5) * 100;
                    const offsetY = (Math.random() - 0.5) * 100;
                    
                    await clickAtPosition(page, middleX + offsetX, middleY + offsetY);
                    
                    // Wait between photo views
                    await delay(Math.random() * 1200 + 800);
                }
            }
        }
        
        // Scroll back to top with variable speed and pauses
        await page.evaluate(() => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        // Final pause before potentially swiping
        await delay(Math.random() * 1000 + 500);
    } catch (error) {
        console.error('Error during profile check simulation:', error);
        // Continue anyway, this is just to enhance human behavior
    }
}

// Function to click at specific coordinates
async function clickAtPosition(page, x, y) {
    try {
        // Get a reference to humanMouseMovement if available
        const browser = require('./browser');
        const humanMove = browser.humanMouseMovement || null;
        
        // First move mouse in a human-like way if available
        if (humanMove) {
            await humanMove(page, x, y);
        } else {
            // Fallback with basic random movement
            const steps = Math.floor(Math.random() * 5) + 3;
            await page.mouse.move(x, y, { steps });
        }
        
        // Add small random delay before clicking (like a human)
        await delay(Math.random() * 300 + 50);
        
        // Down, small pause, and up for more realistic click
        await page.mouse.down();
        await delay(Math.random() * 100 + 20);
        await page.mouse.up();
        
        // Add post-click delay to mimic human behavior
        await delay(Math.random() * 200 + 50);
    } catch (error) {
        console.error('Error during click operation:', error);
    }
}

// Directory management
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        return true;
    } catch (err) {
        console.log(`Error creating directory ${dirPath}:`, err.message);
        return false;
    }
}

/**
 * Load user preferences from file or prompt user to create them
 * @param {string} preferencesFilePath Path to the preferences file
 * @returns {Object} User preferences
 */
async function loadUserPreferences(preferencesFilePath) {
    console.log('Loading user preferences...');
    
    try {
        // Check if preferences file exists
        await fs.access(preferencesFilePath);
        console.log('User preferences file found, loading...');
        
        // Load preferences from file
        const fileContent = await fs.readFile(preferencesFilePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        // File doesn't exist or other error
        console.log('User preferences file not found, creating a new one...');
        
        // Default preferences template
        const defaultPreferences = {
            personalDescription: '',
            interests: [],
            avoidKeywords: [],
            requireBio: true,
            requireVerified: true,
            alignmentThreshold: 0.3,
            llmSettings: {
                enabled: false,
                minComparisonScore: 0.6
            },
            agePreference: {
                enabled: false,
                minAge: 18,
                maxAge: 45
            },
            locationPreference: {
                enabled: false,
                preferredLocations: []
            }
        };
        
        // Prompt user for preferences
        console.log('\n==== USER PREFERENCES SETUP ====');
        console.log('Please provide your preferences for profile matching:');
        
        // Get personal description
        defaultPreferences.personalDescription = await question(
            'Enter a brief description about yourself (will be used for matching): '
        );
        
        // Get interests (comma-separated)
        const interestsInput = await question(
            'Enter your interests (comma-separated, e.g., hiking,reading,travel): '
        );
        defaultPreferences.interests = interestsInput
            .split(',')
            .map(interest => interest.trim())
            .filter(interest => interest.length > 0);
        
        // Get keywords to avoid (comma-separated)
        const avoidKeywordsInput = await question(
            'Enter keywords to avoid in profiles (comma-separated): '
        );
        defaultPreferences.avoidKeywords = avoidKeywordsInput
            .split(',')
            .map(keyword => keyword.trim())
            .filter(keyword => keyword.length > 0);
        
        // Ask about requiring bio
        const requireBioInput = await question(
            'Require profiles to have a bio? (Y/n): '
        );
        defaultPreferences.requireBio = requireBioInput.toLowerCase() !== 'n';
        
        // Ask about requiring verified profiles
        const requireVerifiedInput = await question(
            'Only swipe right on verified profiles? (Y/n): '
        );
        defaultPreferences.requireVerified = requireVerifiedInput.toLowerCase() !== 'n';
        
        // Ask if age matters
        const ageMattersInput = await question(
            'Does age matter for profile matching? (y/N): '
        );
        defaultPreferences.agePreference.enabled = ageMattersInput.toLowerCase() === 'y';
        
        // If age matters, ask for age range
        if (defaultPreferences.agePreference.enabled) {
            const minAgeInput = await question(
                'Enter minimum age (18+): '
            );
            const minAge = parseInt(minAgeInput, 10);
            if (!isNaN(minAge) && minAge >= 18) {
                defaultPreferences.agePreference.minAge = minAge;
            }
            
            const maxAgeInput = await question(
                'Enter maximum age: '
            );
            const maxAge = parseInt(maxAgeInput, 10);
            if (!isNaN(maxAge) && maxAge >= defaultPreferences.agePreference.minAge) {
                defaultPreferences.agePreference.maxAge = maxAge;
            }
        }
        
        // Ask if location matters
        const locationMattersInput = await question(
            'Does location matter for profile matching? (y/N): '
        );
        defaultPreferences.locationPreference.enabled = locationMattersInput.toLowerCase() === 'y';
        
        // If location matters, ask for preferred locations
        if (defaultPreferences.locationPreference.enabled) {
            const locationsInput = await question(
                'Enter preferred locations (comma-separated): '
            );
            defaultPreferences.locationPreference.preferredLocations = locationsInput
                .split(',')
                .map(location => location.trim())
                .filter(location => location.length > 0);
        }
        
        // Get config for default value
        const config = require('./config');
        
        // Get swipe right percentage
        const swipeRightInput = await question(
            `Enter swipe right percentage (1-100, default is ${config.swiping.defaultSwipeRightPercentage}% for optimal Elo): `
        );
        const swipeRightPercentage = parseInt(swipeRightInput, 10);
        if (!isNaN(swipeRightPercentage) && swipeRightPercentage >= 1 && swipeRightPercentage <= 100) {
            defaultPreferences.swipeRightPercentage = swipeRightPercentage;
        }
        
        // Get alignment threshold
        const alignmentThresholdInput = await question(
            'Enter alignment threshold (0.0-1.0, recommend 0.3): '
        );
        const threshold = parseFloat(alignmentThresholdInput);
        defaultPreferences.alignmentThreshold = !isNaN(threshold) && threshold >= 0 && threshold <= 1 
            ? threshold 
            : 0.3;
        
        // Save preferences to file
        await fs.writeFile(preferencesFilePath, JSON.stringify(defaultPreferences, null, 2));
        console.log(`Preferences saved to ${preferencesFilePath}`);
        console.log('Edit this file directly to update your preferences in the future.');
        
        return defaultPreferences;
    }
}

module.exports = {
    rl,
    question,
    delay,
    simulateProfileCheck,
    clickAtPosition,
    ensureDirectoryExists,
    loadUserPreferences
}; 