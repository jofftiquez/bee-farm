# LLM Integration Guide

This document explains how to set up and use the Llama 3 integration for profile compatibility analysis in the Bee Farm - a Bumble Automation project.

## Overview

The integration uses Llama 3 to analyze dating profile compatibility with your preferences. It can provide more nuanced insights than the standard keyword-matching approach.

## Requirements

- Llama 3 model running in a locally hosted API server or accessible via API
- API endpoint that accepts JSON requests and returns text completions
- Node.js with axios package installed

## Setup

### 1. Install a Llama 3 API Server

You have multiple options:

#### Option A: Use Ollama (Recommended for easy setup)

1. Install [Ollama](https://ollama.ai/) for your OS
2. Pull the Llama 3 model:
   ```
   ollama pull llama3:latest
   ```
3. Start Ollama (it will run on port 11434 by default)

#### Option B: Use other LLM servers

You can use any API server that hosts Llama 3, such as:
- llama.cpp server
- LM Studio
- A cloud provider with Llama 3 access

### 2. Configure the Environment

By default, the system looks for the Llama API at `http://localhost:11434/api/generate`. 

To use a different endpoint, set the `LLAMA_ENDPOINT` environment variable:

```bash
# Linux/macOS
export LLAMA_ENDPOINT="http://your-llama-server:port/api/generate"

# Windows
set LLAMA_ENDPOINT=http://your-llama-server:port/api/generate
```

### 3. Enable LLM Analysis in User Preferences

Edit your `user_preferences.json` file to enable LLM analysis:

```json
{
  "personalDescription": "Your personal description...",
  "interests": ["interest1", "interest2", "..."],
  "llmSettings": {
    "enabled": true,
    "minComparisonScore": 0.6
  }
}
```

Parameters:
- `enabled`: Set to `true` to use Llama 3 analysis
- `minComparisonScore`: The minimum score (0.0-1.0) required for the LLM to consider a profile compatible

### 4. Testing the Llama Integration

You can use the included test script to verify that your Llama setup is working correctly:

```bash
node test-llama.js
```

This script will:
1. Check if the Llama API is accessible
2. Test the profile analysis with a sample profile
3. Display the compatibility score and analysis

If you see errors like "Request failed with status code 404", it typically means:
- The API server isn't running
- There's a mismatch between the model name in the code and what's available on your server

## How It Works

When enabled, the system will:

1. Extract profile information (bio, interests, etc.)
2. Send this information along with your preferences to the Llama 3 model
3. The model analyzes compatibility and returns a score (0.0-1.0) with explanation
4. This analysis can override the default keyword-matching approach if there's a significant difference

## Troubleshooting

### API Connection Issues

If you see errors like "Request failed with status code 404":

1. Check if your Llama server is running
2. Verify you have the correct model installed (should be `llama3:latest`)
3. Run the test script: `node test-llama.js`
4. Check the logs for specific error messages

You can manually test the API with:
```bash
curl -X POST http://localhost:11434/api/generate -d '{"model": "llama3:latest", "prompt": "Hello", "stream": false}'
```

### Poor Analysis Results

If the analysis seems poor or inconsistent:

1. Check your personal description and interests in user_preferences.json
2. You might need to use a larger Llama model if available
3. Try adjusting the minComparisonScore threshold

## Performance Considerations

The LLM analysis adds latency to each profile review. On standard hardware:
- Expect 1-3 seconds added per profile with Llama 3
- For faster processing, you might want to disable LLM analysis for bulk swiping sessions 