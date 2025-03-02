# Bumble Automation

A Node.js application that automates interactions with Bumble using Puppeteer, optimized with Elo rating system analysis.

## 🚨 Important Disclaimer

This project is for **educational purposes only**. Using automation scripts with Bumble or other dating applications:

- May violate Bumble's Terms of Service
- Could potentially result in account suspension
- May not align with the intended use of the platform

Use at your own risk. The authors and contributors of this code are not responsible for any consequences resulting from its use.

## ✨ Features

- Automatically finds and clicks Like/Pass buttons
- Intelligent button detection using Bumble's data-qa-role attributes
- Implements an Elo-optimized swiping algorithm (18% right / 82% left ratio)
- Simulates natural browsing behavior with random delays and profile scrolling
- Dynamic ratio adjustment to maintain optimal scoring
- Configurable like/pass ratio with built-in pattern randomization
- Automatic cleanup of temporary files
- Screenshot-assisted troubleshooting

## 📋 Requirements

- Node.js (v14 or higher recommended)
- npm or pnpm
- A Bumble account

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

2. When prompted, log into your Bumble account in the browser window
3. Navigate to the main swiping interface and press Enter when ready
4. The script will automatically detect the like/pass buttons
5. You can test the detected button positions
6. Configure the like percentage (default is 18% based on Elo optimization)
7. The script will begin automatically swiping based on your settings

## 📝 How It Works

1. **Button Detection**: The script automatically locates buttons using Bumble's data-qa-role attributes:
   - Like button: `data-qa-role="encounters-action-like"`
   - Pass button: `data-qa-role="encounters-action-dislike"`

2. **Profile Interaction**: For each profile, the script:
   - Scrolls through profile content (random number of up/down actions)
   - Makes a decision based on configured probability
   - Clicks the appropriate button
   - Adds random delays between actions

3. **Algorithm Optimization**: Uses Elo-based swiping patterns to improve your profile score

4. **Termination**: Press Ctrl+C at any time to safely exit the script and clean up resources.

## 🧮 The Math Behind the Algorithm

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
- Modify delays in the code to speed up or slow down the automation
- Update the page.goto URL if you want to use a different entry point

## 📷 Screenshots

The script takes a temporary screenshot during setup to assist with button detection, which is automatically deleted when the script terminates.

## ⚠️ Troubleshooting

If button detection fails:
1. The script will fall back to manual coordinate entry
2. Check if Bumble has updated their UI or HTML structure
3. Use the test functionality to confirm button positions work

## 📜 License

MIT

## 🙏 Acknowledgments

This project uses [Puppeteer](https://pptr.dev/) for browser automation. 

## 🤓 Author

Made with ❤️ by [@jofftiquez](https://github.com/jofftiquez)