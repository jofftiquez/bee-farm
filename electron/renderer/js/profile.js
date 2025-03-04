/**
 * Profile module for the Electron app
 * Handles displaying and managing profile information
 */

// Current profile data
let currentProfile = null;

// Add previous profile storage
let previousProfileInfo = null;
let currentProfileInfo = null;

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
    
    try {
        // Debug element existence
        console.log('Element check:', {
            placeholder: Boolean(document.querySelector('.profile-placeholder')),
            container: Boolean(document.querySelector('.profile-container')),
            profileName: Boolean(document.getElementById('profileName')),
            profileAge: Boolean(document.getElementById('profileAge')),
            profileBio: Boolean(document.getElementById('profileBio')),
            profileAttributes: Boolean(document.getElementById('profileAttributes')),
            profileVerification: Boolean(document.getElementById('profileVerification'))
        });
        
        // Hide placeholder and show profile container
        const placeholder = document.querySelector('.profile-placeholder');
        const container = document.querySelector('.profile-container');
        
        if (placeholder && container) {
            placeholder.style.display = 'none';
            container.style.display = 'block';
        } else {
            console.error('Missing profile container elements');
        }
        
        // Update profile name
        const nameElement = document.getElementById('profileName');
        if (nameElement) {
            nameElement.textContent = profileData.name || 'Unknown';
        } else {
            console.error('Missing profile name element');
        }
        
        // Update age
        const ageElement = document.getElementById('profileAge');
        if (ageElement) {
            ageElement.textContent = profileData.age || '?';
        } else {
            console.error('Missing profile age element');
        }
        
        // Bio - with sanitization
        const bioElement = document.getElementById('profileBio');
        if (bioElement) {
            let bioText = '';
            
            if (profileData.hasBio && profileData.bio) {
                bioText = profileData.bio;
            } else if (profileData.fullText) {
                // Fallback to fullText if bio is not available but fullText is
                bioText = profileData.fullText;
            } else {
                bioText = 'No bio available';
            }
            
            // Sanitize the bio text - remove any HTML/script content
            // Convert to plain text by creating a temporary div and using textContent
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = bioText;
            const sanitizedBio = tempDiv.textContent || tempDiv.innerText || '';
            
            // Trim the bio if it's too long
            const maxBioLength = 1000;
            const trimmedBio = sanitizedBio.length > maxBioLength 
                ? sanitizedBio.substring(0, maxBioLength) + '...' 
                : sanitizedBio;
                
            bioElement.textContent = trimmedBio;
            
            console.log('Bio text processed:', {
                original: bioText.substring(0, 100) + '...',
                sanitized: sanitizedBio.substring(0, 100) + '...',
                displayed: trimmedBio.substring(0, 100) + '...'
            });
        } else {
            console.error('Missing profile bio element');
        }
        
        // Attributes/Interests
        const attributesContainer = document.getElementById('profileAttributes');
        if (attributesContainer) {
            attributesContainer.innerHTML = '';
            
            if (profileData.attributes && profileData.attributes.length > 0) {
                profileData.attributes.forEach(attr => {
                    // Sanitize each attribute
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = attr;
                    const sanitizedAttr = tempDiv.textContent || tempDiv.innerText || '';
                    
                    const attrElement = document.createElement('div');
                    attrElement.className = 'profile-attribute';
                    attrElement.textContent = sanitizedAttr;
                    attributesContainer.appendChild(attrElement);
                });
            } else {
                const noAttrs = document.createElement('p');
                noAttrs.textContent = 'No interests or attributes found';
                attributesContainer.appendChild(noAttrs);
            }
        } else {
            console.error('Missing profile attributes container');
        }
        
        // Verification
        const verificationElement = document.getElementById('profileVerification');
        if (verificationElement) {
            if (profileData.isVerified) {
                verificationElement.textContent = 'Verified profile';
                verificationElement.style.color = 'var(--success-color)';
            } else {
                verificationElement.textContent = 'Not verified';
                verificationElement.style.color = 'var(--tertiary-color)';
            }
        } else {
            console.error('Missing profile verification element');
        }
        
        // If there's analysis data, pass it to the analysis module
        if (window.analysisModule) {
            if (profileData.analysis) {
                console.log('Sending analysis data to analysis module:', profileData.analysis);
                window.analysisModule.displayAnalysis(profileData.analysis);
            } else {
                console.log('No analysis data in profile, showing loading state');
                // Show loading state while waiting for analysis
                window.analysisModule.showAnalysisLoading();
                
                // For testing - create a basic analysis after 2 seconds
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    setTimeout(() => {
                        // Only do this if we're still waiting on analysis for this profile
                        if (currentProfile === profileData && window.analysisModule.isAnalysisInProgress()) {
                            console.log('Creating mock analysis data for testing');
                            const mockAnalysis = {
                                alignmentScore: 0.68,
                                keywordMatches: profileData.attributes ? profileData.attributes.slice(0, 3) : ['Test Match'],
                                llm: {
                                    analysis: 'This is a mock LLM analysis for testing the UI display. The profile appears to be compatible based on shared interests.',
                                    score: 0.72
                                },
                                decision: 'like',
                                reason: 'Generated mock analysis for testing purposes.'
                            };
                            window.analysisModule.displayAnalysis(mockAnalysis);
                        }
                    }, 2000);
                }
            }
        } else {
            console.error('Analysis module not available or missing displayAnalysis function');
        }
        
        // Log the profile load
        if (window.logsModule) {
            const profileInfo = `${profileData.name || 'Unknown'}${profileData.age ? ', ' + profileData.age : ''}`;
            window.logsModule.log(`Loaded profile: ${profileInfo}`, 'info', 'PROFILE');
        }
    } catch (error) {
        console.error('Error displaying profile:', error);
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

// Update profile info when received and save previous profile
function updateProfileInfo(profileInfo) {
    // Save current as previous before updating
    if (currentProfileInfo) {
        previousProfileInfo = {...currentProfileInfo};
    }
    
    // Update current profile
    currentProfileInfo = profileInfo;
    
    // Update UI
    displayProfileInfo(profileInfo);
    
    // Trigger analysis loading
    if (window.analysisModule && window.analysisModule.showAnalysisLoading) {
        window.analysisModule.showAnalysisLoading();
    }
}

// Function to display previous profile
function displayPreviousProfile() {
    if (previousProfileInfo) {
        displayProfileInfo(previousProfileInfo, true);
        return true;
    }
    return false;
}

// Update displayProfileInfo to handle previous profiles
function displayProfileInfo(profileInfo, isPrevious = false) {
    // Display badge if showing previous profile
    const previousBadge = document.querySelector('.previous-profile-badge');
    const profileContainer = document.querySelector('.profile-container');
    
    if (isPrevious) {
        if (!previousBadge && profileContainer) {
            const badge = document.createElement('div');
            badge.className = 'previous-profile-badge';
            badge.textContent = 'Previous Profile';
            badge.style.position = 'absolute';
            badge.style.top = '10px';
            badge.style.right = '10px';
            badge.style.zIndex = '100';
            profileContainer.style.position = 'relative';
            profileContainer.appendChild(badge);
        }
    } else {
        if (previousBadge) {
            previousBadge.remove();
        }
    }
    
    // Continue with normal profile display
    // ... existing display logic ...
}

/**
 * Display current profile
 * @returns {boolean} True if profile displayed, false otherwise
 */
function displayCurrentProfile() {
    if (currentProfileInfo) {
        displayProfileInfo(currentProfileInfo, false);
        return true;
    }
    return false;
}

// Expose functions to window object
if (typeof window !== 'undefined') {
    // Create the profileModule object if it doesn't exist
    if (!window.profileModule) {
        window.profileModule = {};
    }
    
    // Add public functions
    window.profileModule.initializeProfile = initializeProfile;
    window.profileModule.updateProfileInfo = updateProfileInfo;
    window.profileModule.displayProfileInfo = displayProfileInfo;
    window.profileModule.displayCurrentProfile = displayCurrentProfile;
    window.profileModule.displayPreviousProfile = displayPreviousProfile;
    window.profileModule.getCurrentProfile = getCurrentProfile;
    
    // Initialize on load
    initializeProfile();
} 