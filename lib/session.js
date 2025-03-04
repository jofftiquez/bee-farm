// Session management for maintaining Bumble logins
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

// Path to store session data
const SESSION_PATH = path.join(process.cwd(), 'session_data');
const COOKIES_FILE = path.join(SESSION_PATH, 'cookies.json');
const FINGERPRINT_FILE = path.join(SESSION_PATH, 'fingerprint.txt');

/**
 * Ensure the session directory exists
 */
async function ensureSessionDirectory() {
  try {
    await fs.mkdir(SESSION_PATH, { recursive: true });
    logger.log('Session directory ready', logger.LOG_LEVELS.DEBUG, 'SESSION');
    return true;
  } catch (error) {
    logger.log(`Error creating session directory: ${error.message}`, logger.LOG_LEVELS.ERROR, 'SESSION');
    return false;
  }
}

/**
 * Save session cookies to disk
 * @param {Object} page Puppeteer page object
 */
async function saveSession(page) {
  try {
    await ensureSessionDirectory();
    
    // Get cookies directly from page
    const cookies = await page.cookies();
    
    if (!cookies || cookies.length === 0) {
      logger.log('No cookies to save', logger.LOG_LEVELS.WARNING, 'SESSION');
      return false;
    }
    
    // Filter cookies to only include essential ones for auth
    // This focuses on cookies that are likely related to authentication
    const authCookies = cookies.filter(cookie => {
      return cookie.name.toLowerCase().includes('auth') || 
             cookie.name.toLowerCase().includes('sess') ||
             cookie.name.toLowerCase().includes('token') ||
             cookie.name.toLowerCase().includes('id') ||
             cookie.name.toLowerCase().includes('user') ||
             cookie.name.toLowerCase().includes('log');
    });
    
    // Also include all cookies from the bumble.com domain
    const bumbleCookies = cookies.filter(cookie => 
      cookie.domain && (cookie.domain.includes('bumble.com'))
    );
    
    // Combine and deduplicate cookies
    const combinedCookies = [...new Map([
      ...authCookies.map(c => [c.name, c]), 
      ...bumbleCookies.map(c => [c.name, c])
    ].values())];
    
    // Always include these cookies if they exist
    const criticalCookies = cookies.filter(c => 
      ['_hive_id', 'user_favorite', 'normal_login', 'session'].includes(c.name)
    );
    
    // Combine all important cookies - ensure we don't have duplicates
    const importantCookies = Array.from(new Set([...combinedCookies, ...criticalCookies]));
    
    // Save all cookies as a backup
    await fs.writeFile(
      path.join(SESSION_PATH, 'all_cookies.json'), 
      JSON.stringify(cookies, null, 2)
    );
    
    // Save filtered cookies to main file - FIXING FORMAT ISSUE HERE
    // Don't save as a nested array structure, just save the array of cookie objects directly
    await fs.writeFile(COOKIES_FILE, JSON.stringify(importantCookies, null, 2));
    
    logger.log(`Session saved with ${importantCookies.length} cookies`, logger.LOG_LEVELS.SUCCESS, 'SESSION');
    return true;
  } catch (error) {
    logger.log(`Error saving session: ${error.message}`, logger.LOG_LEVELS.ERROR, 'SESSION');
    return false;
  }
}

/**
 * Load session cookies from disk
 * @returns {Array|null} Cookies or null if no saved session
 */
async function loadSession() {
  try {
    logger.log('Checking for saved session...', logger.LOG_LEVELS.INFO, 'SESSION');
    
    // Check if cookies file exists
    try {
      await fs.access(COOKIES_FILE);
    } catch (error) {
      logger.log('No saved session found', logger.LOG_LEVELS.INFO, 'SESSION');
      return null;
    }
    
    // Read and parse cookies
    const cookiesData = await fs.readFile(COOKIES_FILE, 'utf8');
    let cookies;
    
    try {
      cookies = JSON.parse(cookiesData);
      
      // Handle the case where cookies might be in the incorrect format (nested arrays)
      if (Array.isArray(cookies) && cookies.length > 0 && Array.isArray(cookies[0])) {
        // Convert from the incorrect nested array format
        cookies = cookies.map(cookiePair => {
          // If it's a pair like [name, cookieObject], return just the cookie object
          if (cookiePair.length === 2 && typeof cookiePair[1] === 'object') {
            return cookiePair[1];
          }
          return cookiePair;
        });
        
        // Save in the correct format for future use
        await fs.writeFile(COOKIES_FILE, JSON.stringify(cookies, null, 2));
        logger.log('Fixed cookie format in saved session', logger.LOG_LEVELS.INFO, 'SESSION');
      }
    } catch (parseError) {
      logger.log(`Error parsing cookies: ${parseError.message}`, logger.LOG_LEVELS.ERROR, 'SESSION');
      return null;
    }
    
    if (Array.isArray(cookies) && cookies.length > 0) {
      // Try to load all cookies as fallback
      try {
        const allCookiesData = await fs.readFile(
          path.join(SESSION_PATH, 'all_cookies.json'), 
          'utf8'
        );
        const allCookies = JSON.parse(allCookiesData);
        
        if (Array.isArray(allCookies) && allCookies.length > cookies.length) {
          logger.log(`Loaded ${allCookies.length} cookies from complete backup`, logger.LOG_LEVELS.SUCCESS, 'SESSION');
          return allCookies;
        }
      } catch (e) {
        // Continue with regular cookies if backup doesn't exist
      }
      
      logger.log(`Loaded ${cookies.length} cookies from saved session`, logger.LOG_LEVELS.SUCCESS, 'SESSION');
      return cookies;
    } else {
      logger.log('Saved session is empty or invalid', logger.LOG_LEVELS.WARNING, 'SESSION');
      return null;
    }
  } catch (error) {
    logger.log(`Error loading session: ${error.message}`, logger.LOG_LEVELS.ERROR, 'SESSION');
    return null;
  }
}

/**
 * Create a simple fingerprint to identify the browser session
 * Note: This is just a simple implementation, real browsers use more complex fingerprinting
 */
async function getSessionFingerprint() {
  try {
    const os = require('os');
    
    // Get some system info to create a relatively stable fingerprint
    const hostname = os.hostname();
    const username = os.userInfo().username;
    const platform = os.platform();
    const cpuCount = os.cpus().length;
    const memTotal = Math.round(os.totalmem() / (1024 * 1024 * 1024)); // GB
    
    // Create a stable fingerprint that won't change between sessions
    const fingerprintBase = `${hostname}-${username}-${platform}-${cpuCount}c-${memTotal}gb`;
    
    // Save fingerprint to session directory
    await ensureSessionDirectory();
    
    try {
      // Check if we already have a saved fingerprint
      const existingFingerprint = await fs.readFile(FINGERPRINT_FILE, 'utf8');
      logger.log(`Session fingerprint: ${existingFingerprint.trim()}`, logger.LOG_LEVELS.DEBUG, 'SESSION');
      return existingFingerprint.trim();
    } catch (error) {
      // If not, create and save a new one
      await fs.writeFile(FINGERPRINT_FILE, fingerprintBase);
      logger.log(`New session fingerprint: ${fingerprintBase}`, logger.LOG_LEVELS.DEBUG, 'SESSION');
      return fingerprintBase;
    }
  } catch (error) {
    logger.log(`Error generating session fingerprint: ${error.message}`, logger.LOG_LEVELS.ERROR, 'SESSION');
    // Fallback to a random fingerprint that's consistent for this run only
    return `fallback-${Date.now()}`;
  }
}

/**
 * Schedule periodic session saving to mimic real browser behavior
 * @param {Object} page Puppeteer page object
 */
function scheduleSessionSaving(page) {
  const saveInterval = 5 * 60 * 1000; // Save every 5 minutes
  
  const intervalId = setInterval(async () => {
    logger.log('Performing scheduled session backup...', logger.LOG_LEVELS.DEBUG, 'SESSION');
    await saveSession(page);
  }, saveInterval);
  
  // Return function to clear the interval
  return function clearSessionSaving() {
    clearInterval(intervalId);
  };
}

module.exports = {
  saveSession,
  loadSession,
  getSessionFingerprint,
  scheduleSessionSaving
}; 