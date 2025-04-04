# 🐝 Bee Farm - Intelligent Bumble Automation

A sophisticated Puppeteer-based automation solution for Bumble with advanced anti-detection measures and intelligent profile analysis.

## 🌟 Key Features

- **Smart Profile Analysis**: Bio text analysis, verification status checking, and interest matching
- **Intelligent Swiping**: Elo-optimized algorithm with configurable decision making
- **Anti-Detection System**: Advanced measures to maintain natural behavior patterns
- **LLM Integration**: Optional Llama 3 integration for deep compatibility analysis
- **Session Management**: Persistent login and consistent browser fingerprinting

## 🛡️ Anti-Detection Measures

1. **Stealth Mode**
   - Puppeteer-extra with stealth plugin
   - Dynamic fingerprinting and header randomization
   - WebGL and plugin spoofing

2. **Human Behavior Simulation**
   - Natural mouse movements and scrolling patterns
   - Variable delays and session timing
   - Randomized interaction patterns
   - Automated rest periods

## 🧮 Algorithm Intelligence

The system implements an Elo-optimized strategy based on dating app demographics:

### Population Distribution
- ~10% of users have high Elo scores (P(H) = 0.10)
- ~60% of users have mid-range Elo scores (P(M) = 0.60)
- ~30% of users have low Elo scores (P(L) = 0.30)

### Optimal Strategy
```
Total right swipe ratio = 
  (P(H) × 0.10) + (P(M) × 0.30) + (P(L) × 0.00)
= (0.10 × 0.10) + (0.60 × 0.30) + (0.30 × 0.00)
= 0.01 + 0.18 + 0.00
= 0.19 ≈ 18%
```

This results in an optimal 18% right / 82% left swipe ratio with built-in randomization.

## 🚀 Getting Started

### Prerequisites
- Node.js (v14+)
- npm or pnpm
- Bumble account
- (Optional) Ollama with Llama 3

### Installation
```bash
pnpm install
```

### Usage
```bash
node index.js
```

## ⚙️ Configuration

- `user_preferences.json`: Profile matching preferences
- `session_data/`: Session and fingerprint data
- `lib/config.js`: Core behavior settings
- `lib/swipe-logic.js`: Decision making logic
- `lib/anti-detection.js`: Stealth settings
- `lib/browser.js`: Browser configuration

## 🤖 LLM Integration

Connect to a local Llama 3 instance for:
- Deep profile compatibility analysis
- Contextual understanding of bios
- Intelligent matching decisions

Refer to `llm-integration-readme.md` for setup details.

## ⚠️ Important Notes

- **Educational Purpose**: This project is for learning only
- **Terms of Service**: Usage may violate Bumble's TOS
- **Account Risk**: May result in account penalties
- **Algorithm Impact**: Could affect profile scoring
- **Browser Window**: Keep window size constant after setup
- **Network Dependency**: Requires stable connection
- **Session Handling**: System sleep may affect timing

## 📄 License

MIT

## 👨‍💻 Author

Made with ❤️ by [@jofftiquez](https://github.com/jofftiquez)