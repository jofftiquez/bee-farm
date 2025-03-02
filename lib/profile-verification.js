const path = require('path');

/**
 * Check if a profile is photo verified
 * @param {Object} page Puppeteer page object
 * @param {string} screenshotDir Directory for saving screenshots
 * @returns {boolean} True if the profile is verified
 */
async function isProfilePhotoVerified(page, screenshotDir) {
    console.log('Checking if profile is photo verified...');
    
    try {
        // First, take a screenshot for debugging
        const verificationScreenshotPath = path.join(screenshotDir, 'verification_check.png');
        await page.screenshot({ path: verificationScreenshotPath });
        console.log(`Verification screenshot saved to: ${verificationScreenshotPath}`);
        
        const photoVerifiedExists = await page.evaluate(() => {
            // Look for the exact elements found in the DOM
            
            // 1. The verification badge icon
            const verificationBadge = document.querySelector('[data-qa-icon-name="badge-feature-verification"]');
            
            // 2. The specific verification text element
            const verificationTextElement = document.querySelector('.encounters-story-profile__verification-text');
            const hasVerificationText = verificationTextElement && 
                                       verificationTextElement.textContent && 
                                       verificationTextElement.textContent.includes('verified');
            
            // 3. As a fallback, check other known patterns
            const verificationClasses = [
                'verified', 
                'verification', 
                'photo-verified', 
                'badge-feature-verification'
            ];
            
            // Build a selector for elements with classes containing these terms
            const classSelectors = verificationClasses.map(cls => `[class*="${cls}"]`).join(',');
            const verificationElements = document.querySelectorAll(classSelectors);
            
            // 4. Check for actual text in the entire page as a last resort
            const pageText = document.body.innerText;
            const hasVerifiedText = pageText.includes('Photo verified') || 
                                   pageText.includes('Verified') ||
                                   pageText.includes('verified');
            
            // Return comprehensive information
            return {
                // Consider verified if we found any of the specific verification elements
                found: !!verificationBadge || hasVerificationText || verificationElements.length > 0 || hasVerifiedText,
                exactMatch: {
                    badge: !!verificationBadge,
                    textElement: !!verificationTextElement,
                    hasVerificationText: hasVerificationText
                },
                fallbacks: {
                    classElements: verificationElements.length,
                    pageText: hasVerifiedText
                }
            };
        });
        
        // Detailed logging of what we found
        console.log(`Verification check results:`);
        console.log(`- Badge element found: ${photoVerifiedExists.exactMatch.badge ? 'YES' : 'NO'}`);
        console.log(`- Text element found: ${photoVerifiedExists.exactMatch.textElement ? 'YES' : 'NO'}`);
        console.log(`- Verification text in element: ${photoVerifiedExists.exactMatch.hasVerificationText ? 'YES' : 'NO'}`);
        console.log(`- Other verification elements: ${photoVerifiedExists.fallbacks.classElements}`);
        console.log(`- Verification in page text: ${photoVerifiedExists.fallbacks.pageText ? 'YES' : 'NO'}`);
        console.log(`- Overall verdict: ${photoVerifiedExists.found ? 'VERIFIED ✅' : 'NOT VERIFIED ❌'}`);
        
        return photoVerifiedExists.found;
    } catch (error) {
        console.log('Error checking photo verification:', error.message);
        return false;
    }
}

module.exports = {
    isProfilePhotoVerified
}; 