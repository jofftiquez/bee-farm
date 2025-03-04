#!/usr/bin/env node

/**
 * Starter script for Bumble Automation Electron app
 */

const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron');

// Start the Electron app
const proc = spawn(electron, [path.join(__dirname, 'electron/main.js')], {
    stdio: 'inherit'
});

proc.on('close', (code) => {
    process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
    proc.kill('SIGINT');
});

process.on('SIGTERM', () => {
    proc.kill('SIGTERM');
}); 