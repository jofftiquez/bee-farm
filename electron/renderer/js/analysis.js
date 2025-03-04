/**
 * Analysis module for the Electron app
 * Handles displaying analysis results for profiles
 */

// Current analysis data
let currentAnalysis = null;

/**
 * Initialize the analysis module
 */
function initializeAnalysis() {
    // Listen for profile analyzed events
    if (window.api && typeof window.api.onProfileAnalyzed === 'function') {
        window.api.onProfileAnalyzed((profileData) => {
            if (profileData.analysis) {
                displayAnalysis(profileData.analysis);
            }
        });
    } else {
        console.warn('Analysis API not available, analysis updates will not be received');
    }
}

/**
 * Display analysis in the UI
 * @param {Object} analysisData - Analysis data to display
 */
function displayAnalysis(analysisData) {
    currentAnalysis = analysisData;
    
    // Hide placeholder and show analysis container
    document.querySelector('.analysis-placeholder').style.display = 'none';
    document.querySelector('.analysis-container').style.display = 'block';
    
    // Update alignment score
    const alignmentScore = analysisData.alignmentScore || 0;
    document.getElementById('alignmentScoreValue').textContent = alignmentScore.toFixed(2);
    
    // Update score fill (percentage based)
    const scorePercentage = alignmentScore * 100;
    const scoreFill = document.getElementById('alignmentScoreFill');
    scoreFill.style.width = `${scorePercentage}%`;
    
    // Set color based on score
    if (alignmentScore < 0.3) {
        scoreFill.style.backgroundColor = 'var(--error-color)';
    } else if (alignmentScore < 0.6) {
        scoreFill.style.backgroundColor = 'var(--warning-color)';
    } else {
        scoreFill.style.backgroundColor = 'var(--success-color)';
    }
    
    // Keyword matches
    const keywordsContainer = document.getElementById('keywordMatches');
    keywordsContainer.innerHTML = '';
    
    if (analysisData.keywordMatches && analysisData.keywordMatches.length > 0) {
        analysisData.keywordMatches.forEach(keyword => {
            const keywordElement = document.createElement('div');
            keywordElement.className = 'keyword-match';
            keywordElement.innerHTML = `<i class="fas fa-check"></i> ${keyword}`;
            keywordsContainer.appendChild(keywordElement);
        });
    } else {
        const noMatches = document.createElement('p');
        noMatches.textContent = 'No keyword matches found';
        keywordsContainer.appendChild(noMatches);
    }
    
    // LLM Analysis
    const llmAnalysisElement = document.getElementById('llmAnalysis');
    const llmScoreElement = document.getElementById('llmScoreValue');
    
    if (analysisData.llm && analysisData.llm.analysis) {
        llmAnalysisElement.textContent = analysisData.llm.analysis;
        
        if (analysisData.llm.score !== undefined) {
            llmScoreElement.textContent = analysisData.llm.score.toFixed(2);
        } else {
            llmScoreElement.textContent = 'N/A';
        }
    } else {
        llmAnalysisElement.textContent = 'No LLM analysis available';
        llmScoreElement.textContent = 'N/A';
    }
    
    // Decision
    const decisionContainer = document.getElementById('decisionContainer');
    const decisionElement = document.getElementById('decision');
    const reasonElement = document.getElementById('decisionReason');
    
    if (analysisData.decision) {
        // Update decision text and styling
        if (analysisData.decision === 'like') {
            decisionContainer.className = 'decision-container decision-like';
            decisionElement.textContent = '👍 Like';
        } else {
            decisionContainer.className = 'decision-container decision-dislike';
            decisionElement.textContent = '👎 Dislike';
        }
        
        // Update reason
        reasonElement.textContent = analysisData.reason || 'No reason provided';
    } else {
        decisionContainer.className = 'decision-container';
        decisionElement.textContent = 'No decision yet';
        reasonElement.textContent = 'Waiting for analysis';
    }
    
    // Log the analysis
    if (window.logsModule) {
        const logLevel = analysisData.decision === 'like' ? 'success' : 'info';
        window.logsModule.log(`Analysis complete - Score: ${alignmentScore.toFixed(2)}`, logLevel, 'ANALYSIS');
    }
}

/**
 * Clear the current analysis
 */
function clearAnalysis() {
    currentAnalysis = null;
    
    // Show placeholder and hide analysis container
    document.querySelector('.analysis-placeholder').style.display = 'flex';
    document.querySelector('.analysis-container').style.display = 'none';
}

/**
 * Get the current analysis data
 * @returns {Object|null} The current analysis data or null if none available
 */
function getCurrentAnalysis() {
    return currentAnalysis;
}

// Export functions
window.analysisModule = {
    initializeAnalysis,
    displayAnalysis,
    clearAnalysis,
    getCurrentAnalysis
}; 