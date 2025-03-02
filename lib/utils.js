const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function for user prompts
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to simulate profile checking with keyboard navigation
async function simulateProfileCheck(page) {
    console.log('Checking profile...');
    const keyPresses = Math.floor(Math.random() * 9); // Random 0-8 times
    for (let i = 0; i < keyPresses; i++) {
        await page.keyboard.press('ArrowDown');
        await delay(Math.random() * 500 + 200); // Random delay
    }
    for (let i = 0; i < keyPresses; i++) {
        await page.keyboard.press('ArrowUp');
        await delay(Math.random() * 500 + 200);
    }
}

// Function to click at specific coordinates
async function clickAtPosition(page, x, y) {
    await page.mouse.click(x, y, { delay: Math.random() * 100 + 50 });
}

// Directory management
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        return true;
    } catch (err) {
        console.log(`Error creating directory ${dirPath}:`, err.message);
        return false;
    }
}

module.exports = {
    rl,
    question,
    delay,
    simulateProfileCheck,
    clickAtPosition,
    ensureDirectoryExists
}; 