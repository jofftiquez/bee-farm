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
  DEBUG: 'debug',
  HIGHLIGHT: 'highlight', // New level for highlighting important information
  LLM: 'llm' // New level specifically for LLM responses
};

/**
 * Store current active profile to group logs
 */
let currentProfile = null;
let profileSectionOpen = false;
let lastLogGroup = null;

/**
 * Format log message with timestamp and optional label
 * @param {string} message Message to log
 * @param {string} level Log level
 * @param {string} label Optional label for the message
 */
function log(message, level = LOG_LEVELS.INFO, label = null) {
  const timestamp = new Date().toLocaleTimeString();
  let formattedMessage = `[${timestamp}] `;
  
  // Group logs by profile
  const isNewGroup = label && lastLogGroup !== label;
  if (isNewGroup && lastLogGroup) {
    // Add visual separator between different log groups
    if (label !== 'PROFILE' && label !== 'CLEANUP') {
      console.log(chalk.gray('─'.repeat(80)));
    }
  }
  
  lastLogGroup = label;
  
  // Format the label specially if it's a profile
  if (label) {
    if (label === 'PROFILE') {
      formattedMessage += chalk.magenta(`[👤 PROFILE] `);
    } else if (label === 'ALIGNMENT') {
      formattedMessage += chalk.cyan(`[🧩 ${label}] `);
    } else if (label === 'DECISION') {
      formattedMessage += chalk.yellow(`[🤔 ${label}] `);
    } else if (label === 'LLM') {
      formattedMessage += chalk.magenta(`[🧠 ${label}] `);
    } else if (label === 'CLEANUP') {
      formattedMessage += chalk.gray(`[🧹 ${label}] `);
    } else {
      formattedMessage += `[${label}] `;
    }
  }
  
  // Format message based on log level
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
    case LOG_LEVELS.HIGHLIGHT:
      // Special highlighting for important information
      console.log(chalk.bgCyan.black(`${formattedMessage}💡 ${message}`));
      break;
    case LOG_LEVELS.LLM:
      // Special formatting for LLM responses to make them clearly visible
      console.log('\n' + chalk.bgMagenta.white(`${formattedMessage}🤖 LLM RESPONSE:`));
      console.log(chalk.magenta('┌' + '─'.repeat(78) + '┐'));
      
      // Split message by lines and add padding
      const lines = message.split('\n');
      for (const line of lines) {
        console.log(chalk.magenta('│ ') + chalk.white(line.padEnd(76)) + chalk.magenta(' │'));
      }
      
      console.log(chalk.magenta('└' + '─'.repeat(78) + '┘\n'));
      break;
    default:
      console.log(chalk.white(`${formattedMessage}ℹ️ ${message}`));
  }
}

/**
 * Start tracking a new profile
 * @param {string} profileName The name of the profile
 * @param {number} profileAge The age of the profile
 */
function startProfile(profileName, profileAge) {
  // Close any existing profile section
  if (profileSectionOpen) {
    console.log(chalk.magenta('└' + '─'.repeat(78) + '┘'));
  }
  
  currentProfile = { name: profileName, age: profileAge };
  profileSectionOpen = true;
  
  // Create a prominent header for the new profile
  console.log('\n' + chalk.magenta('┌' + '─'.repeat(78) + '┐'));
  console.log(chalk.magenta('│ ') + 
    chalk.bgMagenta.white(` 👤 PROFILE: ${profileName || 'Unknown'}, ${profileAge || '?'} `) + 
    chalk.magenta(' '.repeat(Math.max(0, 65 - (profileName || '').length - String(profileAge || '').length))) + ' │');
  console.log(chalk.magenta('├' + '─'.repeat(78) + '┤'));
}

/**
 * End the current profile tracking
 * @param {string} decision The swipe decision ('right' or 'left')
 * @param {string} reason Reason for the decision
 */
function endProfile(decision, reason) {
  if (!profileSectionOpen) return;
  
  // Add a summary footer with the decision
  console.log(chalk.magenta('├' + '─'.repeat(78) + '┤'));
  
  const decisionText = decision === 'right' 
    ? chalk.green('RIGHT SWIPE ✅') 
    : chalk.yellow('LEFT SWIPE ⬅️');
  
  console.log(chalk.magenta('│ ') + 
    chalk.bold(`DECISION: ${decisionText} - ${reason}`) + 
    chalk.magenta(' '.repeat(Math.max(0, 66 - reason.length - (decision === 'right' ? 16 : 15)))) + ' │');
  
  console.log(chalk.magenta('└' + '─'.repeat(78) + '┘\n'));
  
  profileSectionOpen = false;
  currentProfile = null;
}

/**
 * Log a section header with visual separator
 * @param {string} title Section title
 */
function section(title) {
  // Close any existing profile section when starting a new major section
  if (profileSectionOpen) {
    console.log(chalk.magenta('└' + '─'.repeat(78) + '┘'));
    profileSectionOpen = false;
  }

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
  // Start tracking this profile
  startProfile(profileInfo.name, profileInfo.age);
  
  // Basic info with extraction method
  let nameLogLevel = LOG_LEVELS.INFO;
  let ageLogLevel = LOG_LEVELS.INFO;
  
  // Set log level based on extraction method
  if (profileInfo.extractionMethod) {
    nameLogLevel = profileInfo.extractionMethod.name === 'specific_selector' ? LOG_LEVELS.SUCCESS : 
                  (profileInfo.extractionMethod.name === 'regex_fallback' ? LOG_LEVELS.WARNING : LOG_LEVELS.INFO);
    
    ageLogLevel = profileInfo.extractionMethod.age === 'specific_selector' ? LOG_LEVELS.SUCCESS : 
                 (profileInfo.extractionMethod.age === 'regex_fallback' ? LOG_LEVELS.WARNING : LOG_LEVELS.INFO);
  }
  
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
  const isVerified = verificationResults.isVerified;
  log(`Verification: ${isVerified ? 'VERIFIED ✅' : 'NOT VERIFIED ❌'}`, 
    isVerified ? LOG_LEVELS.SUCCESS : LOG_LEVELS.WARNING, 'PROFILE');
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
  
  const config = require('./config');
  
  const prefsData = [
    { setting: 'Bio required', value: preferences.requireBio ? 'YES' : 'NO' },
    { setting: 'Verified profile required', value: preferences.requireVerified ? 'YES' : 'NO' },
    { setting: 'Swipe right percentage', value: `${preferences.swipeRightPercentage || config.swiping.defaultSwipeRightPercentage}% ${!preferences.swipeRightPercentage ? '(default)' : ''}` },
    { setting: 'Alignment threshold', value: `${Math.round(preferences.alignmentThreshold * 100)}%` }
  ];
  
  // Add age preference if it exists
  if (preferences.agePreference) {
    prefsData.push({ 
      setting: 'Age matters', 
      value: preferences.agePreference.enabled ? 'YES' : 'NO' 
    });
    
    if (preferences.agePreference.enabled) {
      prefsData.push({ 
        setting: 'Age range', 
        value: `${preferences.agePreference.minAge} - ${preferences.agePreference.maxAge}` 
      });
    }
  }
  
  // Add location preference if it exists
  if (preferences.locationPreference) {
    prefsData.push({ 
      setting: 'Location matters', 
      value: preferences.locationPreference.enabled ? 'YES' : 'NO' 
    });
    
    if (preferences.locationPreference.enabled && preferences.locationPreference.preferredLocations && 
        preferences.locationPreference.preferredLocations.length > 0) {
      prefsData.push({ 
        setting: 'Preferred locations', 
        value: preferences.locationPreference.preferredLocations.join(', ') 
      });
    }
  }
  
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

/**
 * Display decision and score in a highlighted format
 * @param {string} decision The decision made ('right' or 'left')
 * @param {string} reason The reason for the decision
 * @param {number} score The alignment score (0.0 to 1.0)
 */
function displayDecision(decision, reason, score) {
  const formattedScore = Math.round(score * 100);
  const scoreText = `${formattedScore}% match`;
  
  log(`Decision: ${decision.toUpperCase()} (${scoreText}) - ${reason}`, 
      decision === 'right' ? LOG_LEVELS.HIGHLIGHT : LOG_LEVELS.WARNING, 
      'DECISION');
      
  // End the current profile section with decision
  endProfile(decision, `${scoreText} - ${reason}`);
}

/**
 * Display LLM response in a specially formatted way
 * @param {string} analysis The LLM analysis text
 * @param {number} score The compatibility score
 */
function displayLLMResponse(analysis, score) {
  const formattedScore = Math.round(score * 100);
  log(`${analysis}\n\nCompatibility Score: ${formattedScore}%`, LOG_LEVELS.LLM);
}

module.exports = {
  LOG_LEVELS,
  log,
  section,
  table,
  displayProfile,
  displayVerification,
  displayStats,
  displayPreferences,
  startProfile,
  endProfile,
  displayDecision,
  displayLLMResponse
}; 