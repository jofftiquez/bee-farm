const fs = require('fs');
const path = require('path');

// Try to load user preferences
try {
  const prefsPath = path.join(__dirname, 'user_preferences.json');
  console.log('Looking for preferences file at:', prefsPath);
  
  if (fs.existsSync(prefsPath)) {
    console.log('✅ File exists');
    
    const data = fs.readFileSync(prefsPath, 'utf8');
    console.log('✅ File contents loaded');
    
    const userPreferences = JSON.parse(data);
    console.log('✅ File parsed successfully');
    
    // Check if LLM is enabled
    console.log('LLM enabled:', userPreferences.llmSettings.enabled);
    console.log('LLM min score:', userPreferences.llmSettings.minComparisonScore);
    
    // Print summary of preferences
    console.log('\n=== USER PREFERENCES SUMMARY ===');
    console.log(`Interests: ${userPreferences.interests.length} items`);
    console.log(`Avoid keywords: ${userPreferences.avoidKeywords.length} items`);
    console.log(`Require bio: ${userPreferences.requireBio}`);
    console.log(`Alignment threshold: ${userPreferences.alignmentThreshold}`);
    console.log(`Swipe right percentage: ${userPreferences.swipeRightPercentage}%`);
  } else {
    console.log('❌ File does not exist');
  }
} catch (error) {
  console.error('❌ Error reading preferences:', error.message);
} 