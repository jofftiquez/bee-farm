const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');
const config = require('./config');
const llmIntegration = require('./llm-integration');

/**
 * Extract profile bio and relevant information from the DOM
 * @param {Object} page Puppeteer page object
 * @returns {Object} Profile information including bio text
 */
async function extractProfileInfo(page) {
    logger.log('Extracting profile information...', logger.LOG_LEVELS.INFO, 'PROFILE');
    
    try {
        // No longer taking screenshots for privacy reasons
        
        // Extract profile information from the DOM
        const profileInfo = await page.evaluate(() => {
            // Define the helper function locally within page.evaluate context
            function getPageTextExcludingSidebar() {
                // Get page text but exclude sidebar chat content which might contain sensitive information
                const sidebar = document.querySelector('.page__sidebar');
                let pageText = '';
                
                // Clone the body to avoid modifying the actual DOM
                const bodyClone = document.body.cloneNode(true);
                if (sidebar) {
                    // Find sidebar in the clone and remove it
                    const sidebarInClone = bodyClone.querySelector('.page__sidebar');
                    if (sidebarInClone) {
                        sidebarInClone.remove();
                    }
                }
                // Get text from the modified clone
                return bodyClone.innerText;
            }
            
            // Primary bio selector (from user's shared DOM structure)
            const bioElement = document.querySelector('.encounters-story-about__text');
            const bioText = bioElement ? bioElement.textContent.trim() : '';
            
            // Extract tags/attributes from pills (from user's shared DOM structure)
            const pillElements = document.querySelectorAll('.encounters-story-about__badge .pill');
            const attributes = Array.from(pillElements).map(pill => {
                const titleElement = pill.querySelector('.pill__title');
                return titleElement ? titleElement.textContent.trim() : '';
            }).filter(text => text.length > 0);
            
            // Extract additional information from the DOM as requested
            const location = document.querySelector('.location-widget__town');
            const locationText = location ? location.textContent.trim() : '';
            
            const distance = document.querySelector('.location-widget__distance');
            const distanceText = distance ? distance.textContent.trim() : '';
            
            // Get all section headings and their associated text
            const sectionHeadings = document.querySelectorAll('.encounters-story-section__heading-title');
            const sections = Array.from(sectionHeadings).map(heading => {
                return {
                    heading: heading.textContent.trim(),
                    // Try to find the associated text (sibling or parent's next child)
                    content: (() => {
                        // Look for the nearest text content associated with this heading
                        let parentSection = heading.closest('.encounters-story-section');
                        if (parentSection) {
                            let contentElement = parentSection.querySelector('.encounters-story-about__text');
                            return contentElement ? contentElement.textContent.trim() : '';
                        }
                        return '';
                    })()
                };
            }).filter(section => section.heading && section.content);
            
            // Get all additional bio text elements
            const additionalBioElements = document.querySelectorAll('.encounters-story-about__text');
            const additionalBioTexts = Array.from(additionalBioElements)
                .map(element => element.textContent.trim())
                .filter(text => text && text !== bioText); // Exclude the primary bio text
            
            // Track how we found the information for debugging
            const extractionMethod = {
                name: 'unknown',
                age: 'unknown',
                bio: bioText ? 'primary' : 'not found',
                location: locationText ? 'primary' : 'not found',
                distance: distanceText ? 'primary' : 'not found'
            };
            
            // Fallback bio selectors if primary one isn't found
            if (!bioText) {
                const fallbackBioSelectors = [
                    '[data-qa-role="profile-bio"]',
                    '.profile-content .profile-section-bio',
                    '.profile__bio',
                    '[data-qa-role="profile-about"]',
                    '.encounters-story-experience__content'
                ];
                
                for (const selector of fallbackBioSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        // Use helper function to get page text excluding sidebar
                        const pageText = getPageTextExcludingSidebar();
                        
                        return {
                            bio: element.textContent.trim(),
                            hasBio: true,
                            attributes: attributes,
                            hasAttributes: attributes.length > 0,
                            location: locationText,
                            distance: distanceText,
                            sections: sections,
                            additionalBioTexts: additionalBioTexts,
                            fullText: pageText,
                            extractionMethod: {
                                ...extractionMethod,
                                bio: 'fallback'
                            }
                        };
                    }
                }
            }
            
            // Try to find name and age using the specific CSS selectors
            let name = 'Unknown';
            let age = 'Unknown';
            
            // Check for the specific elements provided in the sample
            const nameElement = document.querySelector('.encounters-story-profile__name');
            if (nameElement) {
                name = nameElement.textContent.trim();
                extractionMethod.name = 'specific_selector';
            }
            
            const ageElement = document.querySelector('.encounters-story-profile__age');
            if (ageElement) {
                // Extract just the number from the age element (removing comma and spaces)
                const ageText = ageElement.textContent.trim();
                const ageMatch = ageText.match(/\d+/);
                if (ageMatch) {
                    age = ageMatch[0];
                    extractionMethod.age = 'specific_selector';
                }
            }
            
            // Extract occupation and education if available
            let occupation = '';
            let education = '';
            
            const occupationElement = document.querySelector('.encounters-story-profile__occupation');
            if (occupationElement) {
                occupation = occupationElement.textContent.trim();
            }
            
            const educationElement = document.querySelector('.encounters-story-profile__education');
            if (educationElement) {
                education = educationElement.textContent.trim();
            }
            
            // Fallback to regex match if specific elements not found
            if (name === 'Unknown' || age === 'Unknown') {
                // Use helper function to get page text excluding sidebar
                const pageText = getPageTextExcludingSidebar();
                
                // Use filtered page text for regex matching
                const nameAgeMatch = pageText.match(/([A-Za-z]+),?\s*(\d{1,2})/);
                if (nameAgeMatch) {
                    if (name === 'Unknown') {
                        name = nameAgeMatch[1];
                        extractionMethod.name = 'regex_fallback';
                    }
                    if (age === 'Unknown') {
                        age = nameAgeMatch[2];
                        extractionMethod.age = 'regex_fallback';
                    }
                }
            }
            
            // Combine all available profile text for enhanced analysis
            // Even if no bio is present, we'll create a "combined profile text" from attributes and other elements
            const combinedText = [
                bioText,
                ...attributes,
                locationText,
                occupation ? `Occupation: ${occupation}` : '',
                education ? `Education: ${education}` : '',
                ...sections.map(s => `${s.heading}: ${s.content}`),
                ...additionalBioTexts
            ].filter(text => text && text.length > 0).join('\n');
            
            // Get the full page text but exclude the sidebar chat which might contain sensitive information
            const fullPageText = getPageTextExcludingSidebar();
            
            return {
                name,
                age,
                occupation,
                education,
                bio: bioText || (attributes.length > 0 ? `Profile has attributes: ${attributes.join(', ')}` : 'No bio found'),
                hasBio: bioText.length > 0,
                attributes: attributes,
                hasAttributes: attributes.length > 0,
                interests: attributes, // For compatibility with existing code
                location: locationText,
                distance: distanceText,
                sections: sections,
                additionalBioTexts: additionalBioTexts,
                combinedProfileText: combinedText,
                fullText: fullPageText,
                extractionMethod // Add extraction method for debugging
            };
        });
        
        // Start a new profile section with the extracted name and age
        logger.startProfile(profileInfo.name, profileInfo.age);
        
        // Display bio information
        if (profileInfo.hasBio) {
            logger.log(`Bio: ${profileInfo.bio.substring(0, 100)}${profileInfo.bio.length > 100 ? '...' : ''}`, 
                logger.LOG_LEVELS.SUCCESS, 'PROFILE');
        } else if (profileInfo.hasAttributes) {
            // If no bio but attributes exist, show that instead
            logger.log(`No bio but has attributes: ${profileInfo.attributes.join(', ')}`, 
                logger.LOG_LEVELS.INFO, 'PROFILE');
        } else {
            logger.log('No bio or attributes found', logger.LOG_LEVELS.WARNING, 'PROFILE');
        }
        
        // Display attributes if available
        if (profileInfo.hasAttributes) {
            logger.log(`Attributes: ${profileInfo.attributes.join(', ')}`, logger.LOG_LEVELS.INFO, 'PROFILE');
        }
        
        // Display location information if available
        if (profileInfo.location) {
            logger.log(`Location: ${profileInfo.location}${profileInfo.distance ? ' (' + profileInfo.distance + ')' : ''}`, 
                logger.LOG_LEVELS.INFO, 'PROFILE');
        }
        
        // Display occupation if available
        if (profileInfo.occupation) {
            logger.log(`Occupation: ${profileInfo.occupation}`, logger.LOG_LEVELS.INFO, 'PROFILE');
        }
        
        // Display education if available
        if (profileInfo.education) {
            logger.log(`Education: ${profileInfo.education}`, logger.LOG_LEVELS.INFO, 'PROFILE');
        }
        
        // Display additional sections if available
        if (profileInfo.sections && profileInfo.sections.length > 0) {
            logger.log(`Profile sections: ${profileInfo.sections.map(s => s.heading).join(', ')}`, 
                logger.LOG_LEVELS.INFO, 'PROFILE');
        }
        
        // Instead of saving bio to a file in screenshot directory, use a privacy-focused approach
        // If there's a section of the code that saves the bio to a file in the screenshot directory, replace it with:
        if (config.saveBioToFile && profileInfo.bio) {
            try {
                const bioFilePath = path.join(process.cwd(), 'profiles', `profile_bio_${Date.now()}.txt`);
                // Ensure profiles directory exists
                await fs.mkdir(path.dirname(bioFilePath), { recursive: true });
                await fs.writeFile(bioFilePath, profileInfo.bio);
                logger.log(`Bio saved to: ${bioFilePath}`, logger.LOG_LEVELS.DEBUG, 'PROFILE');
            } catch (error) {
                logger.log(`Error saving bio to file: ${error.message}`, logger.LOG_LEVELS.ERROR, 'PROFILE');
            }
        }
        
        return profileInfo;
    } catch (error) {
        logger.log(`Error extracting profile information: ${error.message}`, logger.LOG_LEVELS.ERROR, 'PROFILE');
        // Return a valid but empty profile info object on error
        return {
            name: 'Unknown',
            age: 'Unknown',
            occupation: '',
            education: '',
            hasBio: false,
            bio: '',
            attributes: [],
            interests: [],
            location: '',
            distance: '',
            sections: [],
            additionalBioTexts: [],
            combinedProfileText: '',
            fullText: '',
            extractionMethod: {
                name: 'error',
                age: 'error',
                bio: 'error',
                location: 'error',
                distance: 'error'
            },
            error: error.message
        };
    }
}

/**
 * Check if the bio contains any keywords to avoid
 * @param {string} bio The profile bio text
 * @param {Array<string>} avoidKeywords List of keywords to avoid
 * @returns {Object} Result with found keywords and decision
 */
function checkAvoidKeywords(bioText, avoidKeywords) {
    logger.log('Checking for avoid keywords...', logger.LOG_LEVELS.INFO, 'KEYWORDS');
    
    const textLower = bioText.toLowerCase();
    const foundKeywords = [];
    
    for (const keyword of avoidKeywords) {
        const keywordLower = keyword.toLowerCase();
        if (textLower.includes(keywordLower)) {
            foundKeywords.push(keyword);
        }
    }
    
    const result = {
        foundKeywords,
        shouldAvoid: foundKeywords.length > 0
    };
    
    if (result.shouldAvoid) {
        logger.log(`Found ${foundKeywords.length} avoid keywords: ${foundKeywords.join(', ')}`, logger.LOG_LEVELS.WARNING, 'KEYWORDS');
    } else {
        logger.log('No avoid keywords found', logger.LOG_LEVELS.SUCCESS, 'KEYWORDS');
    }
    
    return result;
}

/**
 * Analyze profile alignment with user interests (placeholder for LLM integration)
 * @param {Object} profileInfo The profile information
 * @param {Object} userPreferences User preferences and interests
 * @returns {Object} Analysis result with alignment score
 */
async function analyzeProfileAlignment(profileInfo, userPreferences) {
    logger.log('Analyzing profile alignment with user interests...', logger.LOG_LEVELS.INFO, 'ALIGNMENT');
    
    // Check age preference if enabled
    if (userPreferences.agePreference && userPreferences.agePreference.enabled) {
        // Verify we have age information
        if (profileInfo.age && !isNaN(parseInt(profileInfo.age))) {
            const profileAge = parseInt(profileInfo.age);
            const minAge = userPreferences.agePreference.minAge;
            const maxAge = userPreferences.agePreference.maxAge;
            
            // Check if age is within preferred range
            if (profileAge < minAge || profileAge > maxAge) {
                logger.log(`Profile age (${profileAge}) is outside preferred range (${minAge}-${maxAge})`, 
                    logger.LOG_LEVELS.WARNING, 'ALIGNMENT');
                
                return {
                    alignmentScore: 0,
                    alignmentLevel: 'Low',
                    isAligned: false,
                    matchingInterests: [],
                    matchCount: 0,
                    analysisText: '',
                    analysis: `Profile age (${profileAge}) is outside preferred range (${minAge}-${maxAge})`,
                    llmAnalysis: null,
                    rejectionReason: 'age_mismatch'
                };
            } else {
                logger.log(`Profile age (${profileAge}) is within preferred range (${minAge}-${maxAge})`, 
                    logger.LOG_LEVELS.SUCCESS, 'ALIGNMENT');
            }
        } else {
            logger.log('Age preference is enabled but profile age is unknown', 
                logger.LOG_LEVELS.WARNING, 'ALIGNMENT');
        }
    }
    
    // Check location preference if enabled
    if (userPreferences.locationPreference && 
        userPreferences.locationPreference.enabled && 
        userPreferences.locationPreference.preferredLocations && 
        userPreferences.locationPreference.preferredLocations.length > 0) {
        
        if (profileInfo.location) {
            const profileLocation = profileInfo.location.toLowerCase();
            const preferredLocations = userPreferences.locationPreference.preferredLocations.map(loc => loc.toLowerCase());
            
            // Check if profile location contains any of the preferred locations
            const locationMatch = preferredLocations.some(location => 
                profileLocation.includes(location) || location.includes(profileLocation)
            );
            
            if (!locationMatch) {
                logger.log(`Profile location (${profileInfo.location}) is not in preferred locations: ${userPreferences.locationPreference.preferredLocations.join(', ')}`,
                    logger.LOG_LEVELS.WARNING, 'ALIGNMENT');
                
                return {
                    alignmentScore: 0,
                    alignmentLevel: 'Low',
                    isAligned: false,
                    matchingInterests: [],
                    matchCount: 0,
                    analysisText: '',
                    analysis: `Profile location (${profileInfo.location}) is not in preferred locations`,
                    llmAnalysis: null,
                    rejectionReason: 'location_mismatch'
                };
            } else {
                logger.log(`Profile location (${profileInfo.location}) matches preferred locations`, 
                    logger.LOG_LEVELS.SUCCESS, 'ALIGNMENT');
            }
        } else {
            logger.log('Location preference is enabled but profile location is unknown', 
                logger.LOG_LEVELS.WARNING, 'ALIGNMENT');
        }
    }
    
    // Use the enhanced combined profile text if available
    let analysisText = '';
    
    if (profileInfo.combinedProfileText) {
        // Use the pre-computed combined text that includes all available profile information
        analysisText = profileInfo.combinedProfileText;
        logger.log('Using combined profile text for analysis (includes bio, attributes, location, and sections)', 
            logger.LOG_LEVELS.INFO, 'ALIGNMENT');
    } else {
        // Fallback to previous logic for backward compatibility
        if (profileInfo.hasBio && profileInfo.attributes && profileInfo.attributes.length > 0) {
            // Both bio and attributes exist, combine them
            analysisText = profileInfo.bio + ' ' + profileInfo.attributes.join(' ');
            logger.log('Using combined bio and attributes for analysis', logger.LOG_LEVELS.INFO, 'ALIGNMENT');
        } else if (profileInfo.hasBio) {
            // Only bio exists
            analysisText = profileInfo.bio;
            logger.log('Using only bio for analysis (no attributes found)', logger.LOG_LEVELS.INFO, 'ALIGNMENT');
        } else if (profileInfo.attributes && profileInfo.attributes.length > 0) {
            // Only attributes exist
            analysisText = profileInfo.attributes.join(' ');
            logger.log('Using only attributes for analysis (no bio found)', logger.LOG_LEVELS.INFO, 'ALIGNMENT');
        } else {
            // Neither bio nor attributes exist (this case is now handled in swipe-logic.js)
            analysisText = profileInfo.fullText || '';
            logger.log('No bio or attributes found, using full text for analysis', logger.LOG_LEVELS.WARNING, 'ALIGNMENT');
        }
    }
    
    // If we have location information, explicitly include it in the analysis
    if (profileInfo.location && !analysisText.includes(profileInfo.location)) {
        analysisText += ' ' + profileInfo.location;
    }
    
    // Extract keywords from user interests
    const userKeywords = userPreferences.interests.flatMap(interest => 
        interest.toLowerCase().split(/\s+/)
    );
    
    // Count matching keywords in profile analysis text
    const analysisTextLower = analysisText.toLowerCase();
    let matchCount = 0;
    
    // Use minKeywordLength from config
    const minKeywordLength = config.profile.alignment.minKeywordLength;
    
    for (const keyword of userKeywords) {
        if (keyword.length > minKeywordLength && analysisTextLower.includes(keyword)) {
            matchCount++;
        }
    }
    
    // Check for matching interests
    const profileInterestsLower = profileInfo.attributes.map(i => i.toLowerCase());
    const matchingInterests = userPreferences.interests.filter(interest => 
        profileInterestsLower.some(profileInterest => 
            profileInterest.includes(interest.toLowerCase()) || 
            interest.toLowerCase().includes(profileInterest)
        )
    );
    
    // Get weights from config
    const keywordWeight = config.profile.alignment.weights.keyword;
    const interestWeight = config.profile.alignment.weights.interest;
    
    // Calculate simple alignment score (0 to 1)
    const keywordAlignmentScore = userKeywords.length > 0 ? matchCount / userKeywords.length : 0;
    const interestAlignmentScore = userPreferences.interests.length > 0 ? 
        matchingInterests.length / userPreferences.interests.length : 0;
    
    // Combined score with weights from config
    const alignmentScore = (keywordAlignmentScore * keywordWeight) + (interestAlignmentScore * interestWeight);
    
    // Decision threshold from config or user preferences
    const alignmentThreshold = userPreferences.alignmentThreshold || config.profile.alignment.threshold;
    const isAligned = alignmentScore >= alignmentThreshold;
    
    // Get level thresholds from config
    const lowThreshold = config.profile.alignment.levels.low;
    const mediumThreshold = config.profile.alignment.levels.medium;
    
    const result = {
        alignmentScore,
        alignmentLevel: alignmentScore < lowThreshold ? 'Low' : 
                        alignmentScore < mediumThreshold ? 'Medium' : 'High',
        isAligned,
        matchingInterests,
        matchCount,
        analysisText, // Add the analysis text to the result for debugging
        analysis: `Profile has ${matchCount} keyword matches and ${matchingInterests.length} matching interests`,
        llmAnalysis: null // This will be populated if LLM is used
    };
    
    // Use LLM for additional analysis if enabled in user preferences
    if (userPreferences.llmSettings && userPreferences.llmSettings.enabled) {
        try {
            logger.log('LLM analysis enabled, calling Llama 3...', logger.LOG_LEVELS.INFO, 'LLM');
            
            // Call Llama 3 for analysis
            const llmResult = await llmIntegration.analyzeWithLlama(profileInfo, userPreferences);
            
            // Store the LLM analysis in the result
            result.llmAnalysis = {
                score: llmResult.score,
                analysis: llmResult.analysis,
                isCompatible: llmResult.score >= (userPreferences.llmSettings.minComparisonScore || 0.6)
            };
            
            // Use the new dedicated LLM response display function
            logger.displayLLMResponse(result.llmAnalysis.analysis, result.llmAnalysis.score);
            
            // Log the compatibility decision separately
            logger.log(`LLM Compatibility: ${result.llmAnalysis.isCompatible ? 'Compatible ✅' : 'Not compatible ❌'}`, 
                result.llmAnalysis.isCompatible ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.WARNING, 'LLM');
            
            // If LLM analysis is available, use it to override the isAligned decision
            // If LLM thinks the profile is compatible, respect that decision regardless of the heuristic
            if (result.llmAnalysis.isCompatible) {
                if (!result.isAligned) {
                    logger.log('LLM suggests compatibility despite heuristic disagreement, using LLM judgment', 
                        logger.LOG_LEVELS.SUCCESS, 'LLM');
                    result.isAligned = true;
                    result.analysis += ` (LLM override: ${result.llmAnalysis.analysis})`;
                    logger.log('Decision overridden by LLM analysis', logger.LOG_LEVELS.SUCCESS, 'LLM');
                }
            }
            // Only override if LLM thinks it's NOT compatible but our heuristic thinks it IS
            else if (!result.llmAnalysis.isCompatible && result.isAligned) {
                logger.log('LLM suggests no compatibility despite heuristic alignment, considering LLM judgment', 
                    logger.LOG_LEVELS.WARNING, 'LLM');
                
                // Only override if score difference is significant
                const scoreDifference = Math.abs(result.alignmentScore - result.llmAnalysis.score);
                if (scoreDifference > 0.2) {
                    result.isAligned = false;
                    result.analysis += ` (LLM override: ${result.llmAnalysis.analysis})`;
                    logger.log('Decision overridden by LLM analysis', logger.LOG_LEVELS.WARNING, 'LLM');
                } else {
                    logger.log('Score difference not significant enough for override', logger.LOG_LEVELS.INFO, 'LLM');
                }
            }
        } catch (error) {
            logger.log(`LLM analysis failed: ${error.message}`, logger.LOG_LEVELS.ERROR, 'LLM');
            // Continue with standard analysis if LLM fails
        }
    }
    
    logger.log(`Alignment analysis: ${result.alignmentLevel} (${Math.round(alignmentScore * 100)}%)`, 
        result.isAligned ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.INFO, 'ALIGNMENT');
    logger.log(`Decision: ${isAligned ? 'Aligned ✅' : 'Not aligned ❌'}`, 
        result.isAligned ? logger.LOG_LEVELS.SUCCESS : logger.LOG_LEVELS.WARNING, 'ALIGNMENT');
    
    return result;
}

module.exports = {
    extractProfileInfo,
    checkAvoidKeywords,
    analyzeProfileAlignment
}; 