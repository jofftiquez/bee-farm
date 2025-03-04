/**
 * Profile module for the Electron app
 * Handles displaying and managing profile information
 */

// Current profile data
let currentProfile = null;

/**
 * Initialize the profile module
 */
function initializeProfile() {
    // Listen for new profile data
    if (window.api && typeof window.api.onProfileAnalyzed === 'function') {
        window.api.onProfileAnalyzed((profileData) => {
            displayProfile(profileData);
        });
    } else {
        console.warn('Profile API not available, profile updates will not be received');
    }
}

/**
 * Display profile information in the UI
 * @param {Object} profileData - Profile data to display
 */
function displayProfile(profileData) {
    console.log('Received profile data:', JSON.stringify(profileData, null, 2)); // Debug logging
    currentProfile = profileData;
    
    // Hide placeholder and show profile container
    document.querySelector('.profile-placeholder').style.display = 'none';
    document.querySelector('.profile-container').style.display = 'block';
    
    // Update profile details - show name and age properly
    const nameElement = document.getElementById('profileName');
    if (profileData.name) {
        nameElement.textContent = profileData.name;
    } else {
        nameElement.textContent = 'Unknown';
    }
    
    // Handle age separately to fix the formatting
    const ageElement = document.getElementById('profileAge');
    if (profileData.age) {
        ageElement.textContent = profileData.age;
    } else {
        ageElement.textContent = '?';
    }
    
    // Bio
    const bioElement = document.getElementById('profileBio');
    if (profileData.hasBio && profileData.bio) {
        bioElement.textContent = profileData.bio;
    } else if (profileData.fullText) {
        // Fallback to fullText if bio is not available but fullText is
        bioElement.textContent = profileData.fullText;
    } else {
        bioElement.textContent = 'No bio available';
    }
    
    // Attributes/Interests
    const attributesContainer = document.getElementById('profileAttributes');
    attributesContainer.innerHTML = '';
    
    if (profileData.attributes && profileData.attributes.length > 0) {
        profileData.attributes.forEach(attr => {
            const attrElement = document.createElement('div');
            attrElement.className = 'profile-attribute';
            attrElement.textContent = attr;
            attributesContainer.appendChild(attrElement);
        });
    } else {
        const noAttrs = document.createElement('p');
        noAttrs.textContent = 'No interests or attributes found';
        attributesContainer.appendChild(noAttrs);
    }
    
    // Verification
    const verificationElement = document.getElementById('profileVerification');
    if (profileData.isVerified) {
        verificationElement.textContent = 'Verified profile';
        verificationElement.style.color = 'var(--success-color)';
    } else {
        verificationElement.textContent = 'Not verified';
        verificationElement.style.color = 'var(--tertiary-color)';
    }
    
    // If there's no analysis data, create a basic one based on the profileData
    if (profileData.analysis) {
        if (window.analysisModule && typeof window.analysisModule.displayAnalysis === 'function') {
            window.analysisModule.displayAnalysis(profileData.analysis);
        }
    } else if (window.analysisModule && typeof window.analysisModule.displayAnalysis === 'function') {
        // Attempt to create a basic analysis object
        const basicAnalysis = {
            alignmentScore: profileData.alignmentScore || 0,
            keywordMatches: profileData.keywordMatches || [],
            llm: profileData.llmResult || null,
            decision: profileData.decision || 'unknown',
            reason: profileData.reason || 'Waiting for analysis'
        };
        
        window.analysisModule.displayAnalysis(basicAnalysis);
    }
    
    // Log the profile load
    if (window.logsModule) {
        const profileInfo = `${profileData.name || 'Unknown'}${profileData.age ? ', ' + profileData.age : ''}`;
        window.logsModule.log(`Loaded profile: ${profileInfo}`, 'info', 'PROFILE');
    }
}

/**
 * Clear the current profile
 */
function clearProfile() {
    currentProfile = null;
    
    // Show placeholder and hide profile container
    document.querySelector('.profile-placeholder').style.display = 'flex';
    document.querySelector('.profile-container').style.display = 'none';
}

/**
 * Get the current profile data
 * @returns {Object|null} The current profile data or null if none loaded
 */
function getCurrentProfile() {
    return currentProfile;
}

// Export functions
window.profileModule = {
    initializeProfile,
    displayProfile,
    clearProfile,
    getCurrentProfile
}; 