/**
 * Logging module for the Electron app
 * Handles displaying logs in the UI
 */

// Log storage
const logs = [];
let currentFilter = 'all';

/**
 * Initialize the logging module
 */
function initializeLogging() {
    // Set up drawer toggle
    document.getElementById('toggleLogsDrawer').addEventListener('click', () => {
        const logsDrawer = document.getElementById('logsDrawer');
        logsDrawer.classList.toggle('open');
    });
    
    document.getElementById('closeLogsDrawer').addEventListener('click', () => {
        document.getElementById('logsDrawer').classList.remove('open');
    });
    
    // Set up log filter
    document.getElementById('logLevelFilter').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        renderLogs();
    });
    
    // Set up clear logs button
    document.getElementById('clearLogs').addEventListener('click', clearLogs);
    
    // Set up IPC log receiver
    if (window.api && typeof window.api.onLog === 'function') {
        window.api.onLog((logData) => {
            addLog(logData);
        });
    } else {
        console.warn('Log API not available, logging will be limited to UI events');
        // Add an initial warning log
        addLog({
            message: 'API communication not available. Logging will be limited to UI events.',
            level: 'warning',
            label: 'SYSTEM'
        });
    }
}

/**
 * Add a log entry to the system
 * @param {Object} logData - Log data object
 * @param {string} logData.message - The log message
 * @param {string} logData.level - Log level (info, success, warning, error, llm)
 * @param {string} [logData.label] - Optional label for categorizing the log
 * @param {Date} [logData.timestamp] - Timestamp for the log (defaults to now)
 */
function addLog(logData) {
    const timestamp = logData.timestamp ? new Date(logData.timestamp) : new Date();
    
    // Add to logs array
    logs.push({
        ...logData,
        timestamp,
        id: Date.now() + Math.random().toString(36).substr(2, 5) // Simple unique ID
    });
    
    // Limit logs to last 1000 entries
    if (logs.length > 1000) {
        logs.shift();
    }
    
    // Update UI
    renderLogs();
}

/**
 * Log a message directly from the UI
 * @param {string} message - The message to log
 * @param {string} level - Log level
 * @param {string} label - Optional label
 */
function log(message, level = 'info', label = null) {
    addLog({
        message,
        level,
        label
    });
}

/**
 * Clear all logs
 */
function clearLogs() {
    logs.length = 0;
    renderLogs();
}

/**
 * Render logs to the UI
 */
function renderLogs() {
    const logsContainer = document.getElementById('logsList');
    logsContainer.innerHTML = '';
    
    // Filter logs if needed
    const filteredLogs = currentFilter === 'all' 
        ? logs 
        : logs.filter(log => log.level === currentFilter);
    
    // Create elements for each log
    filteredLogs.forEach(log => {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        // Timestamp
        const timestamp = document.createElement('span');
        timestamp.className = 'log-timestamp';
        timestamp.textContent = log.timestamp.toLocaleTimeString();
        logEntry.appendChild(timestamp);
        
        // Level
        const levelSpan = document.createElement('span');
        levelSpan.className = `log-level ${log.level}`;
        levelSpan.textContent = log.level.toUpperCase();
        logEntry.appendChild(levelSpan);
        
        // Label (if any)
        if (log.label) {
            const labelSpan = document.createElement('span');
            labelSpan.className = 'log-label';
            labelSpan.textContent = `[${log.label}]`;
            logEntry.appendChild(labelSpan);
        }
        
        // Message
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = log.message;
        logEntry.appendChild(messageSpan);
        
        logsContainer.appendChild(logEntry);
    });
    
    // Scroll to bottom
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

// Export functions
window.logsModule = {
    initializeLogging,
    log,
    clearLogs
}; 