const path = require('path');
const logger = require('./logger');

/**
 * Check if a profile is photo verified on Bumble
 * @param {Object} page Puppeteer page object
 * @param {string} screenshotDir Directory for saving screenshots
 * @returns {boolean} Whether the profile is verified
 */
async function isProfilePhotoVerified(page, screenshotDir) {
    logger.log('Checking if profile is photo verified...', logger.LOG_LEVELS.INFO, 'VERIFICATION');
    
    try {
        // Take a screenshot for debugging
        const screenshotPath = path.join(screenshotDir, 'verification_check.png');
        await page.screenshot({ path: screenshotPath });
        logger.log(`Verification screenshot saved to: ${screenshotPath}`, logger.LOG_LEVELS.DEBUG, 'VERIFICATION');
        
        // Check for verification on the page
        const verificationResult = await page.evaluate(() => {
            // Track verification elements for reporting
            const results = {
                badgeFound: false,
                textFound: false,
                otherElements: 0,
                textMatches: 0,
                foundElements: []
            };
            
            // Check #1: Look for the specific data-qa-icon-name attribute
            const verificationBadge = document.querySelector('[data-qa-icon-name="badge-feature-verification"]');
            results.badgeFound = !!verificationBadge;
            if (verificationBadge) {
                results.foundElements.push('badge-feature-verification');
            }
            
            // Check #2: Look for the specific verification text element
            const verificationTextContainer = document.querySelector('.encounters-story-profile__verification-text');
            results.textFound = !!verificationTextContainer;
            
            // Check if "verified" text is present in the element
            if (verificationTextContainer) {
                const text = verificationTextContainer.textContent.toLowerCase();
                results.textVerified = text.includes('verified');
                if (results.textVerified) {
                    results.foundElements.push('verification-text-element');
                }
            }
            
            // Check #3: Scan page text for verification terms
            const bodyText = document.body.textContent.toLowerCase();
            const verificationTerms = ['photo verified', 'profile verified', 'photo verification'];
            
            verificationTerms.forEach(term => {
                if (bodyText.includes(term)) {
                    results.textMatches++;
                    results.foundElements.push(`text-match: ${term}`);
                }
            });
            
            // Check #4: Look for additional verification classes or elements as fallback
            const verificationClasses = ['verified', 'verification', 'photo-verified', 'badge', 'check-badge'];
            verificationClasses.forEach(className => {
                const elements = document.querySelectorAll(`.${className}`);
                results.otherElements += elements.length;
                if (elements.length > 0) {
                    results.foundElements.push(`class: ${className}`);
                }
            });
            
            // Determine if profile is verified based on the checks
            const isVerified = results.badgeFound || 
                              (results.textFound && results.textVerified) || 
                               results.textMatches > 0;
            
            return {
                badgeFound: results.badgeFound,
                textFound: results.textFound && results.textVerified,
                otherElements: results.otherElements,
                textMatches: results.textMatches,
                isVerified: isVerified,
                foundElements: results.foundElements
            };
        });
        
        // Display verification results in a nice format
        logger.displayVerification(verificationResult);
        
        return verificationResult.isVerified;
    } catch (error) {
        logger.log(`Error checking profile verification: ${error.message}`, logger.LOG_LEVELS.ERROR, 'VERIFICATION');
        return false;
    }
}

module.exports = {
    isProfilePhotoVerified
}; 