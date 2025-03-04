const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const os = require('os');
const axios = require('axios');

// Require core modules
let logger, profileAnalysis, config, llmIntegration, browser, swipeLogic, session, utils, cleanup, antiDetection;
try {
  logger = require('../lib/logger');
  profileAnalysis = require('../lib/profile-analysis');
  config = require('../lib/config');
  llmIntegration = require('../lib/llm-integration');
  browser = require('../lib/browser');
  swipeLogic = require('../lib/swipe-logic');
  session = require('../lib/session');
  utils = require('../lib/utils');
  cleanup = require('../lib/cleanup');
  antiDetection = require('../lib/anti-detection');
} catch (error) {
  console.error('Failed to import core modules:', error);
}

// Initialize the config store
const store = new Store();

// Set up the main window
let mainWindow;

// Track automation state
let automationProcess = null;
let isAutomationRunning = false;
let browserInstance = null;
let page = null;
let clearSessionInterval = null;
let userPreferences = null;
let currentStats = {
  swipes: 0,
  likes: 0,
  skips: 0
};

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Event handler for when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when app is ready
app.whenReady().then(() => {
  createWindow();
  
  // For debugging - Send mock profile data to test UI display after a short delay
  setTimeout(() => {
    sendMockProfileData();
    sendLogToUI('Sent mock profile data for testing UI display', 'info', 'DEBUG');
  }, 1500);

  // Check LLM connection when app starts
  if (llmIntegration && llmIntegration.checkLlamaApiConnection) {
    // Load user preferences first
    try {
      const prefsPath = path.join(process.cwd(), 'user_preferences.json');
      if (fs.existsSync(prefsPath)) {
        userPreferences = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
        sendLogToUI('Loaded user preferences', 'debug', 'CONFIG');
      } else {
        userPreferences = {
          swipeRightPercentage: 18,
          interests: [],
          avoidKeywords: [],
          requireBio: true,
          alignmentThreshold: 0.3,
          llmSettings: { enabled: false, minComparisonScore: 0.5 }
        };
      }
    } catch (error) {
      sendLogToUI(`Error loading preferences: ${error.message}`, 'error', 'CONFIG');
    }

    // Test a simple prompt first before checking the connection
    async function testSimplePrompt() {
      try {
        const endpoint = llmIntegration.getLlamaEndpoint(userPreferences);
        sendLogToUI(`Testing Llama API with a simple prompt at ${endpoint}`, 'debug', 'LLM');
        
        const response = await axios.post(endpoint, {
          model: 'llama3:latest',
          prompt: 'Hello, how are you?',
          stream: false,
          temperature: 0.1,
          max_tokens: 10
        }, { timeout: 5000 });
        
        const text = response.data.response || response.data.generated_text || '';
        if (text) {
          sendLogToUI('Llama API response: ' + text.substring(0, 30) + '...', 'debug', 'LLM');
          return true;
        }
        return false;
      } catch (error) {
        sendLogToUI(`Simple prompt test failed: ${error.message}`, 'debug', 'LLM');
        return false;
      }
    }

    // First test with a simple prompt
    testSimplePrompt()
      .then(simplePromptWorks => {
        if (simplePromptWorks) {
          sendLogToUI('✅ Llama API is functioning correctly with simple prompts', 'success', 'LLM');
        } else {
          sendLogToUI('Llama API failed simple prompt test', 'warning', 'LLM');
        }
        
        // Now check the full connection
        return llmIntegration.checkLlamaApiConnection(userPreferences);
      })
      .then(isConnected => {
        if (!isConnected) {
          sendLogToUI('Warning: Cannot connect to Llama 3 API. LLM analysis will be disabled.', 'warning', 'LLM');
          sendLogToUI('To use LLM analysis, please ensure Ollama is running with Llama 3 model installed.', 'info', 'LLM');
          sendLogToUI('Install from: https://ollama.ai/ and run: ollama pull llama3', 'info', 'LLM');
        } else {
          sendLogToUI('Successfully connected to Llama 3 API', 'success', 'LLM');
        }
      })
      .catch(error => {
        sendLogToUI(`Error checking LLM connection: ${error.message}`, 'error', 'LLM');
      });
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up before quit
app.on('before-quit', async (event) => {
  if (isAutomationRunning) {
    event.preventDefault();
    
    try {
      // Run with a timeout to prevent hanging
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.log('Forced quit due to timeout');
          resolve();
        }, 10000); // 10 second timeout
      });
      
      await Promise.race([
        stopAutomation(),
        timeoutPromise
      ]);
      
      app.quit();
    } catch (error) {
      console.error('Error during shutdown:', error);
      app.exit(1); // Force exit with error code
    }
  }
});

// IPC handlers
ipcMain.handle('get-user-preferences', async () => {
  try {
    const userPrefsPath = path.join(app.getPath('userData'), 'user_preferences.json');
    // If user preferences don't exist yet in app data, copy from project folder
    if (!fs.existsSync(userPrefsPath)) {
      const defaultPrefsPath = path.join(__dirname, '../user_preferences.json');
      if (fs.existsSync(defaultPrefsPath)) {
        const defaultPrefs = JSON.parse(fs.readFileSync(defaultPrefsPath, 'utf8'));
        fs.writeFileSync(userPrefsPath, JSON.stringify(defaultPrefs, null, 2));
        return defaultPrefs;
      }
      // Return empty preferences if no default found
      return {};
    }
    
    // Return existing preferences
    return JSON.parse(fs.readFileSync(userPrefsPath, 'utf8'));
  } catch (error) {
    console.error('Error loading user preferences:', error);
    return {};
  }
});

ipcMain.handle('save-user-preferences', async (event, preferences) => {
  try {
    const userPrefsPath = path.join(app.getPath('userData'), 'user_preferences.json');
    fs.writeFileSync(userPrefsPath, JSON.stringify(preferences, null, 2));
    
    // Update our local copy
    userPreferences = preferences;
    
    return { success: true };
  } catch (error) {
    console.error('Error saving user preferences:', error);
    return { success: false, error: error.message };
  }
});

// Load and save config
ipcMain.handle('get-config', async () => {
  try {
    const savedConfig = store.get('config');
    if (savedConfig) {
      return savedConfig;
    }
    return config || {};
  } catch (error) {
    console.error('Error loading config:', error);
    return {};
  }
});

ipcMain.handle('save-config', async (event, newConfig) => {
  try {
    store.set('config', newConfig);
    
    // Update the actual config object if it exists
    if (config) {
      Object.assign(config, newConfig);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving config:', error);
    return { success: false, error: error.message };
  }
});

// Get logs - this is just a stub, real implementation would depend on how logs are stored
ipcMain.handle('get-logs', async () => {
  return [];
});

// Start automation
ipcMain.handle('start-automation', async (event, settings) => {
  try {
    if (isAutomationRunning) {
      return { success: false, error: 'Automation is already running' };
    }
    
    // Configure LLM endpoint if provided
    if (settings.llmEndpoint && llmIntegration) {
      process.env.LLAMA_ENDPOINT = settings.llmEndpoint;
    }
    
    // Store the user preferences with defaults
    userPreferences = settings.userPreferences || {};
    
    // Ensure required properties exist with default values
    if (!userPreferences.swipeRightPercentage && userPreferences.swipeRightPercentage !== 0) {
      userPreferences.swipeRightPercentage = 18; // Default value
      sendLogToUI('Using default swipe right percentage: 18%', 'warning', 'CONFIG');
    }
    
    if (!userPreferences.alignmentThreshold && userPreferences.alignmentThreshold !== 0) {
      userPreferences.alignmentThreshold = 0.3; // Default value
      sendLogToUI('Using default alignment threshold: 0.3', 'warning', 'CONFIG');
    }
    
    if (!userPreferences.interests) {
      userPreferences.interests = [];
      sendLogToUI('No interests found in user preferences', 'warning', 'CONFIG');
    }
    
    if (!userPreferences.avoidKeywords) {
      userPreferences.avoidKeywords = [];
      sendLogToUI('No avoid keywords found in user preferences', 'warning', 'CONFIG');
    }
    
    if (userPreferences.requireBio === undefined) {
      userPreferences.requireBio = true;
      sendLogToUI('Using default requireBio setting: true', 'warning', 'CONFIG');
    }
    
    if (!userPreferences.llmSettings) {
      userPreferences.llmSettings = { enabled: false, minComparisonScore: 0.5 };
      sendLogToUI('Using default LLM settings', 'warning', 'CONFIG');
    }
    
    // Log the user preferences for debugging
    sendLogToUI('User preferences loaded with swipeRightPercentage: ' + userPreferences.swipeRightPercentage, 'info', 'CONFIG');
    
    // Reset stats
    currentStats = {
      swipes: 0,
      likes: 0,
      skips: 0
    };
    
    // Send status update
    mainWindow.webContents.send('status-changed', {
      isRunning: true,
      stats: currentStats
    });
    
    // Log startup
    sendLogToUI('Starting Bumble automation...', 'info', 'APP');
    
    // Start the actual automation
    await startBrowserAutomation();
    
    return { success: true };
  } catch (error) {
    console.error('Error starting automation:', error);
    sendLogToUI(`Error starting automation: ${error.message}`, 'error', 'APP');
    
    // Update status
    mainWindow.webContents.send('status-changed', {
      isRunning: false,
      hasError: true,
      stats: currentStats
    });
    
    return { success: false, error: error.message };
  }
});

// Actually start the browser and automation
async function startBrowserAutomation() {
  if (!browser || !browser.initBrowser) {
    throw new Error('Browser module not available');
  }
  
  sendLogToUI('Initializing browser...', 'info', 'BROWSER');
  
  try {
    // Initialize the browser with more human-like parameters
    const result = await browser.initBrowser({
      headless: false,  // Always use headed mode in UI
      slowMo: Math.floor(Math.random() * 15) + 10, // Slightly slower to appear more human-like
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        `--window-size=${Math.floor(Math.random() * 200) + 1024},${Math.floor(Math.random() * 200) + 768}`
      ]
    });
    
    browserInstance = result.browser;
    page = result.page;
    
    // Apply anti-detection measures
    if (antiDetection && typeof antiDetection.applyEvasions === 'function') {
      sendLogToUI('Applying anti-detection measures...', 'info', 'SECURITY');
      await antiDetection.applyEvasions(page);
      await antiDetection.applyRandomBehavior(page);
      
      // Start human presence simulation
      const stopHumanSimulation = antiDetection.simulateHumanPresence(page);
      
      // Store the stop function to use when closing the browser
      app.stopHumanSimulation = stopHumanSimulation;
    }
    
    // Set up session saving
    if (session && session.scheduleSessionSaving) {
      clearSessionInterval = session.scheduleSessionSaving(page);
    }
    
    // Set up signal handlers
    if (cleanup && cleanup.setupSignalHandlers) {
      cleanup.setupSignalHandlers(browserInstance, cleanupResourcesHandler);
    }
    
    // Check login status
    sendLogToUI('Checking authentication status...', 'info', 'AUTH');
    
    let isLoggedIn = false;
    if (browser.checkLoginStatus) {
      isLoggedIn = await browser.checkLoginStatus(page);
    }
    
    if (isLoggedIn) {
      sendLogToUI('Already logged in! Session was successfully restored.', 'success', 'AUTH');
      
      // Save session after successful login
      if (session && session.saveSession) {
        await session.saveSession(page);
      }
    } else {
      sendLogToUI('Not logged in. Please log into Bumble when the browser opens.', 'warning', 'AUTH');
      sendLogToUI('Your login will be remembered for future sessions.', 'info', 'AUTH');
      
      // Wait for login to complete
      if (browser.waitForLogin) {
        await browser.waitForLogin(page);
      } else {
        // Fallback - wait for user to navigate
        sendLogToUI('Please log in manually and navigate to the swiping interface.', 'warning', 'AUTH');
      }
      
      // Save session after manual login
      if (session && session.saveSession) {
        await session.saveSession(page);
      }
    }
    
    // Start the swiping process
    await startSwipingProcess(page);
    
  } catch (error) {
    sendLogToUI(`Error during browser initialization: ${error.message}`, 'error', 'BROWSER');
    throw error;
  }
}

// Start the main swiping process
async function startSwipingProcess(page) {
  sendLogToUI('Starting swiping process...', 'info', 'SWIPE');
  
  // Set the flag
  isAutomationRunning = true;
  
  // Start swiping in a separate process to not block the main thread
  (async () => {
    try {
      while (isAutomationRunning) {
        // Extract profile info
        let profileInfo = null;
        try {
          if (profileAnalysis && profileAnalysis.extractProfileInfo) {
            profileInfo = await profileAnalysis.extractProfileInfo(page);
            
            // Send profile to UI
            if (profileInfo) {
              // Send profile without analysis first
              const profileWithoutAnalysis = { ...profileInfo };
              delete profileWithoutAnalysis.analysis; // Remove analysis if it exists
              
              // Send the profile data to UI
              mainWindow.webContents.send('profile-analyzed', profileWithoutAnalysis);
              
              // Notify that analysis is starting
              mainWindow.webContents.send('analysis-status', { 
                status: 'started',
                profileId: profileInfo.name || 'Unknown Profile'
              });
              
              // Get user preferences for analysis
              try {
                // Get user preferences - using proper method from config module
                const userPreferences = await config.getPreferences();
                
                // Analyze profile alignment with user preferences
                const analysisResult = await profileAnalysis.analyzeProfileAlignment(profileInfo, userPreferences);
                
                // Add analysis to the profile info
                profileInfo.analysis = analysisResult;
                
                // Send updated profile with analysis to UI
                mainWindow.webContents.send('profile-analyzed', profileInfo);
                
                // Also send separate analysis status update
                mainWindow.webContents.send('analysis-status', {
                  status: 'completed',
                  profileId: profileInfo.name || 'Unknown Profile',
                  analysis: analysisResult
                });
              } catch (analysisError) {
                sendLogToUI(`Error analyzing profile: ${analysisError.message}`, 'error', 'ANALYSIS');
                
                // Send analysis error to UI
                mainWindow.webContents.send('analysis-status', {
                  status: 'error',
                  profileId: profileInfo.name || 'Unknown Profile',
                  error: analysisError.message
                });
              }
            } else {
              sendLogToUI('Could not extract profile info', 'warning', 'PROFILE');
            }
          }
        } catch (profileError) {
          sendLogToUI(`Error extracting profile: ${profileError.message}`, 'error', 'PROFILE');
          // Continue to next profile instead of stopping completely
          await utils.delay(2000);
          continue;
        }
        
        // Make swiping decision
        let decision = 'dislike';
        let decisionReason = 'No decision logic available';
        
        try {
          if (swipeLogic && swipeLogic.processProfile && profileInfo) {
            // Debug user preferences
            sendLogToUI(`DEBUG: User preferences before swipe: ${JSON.stringify({
              hasPrefs: !!userPreferences,
              type: typeof userPreferences,
              llmEnabled: userPreferences?.llmSettings?.enabled,
              interests: userPreferences?.interests?.length || 0
            })}`, 'debug', 'CONFIG');
            
            // Double-check user preferences are available
            if (!userPreferences || typeof userPreferences !== 'object') {
              userPreferences = {
                swipeRightPercentage: 18,
                interests: [],
                avoidKeywords: [],
                requireBio: true,
                alignmentThreshold: 0.3,
                llmSettings: { enabled: true, minComparisonScore: 0.5 }
              };
              sendLogToUI('Using fallback user preferences with LLM enabled', 'warning', 'CONFIG');
            }
            
            // Additional debug after potential fallback
            sendLogToUI(`DEBUG: User preferences after check: ${JSON.stringify({
              hasPrefs: !!userPreferences,
              type: typeof userPreferences,
              llmEnabled: userPreferences?.llmSettings?.enabled,
              interests: userPreferences?.interests?.length || 0
            })}`, 'debug', 'CONFIG');
            
            const result = await swipeLogic.processProfile(page, profileInfo, userPreferences);
            decision = result.decision;
            decisionReason = result.reason;
            
            // Update stats
            currentStats.swipes++;
            if (decision === 'like') {
              currentStats.likes++;
            } else {
              currentStats.skips++;
            }
            
            // Send updated stats to UI
            mainWindow.webContents.send('status-changed', {
              isRunning: true,
              stats: currentStats
            });
          } else {
            // Fallback logic if swipeLogic is not available
            sendLogToUI('Swipe logic not available, using random decision', 'warning', 'SWIPE');
            
            // Random decision (20% like, 80% dislike)
            decision = Math.random() < 0.2 ? 'like' : 'dislike';
            decisionReason = 'Random decision (fallback mode)';
            
            // Basic UI update - use try/catch to handle potential errors
            try {
              const buttons = await page.$$('.encounters-action');
              if (buttons.length >= 2) {
                if (decision === 'like') {
                  await buttons[1].click();
                } else {
                  await buttons[0].click();
                }
              } else {
                sendLogToUI('Could not find swipe buttons', 'error', 'SWIPE');
              }
            } catch (buttonError) {
              sendLogToUI(`Error clicking buttons: ${buttonError.message}`, 'error', 'SWIPE');
            }
            
            // Update stats
            currentStats.swipes++;
            if (decision === 'like') {
              currentStats.likes++;
            } else {
              currentStats.skips++;
            }
            
            // Send updated stats to UI
            mainWindow.webContents.send('status-changed', {
              isRunning: true,
              stats: currentStats
            });
          }
        } catch (swipeError) {
          sendLogToUI(`Error processing profile: ${swipeError.message}`, 'error', 'PROCESS');
          // Continue to next profile instead of stopping completely
          await utils.delay(2000);
          continue;
        }
        
        // Wait before next profile
        const waitTime = Math.floor(Math.random() * 1000) + 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Check if we should continue
        if (!isAutomationRunning) {
          break;
        }
      }
      
      sendLogToUI('Swiping process complete or stopped', 'info', 'SWIPE');
      
    } catch (error) {
      sendLogToUI(`Error during swiping process: ${error.message}`, 'error', 'SWIPE');
      
      // Update status
      mainWindow.webContents.send('status-changed', {
        isRunning: false,
        hasError: true,
        stats: currentStats
      });
      
      await stopAutomation();
    }
  })();
}

// Stop automation
ipcMain.handle('stop-automation', async () => {
  try {
    if (!isAutomationRunning) {
      return { success: false, error: 'Automation is not running' };
    }
    
    await stopAutomation();
    return { success: true };
  } catch (error) {
    console.error('Error stopping automation:', error);
    return { success: false, error: error.message };
  }
});

// Clean up resources
function cleanupResourcesHandler() {
  stopAutomation();
}

// Helper to stop automation
async function stopAutomation() {
  // Send status update
  if (mainWindow) {
    mainWindow.webContents.send('status-changed', {
      isRunning: false,
      isStopping: true
    });
  }
  
  sendLogToUI('Stopping automation...', 'warning', 'APP');
  
  isAutomationRunning = false;
  
  // Stop human presence simulation if active
  if (app.stopHumanSimulation && typeof app.stopHumanSimulation === 'function') {
    try {
      app.stopHumanSimulation();
      sendLogToUI('Human simulation stopped', 'debug', 'CLEANUP');
      app.stopHumanSimulation = null;
    } catch (error) {
      sendLogToUI(`Error stopping human simulation: ${error.message}`, 'error', 'CLEANUP');
    }
  }
  
  // Cancel the session saving interval if it exists
  if (clearSessionInterval) {
    clearSessionInterval();
    sendLogToUI('Session saving stopped', 'debug', 'CLEANUP');
  }
  
  // Save the session before closing
  if (browser && page) {
    try {
      // Save the session
      if (session && session.saveSession) {
        await session.saveSession(page);
        sendLogToUI('Final session state saved', 'success', 'CLEANUP');
      }
    } catch (sessionError) {
      sendLogToUI(`Error saving session: ${sessionError.message}`, 'error', 'CLEANUP');
    }
  }
  
  // Close the browser
  if (browserInstance) {
    try {
      await browserInstance.close();
      sendLogToUI('Browser closed', 'success', 'CLEANUP');
    } catch (browserError) {
      sendLogToUI(`Error closing browser: ${browserError.message}`, 'error', 'CLEANUP');
    }
    browserInstance = null;
    page = null;
  }
  
  // Update status
  if (mainWindow) {
    mainWindow.webContents.send('status-changed', {
      isRunning: false,
      isStopping: false
    });
  }
  
  sendLogToUI('Automation stopped', 'success', 'APP');
}

// Custom log handler to send to UI
function sendLogToUI(message, level, label) {
  if (mainWindow) {
    mainWindow.webContents.send('log', {
      message,
      level: level || 'info',
      label,
      timestamp: new Date()
    });
  }
  
  // Also log to console
  console.log(`[${level.toUpperCase()}] [${label || ''}] ${message}`);
}

// Inject our custom log function into the logger if it exists
if (logger) {
  const originalLog = logger.log;
  logger.log = function(message, level, label) {
    // Call the original logger
    originalLog(message, level, label);
    
    // Send to UI
    sendLogToUI(message, level, label);
  };
}

// Function to send mock profile data (for testing)
function sendMockProfileData() {
  console.log('Sending mock profile data to renderer');
  
  // First send profile without analysis to show loading state
  const mockProfileBasic = {
    name: 'Jane',
    age: 28,
    hasBio: true,
    bio: 'Software engineer by day, rock climber by night. Coffee enthusiast and anime lover. ENTP personality type. Love to travel and explore new places on weekends.',
    attributes: ['Coffee', 'Rock Climbing', 'Anime', 'ENTP', 'Software Engineering', 'Travel'],
    isVerified: true
  };
  
  // Send to renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('profile-analyzed', mockProfileBasic);
    mainWindow.webContents.send('analysis-status', { 
      status: 'started',
      profileId: mockProfileBasic.name
    });
    
    // Simulate analysis delay
    setTimeout(() => {
      // Complete mock profile with analysis
      const mockProfileComplete = {
        ...mockProfileBasic,
        analysis: {
          alignmentScore: 0.75,
          keywordMatches: ['Coffee', 'Rock Climbing', 'Anime', 'ENTP'],
          llm: {
            analysis: 'High compatibility based on shared interests in rock climbing, coffee, and anime. Both have technical backgrounds and similar personality types. The travel interest also aligns with your outdoor activities preferences.',
            score: 0.8
          },
          decision: 'like',
          reason: 'Strong alignment on multiple interests, verified profile, and positive LLM analysis.'
        }
      };
      
      // Send completed analysis
      mainWindow.webContents.send('profile-analyzed', mockProfileComplete);
      mainWindow.webContents.send('analysis-status', {
        status: 'completed',
        profileId: mockProfileComplete.name,
        analysis: mockProfileComplete.analysis
      });
      
      sendLogToUI('Mock profile analysis completed', 'success', 'ANALYSIS');
    }, 2500); // 2.5 second delay to show loading state
    
    sendLogToUI('Sent mock profile data to renderer', 'info', 'DEBUG');
  } else {
    console.error('Cannot send mock profile - mainWindow not available');
  }
}

// Add handler for test-profile
ipcMain.handle('test-profile', async () => {
  sendLogToUI('Test profile requested from renderer', 'info', 'DEBUG');
  sendMockProfileData();
  return { success: true };
}); 