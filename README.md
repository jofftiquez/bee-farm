# 🐝 Bee Farm A Bumble Automation With Anti-Detection Measures

This project provides a Puppeteer-based automation script for Bumble with advanced anti-detection measures to avoid bot detection.

## Features

- **Profile Analysis**: Analyzes Bee Farm profiles based on bio text, verification status, and interests
- **Smart Swiping**: Makes decisions based on user preferences and profile content
- **Session Persistence**: Maintains login sessions between runs with cookie management
- **Enhanced Logging**: Clear, color-coded logs with structured data presentation
- **LLM Integration**: Optional Llama 3 integration for intelligent profile compatibility analysis
- **Profile Verification Detection**: Automatically detects verified profiles for enhanced filtering
- **Advanced Session Management**: Scheduled session saving and fingerprint consistency
- **Natural Browsing Patterns**: Implements rest periods and session limits to simulate human behavior

## Anti-Detection Measures

This script includes the following measures to avoid bot detection:

1. **Puppeteer Stealth Mode**
   - Uses puppeteer-extra with stealth plugin to bypass detection
   - Modifies browser fingerprinting properties
   - Randomizes user agents and HTTP headers

2. **Human-Like Interaction**
   - Randomized mouse movements with realistic acceleration/deceleration
   - Variable click durations and natural profile scrolling
   - Random delays between actions with non-uniform distribution
   - Implements both short and long delays based on configurable probabilities

3. **Browser Environment Evasions**
   - Spoofed WebGL fingerprinting
   - Realistic plugins and MIME types
   - Modified navigator properties and permissions API behavior
   - Consistent browser fingerprint between sessions

4. **Session Management**
   - Maintains consistent fingerprinting between sessions
   - Periodically saves cookies during normal operation
   - Simulates browser behavior with regular cookie updates
   - Scheduled session saving at configurable intervals

5. **Usage Pattern Simulation**
   - Enforces session limits to mimic natural usage (time-based and swipe count)
   - Implements rest periods with random durations
   - Varies interaction patterns to prevent predictability
   - Implements natural breaks between swipe sessions

## Setup and Usage

1. Install dependencies:
   ```
   pnpm install
   ```

2. Run the script:
   ```
   node index.js
   ```

3. Follow the prompts to log in (first time only) and navigate to the swiping interface

## Configuration

The script uses the following configuration files:

- `user_preferences.json`: Define your preferences for profile matching
- `session_data/`: Contains session cookies and fingerprinting data
- `lib/config.js`: Main configuration for timing, session limits, and behavior

## Advanced Features

- **Profile Verification Checks**: Only swipes right on verified profiles
- **Bio Analysis**: Checks for keywords to avoid and interests that align with preferences
- **Match Handling**: Automatically handles match popups when they appear
- **Age and Location Preferences**: Filter profiles based on age range and location preferences
- **LLM-Powered Analysis**: Optional Llama 3 integration for intelligent profile compatibility scoring
- **Natural Rest Periods**: Implements randomized activity and rest cycles
- **Extended Session Management**: Manages multiple swipe sessions with longer breaks between

## LLM Integration

The script now includes optional integration with Llama 3 for advanced profile compatibility analysis:

- Connect to local Llama 3 instance via Ollama or other LLM servers
- Analyze profiles based on deeper contextual understanding
- Get compatibility scores and detailed analyses for potential matches
- Override simple keyword matching with AI-powered compatibility detection

See `llm-integration-readme.md` for setup instructions.

## Customization

You can modify the following aspects:
- Swiping criteria in `lib/swipe-logic.js`
- Anti-detection settings in `lib/anti-detection.js`
- Browser configuration in `lib/browser.js`
- LLM settings in user preferences

## Notes

- This script is for educational purposes only
- Use responsibly and in accordance with Bumble's terms of service
- The script operates in a visible browser window and requires manual login

## 🚨 Important Disclaimer

This project is for **educational purposes only**. Using automation scripts with Bumble or other dating applications:

- May violate Bumble's Terms of Service
- Could potentially result in account suspension
- May not align with the intended use of the platform
- **May decrease your profile's score** instead of improving it, as Bumble's actual algorithm is proprietary and not publicly verified

Use at your own risk. The authors and contributors of this code are not responsible for any consequences resulting from its use.

## ✨ Features

- Automatically finds and clicks Like/Pass buttons
- Intelligent button detection using Bee Farm's data-qa-role attributes
- Implements an Elo-optimized swiping algorithm (18% right / 82% left ratio)
- Simulates natural browsing behavior with random delays and profile scrolling
- Dynamic ratio adjustment to maintain optimal scoring
- Configurable like/pass ratio with built-in pattern randomization
- Automatic cleanup of temporary files
- Natural rest periods (15-20 minute activity followed by 5-10 minute breaks)
- Automatic match notification handling (dismisses "Continue Bumbling" dialogs)
- Randomized session lengths to avoid predictable usage patterns
- Enhanced profile verification detection using multiple methods
- Age and location-based profile filtering
- Support for LLM-based profile compatibility analysis

## 📋 Requirements

- Node.js (v14 or higher recommended)
- npm or pnpm
- A Bee Farm account
- (Optional) Ollama with Llama 3 for LLM integration

## 🔧 Installation

1. Clone this repository or download the source code
2. Install dependencies:

```bash
npm install
# or
pnpm install
```

## 🚀 Usage

1. Run the script:

```bash
node index.js
```

2. When prompted, log into your Bee Farm account in the browser window
3. Navigate to the main swiping interface and press Enter when ready
4. The script will automatically detect the like/pass buttons
5. You can test the detected button positions
6. Configure the like percentage (default is 18% based on Elo optimization)
7. Enable additional features like LLM analysis and age/location preferences
8. The script will begin automatically swiping based on your settings

## 📝 How It Works

1. **Button Detection**: The script automatically locates buttons using Bee Farm's data-qa-role attributes:
   - Like button: `data-qa-role="encounters-action-like"`
   - Pass button: `data-qa-role="encounters-action-dislike"`

2. **Profile Interaction**: For each profile, the script:
   - Scrolls through profile content (random number of up/down actions)
   - Extracts and analyzes profile information (bio, interests, verification status)
   - Makes a decision based on configured probability and profile analysis
   - Clicks the appropriate button
   - Adds random delays between actions

3. **Algorithm Optimization**: Uses Elo-based swiping patterns to improve your profile score

4. **Match Handling**: The script automatically manages match notifications:
   - Detects when a match occurs after a right swipe
   - Finds and clicks the "Continue Bumbling" button to dismiss match dialogs
   - Uses multiple detection methods to handle different UI variations
   - Ensures uninterrupted swiping even when matches occur

5. **Rest Periods**: The script implements natural rest periods:
   - Takes a break after 15-20 minutes of activity (randomly determined)
   - Rests for 5-10 minutes during each break (randomly determined)
   - Completely stops all activity during rest periods
   - Automatically resumes after each rest period
   - Helps simulate natural human behavior and reduce detection risk

6. **Session Management**: The script implements multi-session swiping:
   - Limits each session to a random number of swipes (configurable)
   - Takes extended breaks between sessions (30-60 minutes)
   - Maintains consistent fingerprinting between sessions
   - Periodically saves cookies to mimic browser behavior

7. **LLM Analysis**: When enabled, the script:
   - Sends profile data to Llama 3 for intelligent compatibility analysis
   - Receives a detailed compatibility report and score
   - Uses this information to make more nuanced swiping decisions
   - Provides human-readable explanations for compatibility decisions

8. **Termination**: Press Ctrl+C at any time to safely exit the script and clean up resources.

## 🧮 The Math Behind the Algorithm

**IMPORTANT DISCLAIMER**: The algorithm theory presented below is based on general Elo rating systems and research into dating apps. Bumble's actual algorithm is proprietary and may function differently. This approach could potentially decrease your profile's score instead of improving it. Use at your own risk.

The Bumble algorithm uses a variation of the Elo rating system, similar to chess rankings, where your score changes based on the "game" outcome when you interact with other profiles.

### Elo Rating System Basics

In the context of dating apps, the Elo rating system works as follows:

1. **Every user has a hidden score** that determines profile visibility and match quality.
2. **When you interact with another profile, it's like playing a "game"**:
   - Swiping left on a high-score profile = You "win" (your score increases)
   - Swiping right on a high-score profile who ignores you = You "lose" (your score decreases)
   - Getting easy matches with low-score profiles = "Easy wins" (actually lowers your score)

### Population Distribution Analysis

Based on research into dating app demographics:
- ~10% of users have high Elo scores (P(H) = 0.10)
- ~60% of users have mid-range Elo scores (P(M) = 0.60)
- ~30% of users have low Elo scores (P(L) = 0.30)

### Optimal Strategy Calculation

For maximizing your Elo score:

1. **High-Elo profiles** (10% of population):
   - Swipe left 90% of the time (win the game)
   - Swipe right 10% of the time (selective matches)

2. **Mid-Elo profiles** (60% of population):
   - Swipe left 70% of the time (maintain selectivity)
   - Swipe right 30% of the time (strategic matches)

3. **Low-Elo profiles** (30% of population):
   - Swipe left ~100% of the time (avoid score penalties)

### Resulting Ratio Calculation

```
Total right swipe ratio = 
  (P(H) × 0.10) + (P(M) × 0.30) + (P(L) × 0.00)
= (0.10 × 0.10) + (0.60 × 0.30) + (0.30 × 0.00)
= 0.01 + 0.18 + 0.00
= 0.19 ≈ 18%
```

Therefore, the optimal swipe ratio is approximately:
- 18% right swipes (selectively choosing mid-to-high profiles)
- 82% left swipes (rejecting most profiles)

The script implements this ratio while adding randomness to avoid pattern detection penalties.

## 🛠️ Customization

- Adjust the like probability when prompted (optimized default is 18%)
- Configure age and location preferences for more targeted matching
- Enable or disable LLM analysis for deeper profile compatibility assessment
- Modify delays in the code to speed up or slow down the automation
- Update the page.goto URL if you want to use a different entry point

## ⚠️ Troubleshooting

If button detection fails:
1. The script will fall back to manual coordinate entry
2. Check if Bumble has updated their UI or HTML structure
3. Use the test functionality to confirm button positions work

For LLM integration issues:
1. Check if Ollama or your LLM server is running
2. Verify the model name and endpoint configuration
3. See llm-integration-readme.md for detailed setup instructions

## ⚠️ Caveats

Please be aware of the following limitations when using this script:

- **Do not resize your browser window** after setup. The script relies on fixed coordinates for clicking, so resizing will cause clicks to miss their targets.
- **UI changes by Bumble** may break button detection. The script attempts to find buttons in multiple ways, but major UI redesigns could require script updates.
- **Extended usage** may increase the risk of detection by Bumble's anti-bot systems, despite the natural behavior simulation.
- **Match handling** depends on the "Continue Bumbling" button being present. If Bumble changes this text or UI element, matches may interrupt the flow.
- **Network issues** or slow connections can affect timing, potentially causing missed clicks or actions.
- **System sleep/hibernation** during rest periods will pause execution without the script knowing, disrupting the timing system.

If you encounter issues, try restarting the script and recalibrating the button positions.

## 🔐 Authentication and Session Persistence

The script includes a robust session management system to maintain your login between sessions:

- **Cookie-based Authentication**: The script saves and reuses session cookies to avoid logging in each time
- **Login Detection**: Automatically determines if you're already logged in or need to authenticate
- **Fingerprint Consistency**: Maintains the same browser fingerprint between sessions to avoid detection
- **Scheduled Session Saving**: Automatically saves session state at configurable intervals

## 📜 License

MIT

## 🙏 Acknowledgments

This project uses [Puppeteer](https://pptr.dev/) for browser automation. 

##  Author

Made with ❤️ by [@jofftiquez](https://github.com/jofftiquez)