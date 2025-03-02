const puppeteer = require('puppeteer');
const path = require('path');
const { delay } = require('./utils');

// Global browser instance
let browser = null;

/**
 * Initialize the browser and navigate to Bumble
 * @param {Object} options Configuration options
 * @returns {Object} Object containing browser and page instances
 */
async function initBrowser(options = {}) {
    const userDataDir = path.join(process.cwd(), 'user_data');
    
    console.log('Launching browser...');
    browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        userDataDir: './user_data',
        ...options
    });
    
    console.log('Opening new page...');
    const page = await browser.newPage();
    
    console.log('Navigating to Bumble...');
    await page.goto('https://bumble.com/app', { waitUntil: 'networkidle2' });
    console.log('Page loaded!');
    
    return { browser, page };
}

/**
 * Check if user is logged in to Bumble
 * @param {Object} page Puppeteer page object
 * @returns {boolean} True if logged in
 */
async function checkLoginStatus(page) {
    console.log('Checking authentication status...');
    const isLoggedIn = await page.evaluate(() => {
        // Check for elements that would indicate we're in the app
        const swipeButtons = document.querySelector('[data-qa-role="encounters-action-like"]') ||
            document.querySelector('[data-qa-role="encounters-action-dislike"]');
        
        // Check for elements that would indicate we're on the login page
        const loginElements = document.querySelector('[data-qa-role="google-login"]') ||
            document.querySelector('[data-qa-role="facebook-login"]') ||
            document.querySelector('[data-qa-role="phone-login"]');
            
        // Return true if we find app elements and no login elements
        return !!swipeButtons || !loginElements;
    });
    
    if (isLoggedIn) {
        console.log('✅ Already logged in! Session was successfully restored.');
    } else {
        console.log('⚠️ Not logged in. Please log into Bumble when the browser opens.');
        console.log('Your login will be remembered for future sessions.');
    }
    
    return isLoggedIn;
}

/**
 * Wait for the user to log in
 * @param {Object} page Puppeteer page object
 */
async function waitForLogin(page) {
    console.log('Waiting for successful login and navigation to the app...');
    try {
        await page.waitForSelector('[data-qa-role="encounters-action-like"], [aria-label="Like"], .profile-header', { 
            timeout: 300000 // 5 minutes timeout for login
        });
        console.log('Login detected!');
    } catch (error) {
        console.log('Login timeout - please manually navigate to the swiping interface when logged in.');
    }
}

/**
 * Close the browser
 */
async function closeBrowser() {
    if (browser) {
        try {
            await browser.close();
            console.log('Browser closed.');
        } catch (err) {
            // Browser might already be closed
        }
    }
}

module.exports = {
    initBrowser,
    checkLoginStatus,
    waitForLogin,
    closeBrowser,
    getBrowser: () => browser
}; 