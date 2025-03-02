const { delay } = require('./utils');

/**
 * Function to handle graceful shutdown
 * @param {Object} browser The browser instance to close
 * @param {Function} closeBrowser Function to close the browser
 */
async function handleShutdown(browser, closeBrowser) {
    console.log('Shutting down...');
    
    try {
        if (browser) {
            console.log('Closing browser...');
            await closeBrowser();
            console.log('Browser closed');
        }
    } catch (error) {
        console.error('Error during shutdown:', error.message);
    }
    
    console.log('Shutdown completed');
    process.exit(0);
}

/**
 * Set up signal handlers for graceful shutdown
 * @param {Object} browser The browser instance to close
 * @param {Function} closeBrowser Function to close the browser
 */
function setupSignalHandlers(browser, closeBrowser) {
    // Handle Ctrl+C
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT signal (Ctrl+C)');
        await handleShutdown(browser, closeBrowser);
    });
    
    // Handle termination signal
    process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM signal');
        await handleShutdown(browser, closeBrowser);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
        console.error('\nUncaught exception:', error);
        await handleShutdown(browser, closeBrowser);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
        console.error('\nUnhandled promise rejection:', reason);
        await handleShutdown(browser, closeBrowser);
    });
}

module.exports = {
    handleShutdown,
    setupSignalHandlers
}; 