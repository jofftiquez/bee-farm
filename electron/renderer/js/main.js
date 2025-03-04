/**
 * Initialize profile toggle buttons to switch between current and previous profiles
 */
function initializeProfileToggle() {
    // Create toggle container if not exists
    let toggleContainer = document.querySelector('.profile-toggle-container');
    if (!toggleContainer) {
        toggleContainer = document.createElement('div');
        toggleContainer.className = 'profile-toggle-container';
        toggleContainer.innerHTML = `
            <button id="currentProfileBtn" class="profile-toggle-btn active">Current Profile</button>
            <button id="previousProfileBtn" class="profile-toggle-btn">Previous Profile</button>
        `;
        
        // Find a good place to insert the toggle
        const mainContent = document.querySelector('.main-content') || document.body;
        mainContent.insertBefore(toggleContainer, mainContent.firstChild);
    }
    
    // Add event listeners if not already added
    document.getElementById('currentProfileBtn').addEventListener('click', function() {
        document.getElementById('currentProfileBtn').classList.add('active');
        document.getElementById('previousProfileBtn').classList.remove('active');
        
        // Show current profile
        if (window.profileModule && window.profileModule.displayCurrentProfile) {
            window.profileModule.displayCurrentProfile();
        }
        
        // Show current analysis
        if (window.analysisModule) {
            if (window.analysisModule.displayCurrentAnalysis) {
                window.analysisModule.displayCurrentAnalysis();
            } else if (window.currentAnalysis) {
                window.analysisModule.displayAnalysis(window.currentAnalysis);
            }
        }
    });
    
    document.getElementById('previousProfileBtn').addEventListener('click', function() {
        document.getElementById('previousProfileBtn').classList.add('active');
        document.getElementById('currentProfileBtn').classList.remove('active');
        
        // Try to show previous profile
        let profileShown = false;
        if (window.profileModule && window.profileModule.displayPreviousProfile) {
            profileShown = window.profileModule.displayPreviousProfile();
        }
        
        // Try to show previous analysis
        let analysisShown = false;
        if (window.analysisModule) {
            if (window.analysisModule.displayPreviousAnalysis) {
                analysisShown = window.analysisModule.displayPreviousAnalysis();
            } else if (window.previousAnalysis) {
                window.analysisModule.displayAnalysis(window.previousAnalysis, true);
                analysisShown = true;
            }
        }
        
        // If nothing to show, inform the user
        if (!profileShown && !analysisShown) {
            showMessage('No previous profile available', 'info');
        }
    });
    
    // Add styles for the toggle
    const style = document.createElement('style');
    style.textContent = `
        .profile-toggle-container {
            display: flex;
            justify-content: center;
            margin: 10px 0;
            padding: 5px;
            background: var(--card-bg);
            border-radius: 5px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .profile-toggle-btn {
            background: none;
            border: none;
            padding: 8px 15px;
            margin: 0 5px;
            cursor: pointer;
            border-radius: 4px;
            color: var(--text-color);
            transition: all 0.2s;
        }
        .profile-toggle-btn.active {
            background: var(--primary-color);
            color: white;
            font-weight: bold;
        }
        .previous-profile-badge {
            display: inline-block;
            background-color: var(--warning-color);
            color: white;
            border-radius: 4px;
            padding: 2px 8px;
            font-size: 12px;
            margin-bottom: 10px;
        }
    `;
    document.head.appendChild(style);
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Initialize modules
    if (window.logsModule) window.logsModule.initializeLogs();
    if (window.profileModule) window.profileModule.initializeProfile();
    if (window.analysisModule) window.analysisModule.initializeAnalysis();
    if (window.settingsModule) window.settingsModule.initializeSettings();
    
    // Initialize profile toggle
    initializeProfileToggle();
    
    // Other initialization
    setupEventListeners();
    setupThemeToggle();
    
    // Show initial UI state
    updateUIState({ isRunning: false });
});

/**
 * Display a message to the user
 * @param {string} message - Message to display
 * @param {string} type - Message type (info, success, warning, error)
 */
function showMessage(message, type = 'info') {
    // Create message element if not exists
    let messageContainer = document.querySelector('.message-container');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        document.body.appendChild(messageContainer);
    }
    
    // Create and add message
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type}`;
    messageElement.textContent = message;
    messageElement.style.animation = 'fadeInOut 4s forwards';
    messageContainer.appendChild(messageElement);
    
    // Remove after animation
    setTimeout(() => {
        messageElement.remove();
    }, 4000);
    
    // Add styles if not already added
    if (!document.querySelector('#message-styles')) {
        const style = document.createElement('style');
        style.id = 'message-styles';
        style.textContent = `
            .message-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
            }
            .message {
                margin-bottom: 10px;
                padding: 10px 15px;
                border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                max-width: 300px;
            }
            .message-info {
                background-color: var(--info-color, #2196F3);
                color: white;
            }
            .message-success {
                background-color: var(--success-color, #4CAF50);
                color: white;
            }
            .message-warning {
                background-color: var(--warning-color, #FF9800);
                color: white;
            }
            .message-error {
                background-color: var(--error-color, #F44336);
                color: white;
            }
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateY(-10px); }
                10% { opacity: 1; transform: translateY(0); }
                90% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }
} 