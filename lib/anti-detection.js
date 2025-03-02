/**
 * Anti-detection measures for Puppeteer automation
 * Helps avoid bot detection on Bumble and similar sites
 */
const logger = require('./logger');

/**
 * Apply page evasions to avoid common detection techniques
 * @param {Object} page Puppeteer page object
 */
async function applyEvasions(page) {
    logger.log('Applying anti-detection measures...', logger.LOG_LEVELS.DEBUG, 'SECURITY');
    
    try {
        await page.evaluateOnNewDocument(() => {
            // Store original navigator properties before modifying
            const _navigator = {};
            for (const property of Object.getOwnPropertyNames(navigator)) {
                try {
                    const descriptor = Object.getOwnPropertyDescriptor(navigator, property);
                    if (descriptor) {
                        Object.defineProperty(_navigator, property, descriptor);
                    }
                } catch (e) {
                    // Ignore errors
                }
            }
            
            // Fix infinite recursion issue - use a safer approach to override navigator properties
            
            // 1. Disguise puppeteer/automation flags
            const originalWebdriver = navigator.webdriver;
            Object.defineProperty(navigator, 'webdriver', {
                get: function() { return false; }
            });
            
            // 2. Safely add plugins array without recursion
            if (!navigator.plugins || navigator.plugins.length === 0) {
                const fakePlugins = [{
                    name: 'Chrome PDF Plugin',
                    description: 'Portable Document Format',
                    filename: 'internal-pdf-viewer',
                    length: 1
                }, {
                    name: 'Chrome PDF Viewer',
                    description: 'Chrome PDF Viewer',
                    filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                    length: 1
                }, {
                    name: 'Native Client',
                    description: '',
                    filename: 'internal-nacl-plugin',
                    length: 2
                }];
                
                Object.defineProperty(navigator, 'plugins', {
                    get: function() { return fakePlugins; },
                    enumerable: true,
                    configurable: true
                });
            }
            
            // 3. Safely add mimeTypes without recursion
            if (!navigator.mimeTypes || navigator.mimeTypes.length === 0) {
                const fakeMimeTypes = [
                    { type: 'application/pdf', suffixes: 'pdf', description: '' },
                    { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                    { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
                    { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' }
                ];
                
                Object.defineProperty(navigator, 'mimeTypes', {
                    get: function() { return fakeMimeTypes; },
                    enumerable: true,
                    configurable: true
                });
            }
            
            // 4. Safe permissions patch
            if (navigator.permissions) {
                const originalQuery = navigator.permissions.query;
                navigator.permissions.query = function(parameters) {
                    return parameters.name === 'notifications' ? 
                        Promise.resolve({ state: Notification.permission }) : 
                        originalQuery.call(this, parameters);
                };
            }
            
            // 5. Safe hardware concurrency override
            Object.defineProperty(navigator, 'hardwareConcurrency', {
                get: function() { return 8; },
                enumerable: true,
                configurable: true
            });
            
            // 6. Safe languages override
            const spoofedLanguages = ['en-US', 'en', 'es', 'fr'];
            if (Object.getOwnPropertyDescriptor(navigator, 'languages')) {
                Object.defineProperty(navigator, 'languages', {
                    get: function() { return spoofedLanguages; },
                    enumerable: true,
                    configurable: true
                });
            }
            
            // 7. Simplified WebGL fingerprinting fix
            if (window.WebGLRenderingContext) {
                const getParameterHandler = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) {
                        return 'Google Inc.';
                    } else if (parameter === 37446) {
                        return 'ANGLE (Intel, Intel(R) UHD Graphics, OpenGL 4.1)';
                    }
                    return getParameterHandler.apply(this, arguments);
                };
            }
        });
        
        // Add a more basic approach as fallback
        await page.evaluateOnNewDocument(() => {
            // Use a simple approach to hide automation
            delete Object.getPrototypeOf(navigator).webdriver;
        });
        
        logger.log('Anti-detection measures applied successfully', logger.LOG_LEVELS.SUCCESS, 'SECURITY');
    } catch (error) {
        logger.log(`Error applying anti-detection measures: ${error.message}`, logger.LOG_LEVELS.ERROR, 'SECURITY');
    }
}

/**
 * Apply random behavior patterns to mimic human interaction
 * @param {Object} page Puppeteer page object
 */
async function applyRandomBehavior(page) {
    try {
        // Randomize scrolling behavior
        await page.evaluateOnNewDocument(() => {
            // Store original functions
            const originalScrollTo = window.scrollTo;
            const originalScrollBy = window.scrollBy;
            
            // Override scrollTo to add randomness and smoothness
            window.scrollTo = function() {
                // Add slight randomness to coordinates
                if (arguments.length === 2) {
                    const x = arguments[0] + (Math.random() * 4 - 2);
                    const y = arguments[1] + (Math.random() * 4 - 2);
                    return originalScrollTo.call(this, x, y);
                }
                
                // Handle object parameter
                if (arguments.length === 1 && typeof arguments[0] === 'object') {
                    const arg = Object.assign({}, arguments[0]);
                    if (arg.top !== undefined) {
                        arg.top += (Math.random() * 4 - 2);
                    }
                    if (arg.left !== undefined) {
                        arg.left += (Math.random() * 4 - 2);
                    }
                    return originalScrollTo.call(this, arg);
                }
                
                return originalScrollTo.apply(this, arguments);
            };
            
            // Override scrollBy to add randomness and simulate human behavior
            window.scrollBy = function() {
                // Add slight randomness to coordinates
                if (arguments.length === 2) {
                    const x = arguments[0] + (Math.random() * 4 - 2);
                    const y = arguments[1] + (Math.random() * 4 - 2);
                    return originalScrollBy.call(this, x, y);
                }
                
                // Handle object parameter
                if (arguments.length === 1 && typeof arguments[0] === 'object') {
                    const arg = Object.assign({}, arguments[0]);
                    if (arg.top !== undefined) {
                        arg.top += (Math.random() * 4 - 2);
                    }
                    if (arg.left !== undefined) {
                        arg.left += (Math.random() * 4 - 2);
                    }
                    return originalScrollBy.call(this, arg);
                }
                
                return originalScrollBy.apply(this, arguments);
            };
        });
        
        logger.log('Random behavior patterns applied', logger.LOG_LEVELS.DEBUG, 'SECURITY');
    } catch (error) {
        logger.log(`Error applying random behavior: ${error.message}`, logger.LOG_LEVELS.ERROR, 'SECURITY');
    }
}

/**
 * Get plausible browser dimensions for a given device type
 * @returns {Object} Window dimensions that appear legitimate
 */
function getPlausibleDimensions() {
    // Common screen resolutions for desktop
    const commonResolutions = [
        { width: 1366, height: 768 },  // Most common
        { width: 1920, height: 1080 }, // Full HD
        { width: 1440, height: 900 },  // MacBook Pro
        { width: 1536, height: 864 },  // Common Windows
        { width: 1280, height: 800 },  // MacBook
        { width: 1680, height: 1050 }, // Larger screen
    ];
    
    // Choose a random common resolution
    const resolution = commonResolutions[Math.floor(Math.random() * commonResolutions.length)];
    
    // Apply slight random adjustments to account for browser chrome/toolbars
    const viewportHeight = resolution.height - (70 + Math.floor(Math.random() * 30)); // Account for browser UI
    
    return {
        width: resolution.width,
        height: viewportHeight
    };
}

/**
 * Set up an ongoing stream of random human-like actions
 * to make the session appear more realistic but with reduced frequency
 * @param {Object} page Puppeteer page object
 * @returns {Function} Function to stop the random actions
 */
function simulateHumanPresence(page) {
    // Simplified actions that occur less frequently
    const actions = [
        // Random minimal mouse movements - much less frequent
        async () => {
            try {
                // Only 10% chance of actually performing this action
                if (Math.random() > 0.9) {
                    const viewportSize = await page.evaluate(() => ({
                        width: window.innerWidth,
                        height: window.innerHeight
                    }));
                    
                    // Small mouse movement to a less random location (more central)
                    const centerX = viewportSize.width / 2;
                    const centerY = viewportSize.height / 2;
                    const maxOffset = 100;
                    
                    const x = centerX + (Math.random() * maxOffset * 2) - maxOffset;
                    const y = centerY + (Math.random() * maxOffset * 2) - maxOffset;
                    
                    await page.mouse.move(x, y);
                }
            } catch (error) {
                // Silently ignore errors during simulation
            }
        },
    ];
    
    // Schedule random subtle actions with much longer intervals
    const intervals = [];
    
    // Initialize action with a much longer interval (15-30 seconds)
    actions.forEach(action => {
        const intervalTime = Math.floor(Math.random() * 15000) + 15000;
        const interval = setInterval(async () => {
            // Only run the action 10% of the time when the interval fires
            if (Math.random() < 0.1) {
                await action();
            }
        }, intervalTime);
        
        intervals.push(interval);
    });
    
    // Return a function to stop all simulations
    return function stopSimulation() {
        intervals.forEach(clearInterval);
    };
}

module.exports = {
    applyEvasions,
    applyRandomBehavior,
    getPlausibleDimensions,
    simulateHumanPresence
}; 