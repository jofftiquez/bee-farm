/**
 * Main application script for the Electron UI
 */

// Application state
const appState = {
    isRunning: false,
    stats: {
        swipes: 0,
        likes: 0,
        skips: 0
    }
};

/**
 * Initialize the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check if the API is available before initializing
        if (!window.api) {
            console.error('Electron API is not available. The preload script may not be working correctly.');
            alert('Application initialization failed: API not available');
            return;
        }

        // Initialize modules
        window.configModule.initializeConfigListeners();
        window.logsModule.initializeLogging();
        window.profileModule.initializeProfile();
        window.analysisModule.initializeAnalysis();
        
        // Load configuration
        await loadConfiguration();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set up status listener
        if (typeof window.api.onStatusChanged === 'function') {
            window.api.onStatusChanged((statusData) => {
                updateStatus(statusData);
            });
        } else {
            console.warn('Status change listener not available');
        }
        
        // Initial log
        window.logsModule.log('Application initialized', 'info', 'APP');
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('Application initialization failed: ' + error.message);
    }
});

/**
 * Load all configuration data
 */
async function loadConfiguration() {
    try {
        // Load user preferences
        await window.configModule.loadUserPreferences();
        
        // Load app config
        await window.configModule.loadAppConfig();
        
        window.logsModule.log('Configuration loaded', 'success', 'CONFIG');
    } catch (error) {
        console.error('Error loading configuration:', error);
        window.logsModule.log('Failed to load configuration', 'error', 'CONFIG');
    }
}

/**
 * Update the application status UI
 * @param {Object} statusData - Status data object
 */
function updateStatus(statusData) {
    // Update status indicator
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('statusText');
    
    // Clear previous classes
    statusDot.className = 'status-dot';
    
    // Set status based on state
    if (statusData.isRunning) {
        statusDot.classList.add('running');
        statusText.textContent = 'Running';
        appState.isRunning = true;
        
        // Update button states
        document.getElementById('startButton').disabled = true;
        document.getElementById('stopButton').disabled = false;
    } else if (statusData.isStopping) {
        statusDot.classList.add('stopping');
        statusText.textContent = 'Stopping...';
    } else if (statusData.hasError) {
        statusDot.classList.add('error');
        statusText.textContent = 'Error';
        appState.isRunning = false;
        
        // Update button states
        document.getElementById('startButton').disabled = false;
        document.getElementById('stopButton').disabled = true;
    } else {
        statusDot.classList.add('idle');
        statusText.textContent = 'Idle';
        appState.isRunning = false;
        
        // Update button states
        document.getElementById('startButton').disabled = false;
        document.getElementById('stopButton').disabled = true;
    }
    
    // Update stats if provided
    if (statusData.stats) {
        updateStats(statusData.stats);
    }
}

/**
 * Update stats display
 * @param {Object} stats - Statistics object
 */
function updateStats(stats) {
    appState.stats = { ...appState.stats, ...stats };
    
    document.getElementById('swipeCount').textContent = `Swipes: ${appState.stats.swipes || 0}`;
    document.getElementById('likeCount').textContent = `Likes: ${appState.stats.likes || 0}`;
    document.getElementById('skipCount').textContent = `Skips: ${appState.stats.skips || 0}`;
}

/**
 * Start the automation process
 */
async function startAutomation() {
    try {
        // Make sure configModule is available and has the readConfigFromUI function
        if (!window.configModule || typeof window.configModule.readConfigFromUI !== 'function') {
            throw new Error('Configuration module is not properly initialized');
        }

        // Read the latest config from UI
        window.configModule.readConfigFromUI();
        
        // Display a message to the user
        window.logsModule.log('Starting automation...', 'info', 'APP');
        window.logsModule.log('This will open a Puppeteer-controlled browser window', 'info', 'APP');
        
        // Clear previous profile and analysis
        if (window.profileModule && typeof window.profileModule.clearProfile === 'function') {
            window.profileModule.clearProfile();
        }
        
        if (window.analysisModule && typeof window.analysisModule.clearAnalysis === 'function') {
            window.analysisModule.clearAnalysis();
        }
        
        // Make sure API is available
        if (!window.api || typeof window.api.startAutomation !== 'function') {
            throw new Error('API not available. The preload script may not be working correctly.');
        }
        
        // Get LLM endpoint with a fallback
        const llmEndpoint = document.getElementById('llmEndpoint') ? 
            document.getElementById('llmEndpoint').value : 
            'http://localhost:11434/api/generate';
        
        // Update UI to show "starting" state
        document.getElementById('startButton').disabled = true;
        const statusDot = document.querySelector('.status-dot');
        statusDot.className = 'status-dot';
        statusDot.classList.add('running');
        document.getElementById('statusText').textContent = 'Starting...';
        
        // Send start command
        const result = await window.api.startAutomation({
            userPreferences: window.configModule.userPreferences,
            llmEndpoint: llmEndpoint
        });
        
        if (result && result.success) {
            window.logsModule.log('Automation process started successfully!', 'success', 'APP');
            window.logsModule.log('Browser window should open shortly.', 'info', 'APP');
            
            // Enable stop button
            document.getElementById('stopButton').disabled = false;
        } else {
            const errorMsg = result && result.error ? result.error : 'Unknown error';
            window.logsModule.log(`Failed to start: ${errorMsg}`, 'error', 'APP');
            
            // Reset UI
            document.getElementById('startButton').disabled = false;
            statusDot.className = 'status-dot idle';
            document.getElementById('statusText').textContent = 'Idle';
        }
    } catch (error) {
        console.error('Error starting automation:', error);
        
        // Make sure logsModule is available
        if (window.logsModule && typeof window.logsModule.log === 'function') {
            window.logsModule.log(`Error starting automation: ${error.message}`, 'error', 'APP');
        } else {
            alert(`Error starting automation: ${error.message}`);
        }
        
        // Reset UI
        document.getElementById('startButton').disabled = false;
        const statusDot = document.querySelector('.status-dot');
        statusDot.className = 'status-dot idle';
        document.getElementById('statusText').textContent = 'Idle';
    }
}

/**
 * Stop the automation process
 */
async function stopAutomation() {
    try {
        // Update UI first to give immediate feedback
        document.getElementById('stopButton').disabled = true;
        const statusDot = document.querySelector('.status-dot');
        statusDot.className = 'status-dot';
        statusDot.classList.add('stopping');
        document.getElementById('statusText').textContent = 'Stopping...';
        
        window.logsModule.log('Stopping automation...', 'warning', 'APP');
        
        // Make sure API is available
        if (!window.api || typeof window.api.stopAutomation !== 'function') {
            throw new Error('API not available. The preload script may not be working correctly.');
        }

        const result = await Promise.race([
            window.api.stopAutomation(),
            new Promise((resolve) => {
                // Add a timeout in case the stop operation hangs
                setTimeout(() => {
                    resolve({ 
                        success: false, 
                        error: 'Stop operation timed out. The application may need to be restarted.' 
                    });
                }, 10000);
            })
        ]);
        
        if (result && result.success) {
            // Make sure logsModule is available
            if (window.logsModule && typeof window.logsModule.log === 'function') {
                window.logsModule.log('Automation stopped successfully', 'success', 'APP');
            } else {
                console.log('Automation stopped successfully');
            }
            
            // Update UI
            document.getElementById('startButton').disabled = false;
            statusDot.className = 'status-dot idle';
            document.getElementById('statusText').textContent = 'Idle';
        } else {
            const errorMsg = result && result.error ? result.error : 'Unknown error';
            
            // Make sure logsModule is available
            if (window.logsModule && typeof window.logsModule.log === 'function') {
                window.logsModule.log(`Failed to stop: ${errorMsg}`, 'error', 'APP');
                
                if (errorMsg.includes('timed out')) {
                    window.logsModule.log('The application may need to be restarted to recover', 'warning', 'APP');
                }
            } else {
                console.error(`Failed to stop: ${errorMsg}`);
                alert(`Failed to stop: ${errorMsg}`);
            }
            
            // Still update UI to idle state
            document.getElementById('startButton').disabled = false;
            document.getElementById('stopButton').disabled = true;
            statusDot.className = 'status-dot idle';
            document.getElementById('statusText').textContent = 'Idle';
        }
    } catch (error) {
        console.error('Error stopping automation:', error);
        
        // Make sure logsModule is available
        if (window.logsModule && typeof window.logsModule.log === 'function') {
            window.logsModule.log(`Error stopping automation: ${error.message}`, 'error', 'APP');
        } else {
            alert(`Error stopping automation: ${error.message}`);
        }
        
        // Update UI to idle state anyway
        document.getElementById('startButton').disabled = false;
        document.getElementById('stopButton').disabled = true;
        const statusDot = document.querySelector('.status-dot');
        statusDot.className = 'status-dot idle';
        document.getElementById('statusText').textContent = 'Idle';
    }
}

/**
 * Set up event listeners for the UI
 */
function setupEventListeners() {
    // Start button
    document.getElementById('startButton').addEventListener('click', startAutomation);
    
    // Stop button
    document.getElementById('stopButton').addEventListener('click', stopAutomation);
}

// Export app functions if needed
window.app = {
    startAutomation,
    stopAutomation
}; 