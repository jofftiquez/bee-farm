/**
 * Analysis module for the Electron app
 * Handles displaying analysis results for profiles
 */

// Current and previous analysis data
let currentAnalysis = null;
let previousAnalysis = null;
let isAnalyzing = false;

/**
 * Initialize the analysis module
 */
function initializeAnalysis() {
    // Listen for profile analyzed events
    if (window.api && typeof window.api.onProfileAnalyzed === 'function') {
        window.api.onProfileAnalyzed((profileData) => {
            // Store the current analysis as previous before updating
            if (currentAnalysis) {
                previousAnalysis = {...currentAnalysis};
            }
            
            // If profile data has the analysis property, display it
            if (profileData.analysis) {
                displayAnalysis(profileData.analysis);
            } else {
                // If there's no analysis yet, show loading state
                showAnalysisLoading();
            }
        });
    } else {
        console.warn('Analysis API not available, analysis updates will not be received');
    }
    
    // Listen for analysis status updates
    if (window.api && typeof window.api.onAnalysisStatus === 'function') {
        window.api.onAnalysisStatus((statusData) => {
            if (statusData.status === 'started') {
                showAnalysisLoading();
            } else if (statusData.status === 'completed' && statusData.analysis) {
                // Store current as previous before updating to new
                if (currentAnalysis) {
                    previousAnalysis = {...currentAnalysis};
                }
                displayAnalysis(statusData.analysis);
            } else if (statusData.status === 'error') {
                showAnalysisError(statusData.error);
            }
        });
    }
    
    // Add UI elements for previous profile toggle
    addPreviousProfileToggle();
}

/**
 * Add UI elements for toggling between current and previous profiles
 */
function addPreviousProfileToggle() {
    // Create toggle container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'profile-toggle-container';
    toggleContainer.innerHTML = `
        <button id="currentProfileBtn" class="profile-toggle-btn active">Current Profile</button>
        <button id="previousProfileBtn" class="profile-toggle-btn">Previous Profile</button>
    `;
    
    // Find analysis section to insert toggle before it
    const analysisSection = document.querySelector('.analysis-section') || 
                           document.querySelector('.profile-analysis') ||
                           document.getElementById('analysisPanel');
    
    if (analysisSection && analysisSection.parentNode) {
        analysisSection.parentNode.insertBefore(toggleContainer, analysisSection);
        
        // Add event listeners
        document.getElementById('currentProfileBtn').addEventListener('click', () => {
            document.getElementById('currentProfileBtn').classList.add('active');
            document.getElementById('previousProfileBtn').classList.remove('active');
            if (currentAnalysis) {
                displayAnalysis(currentAnalysis);
            } else {
                showPlaceholder();
            }
        });
        
        document.getElementById('previousProfileBtn').addEventListener('click', () => {
            document.getElementById('previousProfileBtn').classList.add('active');
            document.getElementById('currentProfileBtn').classList.remove('active');
            if (previousAnalysis) {
                displayAnalysis(previousAnalysis, true);
            } else {
                showNoPreviousProfileMessage();
            }
        });
    } else {
        console.error('Could not find analysis section to add toggle');
    }
    
    // Add styles for toggle buttons
    const style = document.createElement('style');
    style.textContent = `
        .profile-toggle-container {
            display: flex;
            margin-bottom: 15px;
            border-bottom: 1px solid var(--border-color);
        }
        .profile-toggle-btn {
            background: none;
            border: none;
            padding: 10px 15px;
            cursor: pointer;
            font-size: 14px;
            color: var(--text-color);
            position: relative;
        }
        .profile-toggle-btn.active {
            font-weight: bold;
            color: var(--primary-color);
        }
        .profile-toggle-btn.active:after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            width: 100%;
            height: 2px;
            background: var(--primary-color);
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

/**
 * Show a message when no previous profile is available
 */
function showNoPreviousProfileMessage() {
    try {
        // Hide loading, show container with message
        const loading = document.querySelector('.analysis-loading');
        const container = document.querySelector('.analysis-container');
        const placeholder = document.querySelector('.analysis-placeholder');
        
        if (loading && container && placeholder) {
            loading.style.display = 'none';
            container.style.display = 'block';
            placeholder.style.display = 'none';
            
            // Show message in LLM analysis section
            const llmAnalysisElement = document.getElementById('llmAnalysis');
            if (llmAnalysisElement) {
                llmAnalysisElement.textContent = 'No previous profile analysis available';
                llmAnalysisElement.style.color = 'var(--text-secondary-color)';
            }
            
            // Clear other sections
            const keywordsContainer = document.getElementById('keywordMatches');
            if (keywordsContainer) {
                keywordsContainer.innerHTML = '';
            }
            
            const scoreValueElement = document.getElementById('alignmentScoreValue');
            if (scoreValueElement) {
                scoreValueElement.textContent = 'N/A';
            }
            
            const scoreFill = document.getElementById('alignmentScoreFill');
            if (scoreFill) {
                scoreFill.style.width = '0%';
            }
            
            const llmScoreElement = document.getElementById('llmScoreValue');
            if (llmScoreElement) {
                llmScoreElement.textContent = 'N/A';
            }
            
            const decisionContainer = document.getElementById('decisionContainer');
            if (decisionContainer) {
                decisionContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error showing no previous profile message:', error);
    }
}

/**
 * Show placeholder when no analysis is available
 */
function showPlaceholder() {
    try {
        const placeholder = document.querySelector('.analysis-placeholder');
        const container = document.querySelector('.analysis-container');
        const loading = document.querySelector('.analysis-loading');
        
        if (placeholder && container && loading) {
            placeholder.style.display = 'flex';
            container.style.display = 'none';
            loading.style.display = 'none';
        }
    } catch (error) {
        console.error('Error showing placeholder:', error);
    }
}

/**
 * Show loading state while analysis is in progress
 */
function showAnalysisLoading() {
    isAnalyzing = true;
    
    try {
        // Hide placeholder and analysis container, show loading
        const placeholder = document.querySelector('.analysis-placeholder');
        const container = document.querySelector('.analysis-container');
        const loading = document.querySelector('.analysis-loading');
        
        if (placeholder && container && loading) {
            placeholder.style.display = 'none';
            container.style.display = 'none';
            loading.style.display = 'flex';
        } else {
            console.error('Missing analysis container elements for loading state');
        }
        
        // Log the loading state
        if (window.logsModule) {
            window.logsModule.log('Analyzing profile...', 'info', 'ANALYSIS');
        }
    } catch (error) {
        console.error('Error showing analysis loading state:', error);
    }
}

/**
 * Show error state when analysis fails
 * @param {string} errorMessage - Error message to display
 */
function showAnalysisError(errorMessage) {
    isAnalyzing = false;
    
    try {
        // Hide loading, show container with error
        const loading = document.querySelector('.analysis-loading');
        const container = document.querySelector('.analysis-container');
        
        if (loading && container) {
            loading.style.display = 'none';
            container.style.display = 'block';
            
            // Show error in LLM analysis section
            const llmAnalysisElement = document.getElementById('llmAnalysis');
            if (llmAnalysisElement) {
                llmAnalysisElement.textContent = `Analysis error: ${errorMessage || 'Unknown error'}`;
                llmAnalysisElement.style.color = 'var(--error-color)';
            }
        }
        
        // Log the error
        if (window.logsModule) {
            window.logsModule.log(`Analysis error: ${errorMessage}`, 'error', 'ANALYSIS');
        }
    } catch (error) {
        console.error('Error showing analysis error state:', error);
    }
}

/**
 * Display analysis in the UI
 * @param {Object} analysisData - Analysis data to display
 * @param {boolean} isPrevious - Whether this is displaying previous profile data
 */
function displayAnalysis(analysisData, isPrevious = false) {
    console.log(`Displaying ${isPrevious ? 'previous' : 'current'} analysis data:`, JSON.stringify(analysisData, null, 2));
    
    if (!isPrevious) {
        currentAnalysis = analysisData;
    }
    
    isAnalyzing = false;
    
    try {
        // Hide placeholder and loading, show analysis container
        const placeholder = document.querySelector('.analysis-placeholder');
        const container = document.querySelector('.analysis-container');
        const loading = document.querySelector('.analysis-loading');
        
        if (placeholder && container && loading) {
            placeholder.style.display = 'none';
            loading.style.display = 'none';
            container.style.display = 'block';
        } else {
            console.error('Missing analysis container elements');
        }
        
        // Add previous profile indicator if showing previous
        const previousBadge = document.querySelector('.previous-profile-badge');
        if (isPrevious) {
            if (!previousBadge) {
                const badge = document.createElement('div');
                badge.className = 'previous-profile-badge';
                badge.textContent = 'Previous Profile Analysis';
                container.insertBefore(badge, container.firstChild);
            }
        } else {
            if (previousBadge) {
                previousBadge.remove();
            }
        }
        
        // Update alignment score
        const alignmentScore = analysisData.alignmentScore || 0;
        const scoreValueElement = document.getElementById('alignmentScoreValue');
        if (scoreValueElement) {
            scoreValueElement.textContent = alignmentScore.toFixed(2);
        }
        
        // Update score fill (percentage based)
        const scorePercentage = alignmentScore * 100;
        const scoreFill = document.getElementById('alignmentScoreFill');
        if (scoreFill) {
            scoreFill.style.width = `${scorePercentage}%`;
            
            // Set color based on score
            if (alignmentScore < 0.3) {
                scoreFill.style.backgroundColor = 'var(--error-color)';
            } else if (alignmentScore < 0.6) {
                scoreFill.style.backgroundColor = 'var(--warning-color)';
            } else {
                scoreFill.style.backgroundColor = 'var(--success-color)';
            }
        }
        
        // Keyword matches
        const keywordsContainer = document.getElementById('keywordMatches');
        if (keywordsContainer) {
            keywordsContainer.innerHTML = '';
            
            if (analysisData.keywordMatches && analysisData.keywordMatches.length > 0) {
                analysisData.keywordMatches.forEach(keyword => {
                    // Sanitize each keyword
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = keyword;
                    const sanitizedKeyword = tempDiv.textContent || tempDiv.innerText || '';
                    
                    const keywordElement = document.createElement('div');
                    keywordElement.className = 'keyword-match';
                    keywordElement.innerHTML = `<i class="fas fa-check"></i> ${sanitizedKeyword}`;
                    keywordsContainer.appendChild(keywordElement);
                });
            } else {
                const noMatches = document.createElement('p');
                noMatches.textContent = 'No keyword matches found';
                keywordsContainer.appendChild(noMatches);
            }
        }
        
        // LLM Analysis - emphasize this section as per user request
        const llmAnalysisElement = document.getElementById('llmAnalysis');
        const llmScoreElement = document.getElementById('llmScoreValue');
        const llmContainer = document.getElementById('llmAnalysisContainer');
        
        // Make sure we have all the elements before updating
        if (llmAnalysisElement && llmScoreElement && llmContainer) {
            console.log('LLM analysis data:', analysisData.llm);
            
            // Highlight the LLM section to make it more noticeable
            if (!isPrevious) {
                llmContainer.style.boxShadow = '0 0 5px var(--primary-color)';
                setTimeout(() => {
                    llmContainer.style.boxShadow = '';
                }, 2000);
            }
            
            if (analysisData.llm && analysisData.llm.analysis) {
                // Sanitize the LLM analysis text
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = analysisData.llm.analysis;
                const sanitizedAnalysis = tempDiv.textContent || tempDiv.innerText || '';
                
                // Reset any error styling
                llmAnalysisElement.style.color = '';
                
                // Show LLM analysis
                llmAnalysisElement.textContent = sanitizedAnalysis;
                
                if (analysisData.llm.score !== undefined) {
                    llmScoreElement.textContent = analysisData.llm.score.toFixed(2);
                } else {
                    llmScoreElement.textContent = 'N/A';
                }
                
                // Make LLM section stand out more as user requested
                llmAnalysisElement.style.fontSize = '1.05em';
                llmAnalysisElement.style.lineHeight = '1.5';
            } else {
                // No LLM analysis available
                llmAnalysisElement.style.color = '';
                llmAnalysisElement.textContent = 'No LLM analysis available';
                llmScoreElement.textContent = 'N/A';
            }
        } else {
            console.error('Missing LLM analysis elements');
        }
        
        // Decision
        const decisionContainer = document.getElementById('decisionContainer');
        const decisionElement = document.getElementById('decision');
        const reasonElement = document.getElementById('decisionReason');
        
        if (decisionContainer && decisionElement && reasonElement) {
            if (analysisData.decision) {
                // Show decision container
                decisionContainer.style.display = 'block';
                
                // Sanitize reason text
                let sanitizedReason = '';
                if (analysisData.reason) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = analysisData.reason;
                    sanitizedReason = tempDiv.textContent || tempDiv.innerText || '';
                } else {
                    sanitizedReason = 'No reason provided';
                }
                
                // Update decision text and styling
                if (analysisData.decision === 'like') {
                    decisionContainer.className = 'decision-container decision-like';
                    decisionElement.textContent = '👍 Like';
                } else {
                    decisionContainer.className = 'decision-container decision-dislike';
                    decisionElement.textContent = '👎 Dislike';
                }
                
                reasonElement.textContent = sanitizedReason;
            } else {
                // Hide decision container if no decision
                decisionContainer.style.display = 'none';
            }
        }
        
        // Log that we displayed the analysis
        if (window.logsModule) {
            window.logsModule.log(`Displayed ${isPrevious ? 'previous' : 'current'} profile analysis`, 'info', 'ANALYSIS');
        }
    } catch (error) {
        console.error('Error displaying analysis:', error);
    }
}

/**
 * Clear the current analysis
 */
function clearAnalysis() {
    currentAnalysis = null;
    isAnalyzing = false;
    
    // Show placeholder and hide loading and analysis container
    const placeholder = document.querySelector('.analysis-placeholder');
    const container = document.querySelector('.analysis-container');
    const loading = document.querySelector('.analysis-loading');
    
    if (placeholder && container && loading) {
        placeholder.style.display = 'flex';
        container.style.display = 'none';
        loading.style.display = 'none';
    }
}

/**
 * Get the current analysis data
 * @returns {Object|null} The current analysis data or null if none available
 */
function getCurrentAnalysis() {
    return currentAnalysis;
}

/**
 * Check if analysis is currently in progress
 * @returns {boolean} True if analysis is in progress
 */
function isAnalysisInProgress() {
    return isAnalyzing;
}

/**
 * Display the current analysis
 * @returns {boolean} True if current analysis was shown, false otherwise
 */
function displayCurrentAnalysis() {
    if (currentAnalysis) {
        displayAnalysis(currentAnalysis, false);
        return true;
    } else {
        showPlaceholder();
        return false;
    }
}

/**
 * Display the previous analysis
 * @returns {boolean} True if previous analysis was shown, false otherwise
 */
function displayPreviousAnalysis() {
    if (previousAnalysis) {
        displayAnalysis(previousAnalysis, true);
        return true;
    } else {
        showNoPreviousProfileMessage();
        return false;
    }
}

// Make functions available to other modules
if (typeof window !== 'undefined') {
    // Create global analysis module if it doesn't exist
    if (!window.analysisModule) {
        window.analysisModule = {};
    }
    
    // Expose public functions
    window.analysisModule.initializeAnalysis = initializeAnalysis;
    window.analysisModule.displayAnalysis = displayAnalysis;
    window.analysisModule.showAnalysisLoading = showAnalysisLoading;
    window.analysisModule.showAnalysisError = showAnalysisError;
    window.analysisModule.displayCurrentAnalysis = displayCurrentAnalysis;
    window.analysisModule.displayPreviousAnalysis = displayPreviousAnalysis;
    
    // Also expose current and previous analysis objects
    window.currentAnalysis = currentAnalysis;
    window.previousAnalysis = previousAnalysis;
    
    // Initialize the module
    initializeAnalysis();
} 