/**
 * Application configuration settings
 * All settings, thresholds, and timing parameters are centralized here
 */

const Store = require('electron-store');
const store = new Store();

const config = {
    // Profile analysis settings
    profile: {
        // Alignment score settings
        alignment: {
            // Weights for different types of matching
            weights: {
                keyword: 0.4,
                interest: 0.6
            },
            // Threshold for considering a profile aligned with user preferences
            threshold: 0.3,
            // Minimum keyword length to consider for matching
            minKeywordLength: 3,
            // Classification levels for alignment scores
            levels: {
                low: 0.2,
                medium: 0.5
            }
        }
    },
    
    // Swiping behavior settings
    swiping: {
        // Default swipe right percentage (0-100)
        defaultSwipeRightPercentage: 18,
        
        // Delays between actions (in milliseconds)
        delays: {
            // Base delay after swiping
            afterSwipe: {
                min: 500,
                max: 1500  // Will add random value up to max
            },
            // Delay between profiles
            betweenProfiles: {
                min: 800,
                max: 2000,  // Will add random value up to max
                // Probability of using shorter delay vs longer delay
                shortDelayProbability: 0.8,
                // Ranges for short and long delays
                shortDelay: {
                    min: 800,
                    max: 2000
                },
                longDelay: {
                    min: 2000,
                    max: 4000
                }
            }
        },
        
        // Session behavior settings
        session: {
            // Time range for a session (in minutes)
            duration: {
                min: 45,
                max: 75
            },
            // Number of swipes per session
            maxSwipes: {
                min: 100,
                max: 200
            },
            // Stats display frequency (every X swipes)
            statsDisplayFrequency: 10,
            // Session save frequency (every X swipes, randomized)
            sessionSaveFrequency: {
                min: 8,
                max: 12
            }
        },
        
        // Rest period settings
        restPeriods: {
            // Frequency of rest periods (in minutes)
            frequency: {
                min: 13,
                max: 20
            },
            // Duration of rest periods (in minutes)
            duration: {
                min: 3,
                max: 10
            }
        }
    }
};

/**
 * Get user preferences from the store
 * @returns {Object} User preferences
 */
async function getPreferences() {
    // Default preferences if none are set
    const defaultPreferences = {
        interests: ['travel', 'music', 'art', 'fitness', 'reading'],
        avoidKeywords: ['smoking', 'drugs'],
        llmSettings: {
            endpoint: 'http://127.0.0.1:11434/api/generate'
        }
    };
    
    // Get stored preferences or use defaults
    const storedPreferences = store.get('userPreferences') || {};
    
    // Merge with defaults
    return {
        ...defaultPreferences,
        ...storedPreferences
    };
}

// Expose the getPreferences function
config.getPreferences = getPreferences;

module.exports = config; 