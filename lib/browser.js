// Browser management for Bumble automation
const path = require('path');
const { delay } = require('./utils');
const logger = require('./logger');

// Replace standard puppeteer with puppeteer-extra and stealth plugins
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUAPlugin = require('puppeteer-extra-plugin-anonymize-ua');
const { applyEvasions, applyRandomBehavior, getPlausibleDimensions, simulateHumanPresence } = require('./anti-detection');

// Apply plugins
puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUAPlugin());

// Global variables
let browser = null;
let page = null;
let humanPresenceSimulator = null;

/**
 * Get a random user agent
 * @returns {string} A random user agent string
 */
function getRandomUserAgent() {
    // Use fewer, more common user agents to avoid fingerprinting
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.76',
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Initialize the browser and navigate to Bumble app
 * @param {Object} options Configuration options
 * @returns {Object} Browser and page instances
 */
async function initBrowser(options = {}) {
    logger.log('Initializing browser...', logger.LOG_LEVELS.INFO, 'BROWSER');
    
    try {
        // Get plausible dimensions or use the ones provided
        const dimensions = options.windowSize || getPlausibleDimensions();
        
        // Launch browser with simplified anti-detection settings
        browser = await puppeteer.launch({
            headless: false, // Running headless significantly increases detection chance
            defaultViewport: null, // Use the default viewport of the browser
            args: [
                '--disable-blink-features=AutomationControlled', 
                `--window-size=${dimensions.width},${dimensions.height}`,
                '--start-maximized', // Add this option to maximize the window
                '--no-sandbox',
                '--disable-features=site-per-process',
                '--disable-web-security',
                '--lang=en-US,en',
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            slowMo: options.slowMo || 10, // Slow down Puppeteer operations by 10ms
            userDataDir: path.join(process.cwd(), 'user_data') // Use persistent user data directory for session persistence
        });
        
        // Create a new page
        page = await browser.newPage();
        
        // Apply simplified evasion measures
        await applyEvasions(page);
        // Skip applying random behavior which may cause issues
        // await applyRandomBehavior(page);
        
        // Set user-agent
        const userAgent = getRandomUserAgent();
        await page.setUserAgent(userAgent);
        
        // Use simpler headers
        await page.setExtraHTTPHeaders({
            'accept-language': 'en-US,en;q=0.9',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        });
        
        // Set cookie if available - set cookies BEFORE navigation
        if (options.cookies && Array.isArray(options.cookies) && options.cookies.length > 0) {
            logger.log(`Setting ${options.cookies.length} cookies from saved session`, logger.LOG_LEVELS.INFO, 'BROWSER');
            try {
                // Ensure cookies are in the correct format
                const validCookies = options.cookies.filter(cookie => {
                    // Make sure each cookie has the required properties
                    return cookie && typeof cookie === 'object' && cookie.name && cookie.value;
                });
                
                if (validCookies.length !== options.cookies.length) {
                    logger.log(`Filtered out ${options.cookies.length - validCookies.length} invalid cookies`, 
                               logger.LOG_LEVELS.WARNING, 'BROWSER');
                }
                
                if (validCookies.length > 0) {
                    await page.setCookie(...validCookies);
                    logger.log(`Successfully set ${validCookies.length} cookies`, logger.LOG_LEVELS.SUCCESS, 'BROWSER');
                } else {
                    logger.log('No valid cookies to set', logger.LOG_LEVELS.WARNING, 'BROWSER');
                }
            } catch (cookieError) {
                logger.log(`Error setting cookies: ${cookieError.message}`, logger.LOG_LEVELS.ERROR, 'BROWSER');
            }
        }
        
        // Set viewport dimensions
        await page.setViewport({
            width: dimensions.width,
            height: dimensions.height,
            deviceScaleFactor: 1,
        });
        
        // Start human presence simulation with reduced frequency
        humanPresenceSimulator = simulateHumanPresence(page);
        
        // Navigate to Bumble
        logger.log('Navigating to Bumble...', logger.LOG_LEVELS.INFO, 'BROWSER');
        await page.goto('https://bumble.com/app', { 
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        logger.log('Browser initialized successfully', logger.LOG_LEVELS.SUCCESS, 'BROWSER');
        
        return { browser, page };
    } catch (error) {
        logger.log(`Error initializing browser: ${error.message}`, logger.LOG_LEVELS.ERROR, 'BROWSER');
        throw error;
    }
}

/**
 * Check if the user is logged into Bumble
 * @param {Object} page Puppeteer page object
 * @returns {boolean} Whether the user is logged in
 */
async function checkLoginStatus(page) {
    logger.log('Checking if user is logged in...', logger.LOG_LEVELS.INFO, 'AUTH');
    
    try {
        // First check page URL - the most reliable indicator
        const url = page.url();
        const isAppUrl = url.includes('/app');
        
        if (!isAppUrl) {
            logger.log('Not on app URL, likely not logged in', logger.LOG_LEVELS.WARNING, 'AUTH');
            return false;
        }
        
        // Wait a bit to let the page stabilize if needed
        await delay(1000);
        
        // Use a more reliable method to check login status
        // This approach completely avoids frame issues
        const isLoggedIn = await page.evaluate(() => {
            try {
                // Method 1: Check for app content or main navigation
                const appContent = document.querySelector('.app-content, .encounters-user');
                if (appContent) return true;
                
                // Method 2: Check for encounter cards
                const encounterCards = document.querySelector(
                    '[data-qa-role="encounters-alt"], ' +
                    '.encounters-story, ' +
                    '.encounters-user__info'
                );
                if (encounterCards) return true;
                
                // Method 3: Check for chat navigation
                const chatNav = document.querySelector(
                    '[data-qa-role="chat"], ' + 
                    '.sidebar__tab--chats, ' +
                    '.sidebar__header-image'
                );
                if (chatNav) return true;
                
                // Method 4: Check if we're NOT on the login page
                const loginElements = document.querySelector(
                    '[data-qa-role="login"], ' +
                    '.login-block, ' + 
                    '.sign-in-register, ' +
                    'button[data-qa-role="marketing-login"], ' +
                    '.registration__card-button'
                );
                if (loginElements) return false;
                
                // Method 5: Look for user-specific elements
                const userElements = document.querySelector(
                    '.user-info, ' +
                    '.profile-header, ' +
                    '.profile__header, ' +
                    '.header__user'
                );
                if (userElements) return true;
                
                // If we're on an app URL but don't see login elements, assume logged in
                return true;
            } catch (e) {
                // If there's any error in the evaluate function, log it
                console.error('Error in checkLoginStatus evaluate:', e);
                // Default to false on errors
                return false;
            }
        });
        
        logger.log(`Login status: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`, 
                  isLoggedIn ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.WARNING, 
                  'AUTH');
        
        return isLoggedIn;
    } catch (error) {
        logger.log(`Error checking login status: ${error.message}`, logger.LOG_LEVELS.ERROR, 'AUTH');
        // Wait a moment before returning to allow for page stabilization
        await delay(1000);
        
        // Fallback method if the evaluate fails
        try {
            // Simple URL check fallback
            const url = page.url();
            const isAppNoQuery = url.includes('/app') && !url.includes('?');
            
            logger.log(`Fallback login check result: ${isAppNoQuery}`, 
                      isAppNoQuery ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.WARNING, 
                      'AUTH');
            
            return isAppNoQuery;
        } catch (fallbackError) {
            logger.log(`Fallback login check failed: ${fallbackError.message}`, logger.LOG_LEVELS.ERROR, 'AUTH');
            return false;
        }
    }
}

/**
 * Wait for user to log in
 * @param {Object} page Puppeteer page object
 * @returns {Promise<boolean>} Whether login was successful
 */
async function waitForLogin(page) {
    logger.log('Waiting for user to log in...', logger.LOG_LEVELS.INFO, 'AUTH');
    
    try {
        // Wait for elements that indicate successful login
        // Using longer timeout (5 minutes) to give user time to log in manually
        const loginTimeout = 5 * 60 * 1000; // 5 minutes
        const startTime = Date.now();
        
        while (Date.now() - startTime < loginTimeout) {
            // Check if we're logged in now
            const isLoggedIn = await checkLoginStatus(page);
            
            if (isLoggedIn) {
                logger.log('Successfully logged in!', logger.LOG_LEVELS.SUCCESS, 'AUTH');
                return true;
            }
            
            // Wait a bit before checking again
            await delay(5000);
            logger.log('Still waiting for login...', logger.LOG_LEVELS.INFO, 'AUTH');
        }
        
        logger.log('Login timeout exceeded', logger.LOG_LEVELS.ERROR, 'AUTH');
        return false;
    } catch (error) {
        logger.log(`Error waiting for login: ${error.message}`, logger.LOG_LEVELS.ERROR, 'AUTH');
        return false;
    }
}

/**
 * Randomize mouse movement to appear more human-like
 * @param {Object} page Puppeteer page object
 * @param {number} x Target X coordinate
 * @param {number} y Target Y coordinate
 */
async function humanMouseMovement(page, x, y) {
    // Get current mouse position or use a default starting point
    const currentPosition = { x: 100, y: 100 }; // Default starting position
    
    // Calculate distance to target
    const distance = Math.sqrt(
        Math.pow(x - currentPosition.x, 2) + 
        Math.pow(y - currentPosition.y, 2)
    );
    
    // Determine number of steps based on distance
    const steps = Math.max(5, Math.floor(distance / 10));
    
    // Move mouse in steps with some randomness
    for (let i = 1; i <= steps; i++) {
        // Calculate smooth position
        const progress = i / steps;
        // Add a little randomness to the curve
        const randomX = (Math.random() - 0.5) * 10;
        const randomY = (Math.random() - 0.5) * 10;
        
        const moveX = currentPosition.x + (x - currentPosition.x) * progress + randomX;
        const moveY = currentPosition.y + (y - currentPosition.y) * progress + randomY;
        
        // Move to the calculated position
        await page.mouse.move(moveX, moveY);
        
        // Random delay between movements
        await delay(Math.random() * 20 + 5);
    }
    
    // Final precise movement to target
    await page.mouse.move(x, y);
}

/**
 * Save cookies from the current browser session
 * @param {Object} page Puppeteer page object
 * @returns {Array} Cookies from the current session
 */
async function saveCookies(page) {
    try {
        const cookies = await page.cookies();
        logger.log(`Retrieved ${cookies.length} cookies from browser`, logger.LOG_LEVELS.DEBUG, 'BROWSER');
        return cookies;
    } catch (error) {
        logger.log(`Error saving cookies: ${error.message}`, logger.LOG_LEVELS.ERROR, 'BROWSER');
        return [];
    }
}

/**
 * Close the browser
 */
async function closeBrowser() {
    try {
        // Stop human presence simulation if running
        if (humanPresenceSimulator) {
            humanPresenceSimulator();
            humanPresenceSimulator = null;
        }
        
        if (browser) {
            await browser.close();
            browser = null;
            page = null;
            logger.log('Browser closed', logger.LOG_LEVELS.SUCCESS, 'BROWSER');
        }
    } catch (error) {
        logger.log(`Error closing browser: ${error.message}`, logger.LOG_LEVELS.ERROR, 'BROWSER');
        // Browser might already be closed, so just set to null
        browser = null;
        page = null;
    }
}

module.exports = {
    initBrowser,
    checkLoginStatus,
    waitForLogin,
    closeBrowser,
    humanMouseMovement,
    saveCookies
}; 