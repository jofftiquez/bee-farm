/**
 * Enhanced logging utility for better output formatting
 */
const chalk = require('chalk');

/**
 * Log levels
 */
const LOG_LEVELS = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  DEBUG: 'debug'
};

/**
 * Format log message with timestamp and optional label
 * @param {string} message Message to log
 * @param {string} level Log level
 * @param {string} label Optional label for the message
 */
function log(message, level = LOG_LEVELS.INFO, label = null) {
  const timestamp = new Date().toLocaleTimeString();
  let formattedMessage = `[${timestamp}] `;
  
  if (label) {
    formattedMessage += `[${label}] `;
  }
  
  switch(level) {
    case LOG_LEVELS.SUCCESS:
      console.log(chalk.green(`${formattedMessage}✅ ${message}`));
      break;
    case LOG_LEVELS.WARNING:
      console.log(chalk.yellow(`${formattedMessage}⚠️ ${message}`));
      break;
    case LOG_LEVELS.ERROR:
      console.log(chalk.red(`${formattedMessage}❌ ${message}`));
      break;
    case LOG_LEVELS.DEBUG:
      console.log(chalk.blue(`${formattedMessage}🔍 ${message}`));
      break;
    default:
      console.log(chalk.white(`${formattedMessage}ℹ️ ${message}`));
  }
}

/**
 * Log a section header with visual separator
 * @param {string} title Section title
 */
function section(title) {
  const separator = '='.repeat(title.length + 8);
  console.log('\n' + chalk.cyan(separator));
  console.log(chalk.cyan(`=== ${title.toUpperCase()} ===`));
  console.log(chalk.cyan(separator) + '\n');
}

/**
 * Create a simple table from an array of objects
 * @param {Array<Object>} data Array of objects to display
 * @param {Array<string>} columns Column names to display
 */
function table(data, columns = null) {
  if (Array.isArray(data) && data.length > 0) {
    // If console.table is available (most modern environments)
    if (typeof console.table === 'function') {
      if (columns) {
        // Filter to only show specified columns
        const filteredData = data.map(item => {
          const filtered = {};
          columns.forEach(col => {
            filtered[col] = item[col];
          });
          return filtered;
        });
        console.table(filteredData);
      } else {
        console.table(data);
      }
      return;
    }
    
    // Fallback for environments without console.table
    // Determine columns if not provided
    if (!columns) {
      columns = Object.keys(data[0]);
    }
    
    // Calculate column widths based on content
    const colWidths = {};
    columns.forEach(col => {
      // Start with the column name length
      colWidths[col] = col.length;
      
      // Check each row for longer content
      data.forEach(row => {
        const value = String(row[col] || '');
        if (value.length > colWidths[col]) {
          colWidths[col] = value.length;
        }
      });
      
      // Add padding
      colWidths[col] += 2;
    });
    
    // Build header
    let header = '';
    columns.forEach(col => {
      header += col.padEnd(colWidths[col]);
    });
    console.log(chalk.cyan(header));
    
    // Build separator
    let separator = '';
    columns.forEach(col => {
      separator += '-'.repeat(colWidths[col]);
    });
    console.log(separator);
    
    // Build rows
    data.forEach(row => {
      let rowStr = '';
      columns.forEach(col => {
        const value = String(row[col] || '');
        rowStr += value.padEnd(colWidths[col]);
      });
      console.log(rowStr);
    });
    console.log('\n');
  } else {
    log('No data to display in table', LOG_LEVELS.WARNING);
  }
}

/**
 * Format profile information in a structured way
 * @param {Object} profileInfo Profile information
 */
function displayProfile(profileInfo) {
  section('Profile Information');
  
  // Basic info
  log(`Name: ${profileInfo.name || 'Unknown'}`, LOG_LEVELS.INFO, 'PROFILE');
  log(`Age: ${profileInfo.age || 'Unknown'}`, LOG_LEVELS.INFO, 'PROFILE');
  
  // Bio status
  if (profileInfo.hasBio) {
    log(`Bio: ${profileInfo.bio.substring(0, 100)}${profileInfo.bio.length > 100 ? '...' : ''}`, 
        LOG_LEVELS.SUCCESS, 'PROFILE');
  } else {
    log('No bio found', LOG_LEVELS.WARNING, 'PROFILE');
  }
  
  // Attributes/interests as a table if available
  if (profileInfo.attributes && profileInfo.attributes.length > 0) {
    log('Profile Attributes:', LOG_LEVELS.INFO, 'PROFILE');
    const attributeData = profileInfo.attributes.map(attr => ({ attribute: attr }));
    table(attributeData, ['attribute']);
  }
}

/**
 * Display verification results in a structured way
 * @param {Object} verificationResults Verification check results
 */
function displayVerification(verificationResults) {
  section('Verification Check');
  
  const resultItems = [
    { check: 'Badge element found', result: verificationResults.badgeFound ? 'YES' : 'NO' },
    { check: 'Text element found', result: verificationResults.textFound ? 'YES' : 'NO' },
    { check: 'Overall verdict', result: verificationResults.isVerified ? 'VERIFIED ✅' : 'NOT VERIFIED ❌' }
  ];
  
  table(resultItems, ['check', 'result']);
}

/**
 * Display swipe statistics
 * @param {number} swipeCount Total swipes
 * @param {number} likesCount Right swipes
 */
function displayStats(swipeCount, likesCount) {
  section('Swipe Statistics');
  
  const currentLikeRatio = likesCount / swipeCount;
  const stats = [
    { metric: 'Total swipes', value: swipeCount },
    { metric: 'Right swipes', value: `${likesCount} (${Math.round(currentLikeRatio * 100)}%)` },
    { metric: 'Left swipes', value: `${swipeCount - likesCount} (${Math.round((1 - currentLikeRatio) * 100)}%)` }
  ];
  
  table(stats, ['metric', 'value']);
}

/**
 * Display user preferences
 * @param {Object} preferences User preferences
 */
function displayPreferences(preferences) {
  section('User Preferences');
  
  const prefsData = [
    { setting: 'Bio required', value: preferences.requireBio ? 'YES' : 'NO' },
    { setting: 'Alignment threshold', value: `${Math.round(preferences.alignmentThreshold * 100)}%` }
  ];
  
  table(prefsData, ['setting', 'value']);
  
  // Display interests
  if (preferences.interests && preferences.interests.length > 0) {
    log('Interests:', LOG_LEVELS.INFO, 'PREFERENCES');
    const interestsData = preferences.interests.map(interest => ({ interest }));
    table(interestsData, ['interest']);
  }
  
  // Display avoid keywords
  if (preferences.avoidKeywords && preferences.avoidKeywords.length > 0) {
    log('Avoid Keywords:', LOG_LEVELS.INFO, 'PREFERENCES');
    const keywordsData = preferences.avoidKeywords.map(keyword => ({ keyword }));
    table(keywordsData, ['keyword']);
  }
}

module.exports = {
  LOG_LEVELS,
  log,
  section,
  table,
  displayProfile,
  displayVerification,
  displayStats,
  displayPreferences
}; 