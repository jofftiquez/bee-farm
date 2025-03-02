/**
 * Application configuration settings
 * All settings, thresholds, and timing parameters are centralized here
 */

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
        // Delays between actions (in milliseconds)
        delays: {
            // Base delay after swiping
            afterSwipe: {
                min: 1000,
                max: 2000  // Will add random value up to max
            },
            // Delay between profiles
            betweenProfiles: {
                min: 800,
                max: 5000,  // Will add random value up to max
                // Probability of using shorter delay vs longer delay
                shortDelayProbability: 0.8,
                // Ranges for short and long delays
                shortDelay: {
                    min: 800,
                    max: 3000
                },
                longDelay: {
                    min: 3000,
                    max: 6000
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
                min: 50,
                max: 100
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

module.exports = config; 