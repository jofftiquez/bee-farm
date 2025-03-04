/**
 * Configuration management module for the Electron app
 */

// User preferences structure (from user_preferences.json)
let userPreferences = {
    personalDescription: '',
    interests: [],
    avoidKeywords: [],
    requireBio: true,
    alignmentThreshold: 0.3,
    llmSettings: {
        enabled: true,
        minComparisonScore: 0.5
    },
    requireVerified: false,
    swipeRightPercentage: 18,
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

// App configuration
let appConfig = {};

/**
 * Load user preferences from main process
 */
async function loadUserPreferences() {
    try {
        // Check if window.api exists before trying to call methods on it
        if (!window.api || typeof window.api.getUserPreferences !== 'function') {
            throw new Error('API not available. The preload script may not be working correctly.');
        }
        
        const preferences = await window.api.getUserPreferences();
        userPreferences = { ...userPreferences, ...preferences };
        updateConfigUI();
    } catch (error) {
        console.error('Error loading user preferences:', error);
        showNotification('Failed to load preferences: ' + error.message, 'error');
    }
}

/**
 * Load application configuration
 */
async function loadAppConfig() {
    try {
        // Check if window.api exists before trying to call methods on it
        if (!window.api || typeof window.api.getConfig !== 'function') {
            throw new Error('API not available. The preload script may not be working correctly.');
        }
        
        const config = await window.api.getConfig();
        appConfig = config;
    } catch (error) {
        console.error('Error loading app config:', error);
        showNotification('Failed to load app configuration: ' + error.message, 'error');
    }
}

/**
 * Save user preferences to main process
 */
async function saveUserPreferences() {
    try {
        // Check if window.api exists before trying to call methods on it
        if (!window.api || typeof window.api.saveUserPreferences !== 'function') {
            throw new Error('API not available. The preload script may not be working correctly.');
        }
        
        await window.api.saveUserPreferences(userPreferences);
        showNotification('Configuration saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving user preferences:', error);
        showNotification('Failed to save configuration: ' + error.message, 'error');
    }
}

/**
 * Update the UI with current config values
 */
function updateConfigUI() {
    // Personal details
    document.getElementById('personalDescription').value = userPreferences.personalDescription || '';
    document.getElementById('interests').value = userPreferences.interests ? userPreferences.interests.join(', ') : '';
    document.getElementById('avoidKeywords').value = userPreferences.avoidKeywords ? userPreferences.avoidKeywords.join(', ') : '';
    
    // Checkboxes
    document.getElementById('requireBio').checked = userPreferences.requireBio !== false;
    
    // Sliders
    const alignmentThreshold = document.getElementById('alignmentThreshold');
    alignmentThreshold.value = userPreferences.alignmentThreshold || 0.3;
    document.getElementById('alignmentThresholdValue').textContent = alignmentThreshold.value;
    
    const swipeRightPercentage = document.getElementById('swipeRightPercentage');
    swipeRightPercentage.value = userPreferences.swipeRightPercentage || 18;
    document.getElementById('swipeRightPercentageValue').textContent = `${swipeRightPercentage.value}%`;
    
    // LLM settings
    const llmEnabled = document.getElementById('llmEnabled');
    llmEnabled.checked = userPreferences.llmSettings?.enabled !== false;
    
    const minComparisonScore = document.getElementById('minComparisonScore');
    minComparisonScore.value = userPreferences.llmSettings?.minComparisonScore || 0.5;
    document.getElementById('minComparisonScoreValue').textContent = minComparisonScore.value;
    
    // Endpoint
    document.getElementById('llmEndpoint').value = window.localStorage.getItem('llmEndpoint') || 'http://localhost:11434/api/generate';
    
    // Age preferences
    document.getElementById('agePreferenceEnabled').checked = userPreferences.agePreference?.enabled === true;
    document.getElementById('minAge').value = userPreferences.agePreference?.minAge || 18;
    document.getElementById('maxAge').value = userPreferences.agePreference?.maxAge || 45;
}

/**
 * Read values from UI and update config object
 */
function readConfigFromUI() {
    // Personal details
    userPreferences.personalDescription = document.getElementById('personalDescription').value;
    userPreferences.interests = document.getElementById('interests').value
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    userPreferences.avoidKeywords = document.getElementById('avoidKeywords').value
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
    
    // Checkboxes
    userPreferences.requireBio = document.getElementById('requireBio').checked;
    
    // Sliders
    userPreferences.alignmentThreshold = parseFloat(document.getElementById('alignmentThreshold').value);
    userPreferences.swipeRightPercentage = parseInt(document.getElementById('swipeRightPercentage').value);
    
    // LLM settings
    if (!userPreferences.llmSettings) {
        userPreferences.llmSettings = {};
    }
    userPreferences.llmSettings.enabled = document.getElementById('llmEnabled').checked;
    userPreferences.llmSettings.minComparisonScore = parseFloat(document.getElementById('minComparisonScore').value);
    
    // Store endpoint in local storage
    window.localStorage.setItem('llmEndpoint', document.getElementById('llmEndpoint').value);
    
    // Age preferences
    if (!userPreferences.agePreference) {
        userPreferences.agePreference = {};
    }
    userPreferences.agePreference.enabled = document.getElementById('agePreferenceEnabled').checked;
    userPreferences.agePreference.minAge = parseInt(document.getElementById('minAge').value);
    userPreferences.agePreference.maxAge = parseInt(document.getElementById('maxAge').value);
}

/**
 * Setup event listeners for config UI
 */
function initializeConfigListeners() {
    // Drawer toggle
    document.getElementById('toggleConfigDrawer').addEventListener('click', () => {
        const configDrawer = document.getElementById('configDrawer');
        configDrawer.classList.toggle('open');
    });
    
    document.getElementById('closeConfigDrawer').addEventListener('click', () => {
        document.getElementById('configDrawer').classList.remove('open');
    });
    
    // Range input updates
    document.getElementById('alignmentThreshold').addEventListener('input', function() {
        document.getElementById('alignmentThresholdValue').textContent = this.value;
    });
    
    document.getElementById('swipeRightPercentage').addEventListener('input', function() {
        document.getElementById('swipeRightPercentageValue').textContent = `${this.value}%`;
    });
    
    document.getElementById('minComparisonScore').addEventListener('input', function() {
        document.getElementById('minComparisonScoreValue').textContent = this.value;
    });
    
    // Save button
    document.getElementById('saveConfig').addEventListener('click', () => {
        readConfigFromUI();
        saveUserPreferences();
    });
}

/**
 * Show a notification to the user
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (success, error, warning)
 */
function showNotification(message, type = 'info') {
    // Simple notification implementation - could be enhanced later
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // If notification UI element exists, show the notification
    const notificationContainer = document.createElement('div');
    notificationContainer.className = `notification ${type}`;
    notificationContainer.textContent = message;
    
    document.body.appendChild(notificationContainer);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notificationContainer.remove();
    }, 3000);
}

// Export functions
window.configModule = {
    loadUserPreferences,
    loadAppConfig,
    saveUserPreferences,
    userPreferences,
    appConfig,
    initializeConfigListeners,
    readConfigFromUI
}; 