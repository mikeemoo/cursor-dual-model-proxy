# Cursor Dual Model Proxy

This project implements a dual-model proxy system for Cursor AI that combines the strengths of two different language models:
1. A local Ollama model (Deepseek) for initial thought processing
2. Claude (via OpenRouter) for final response generation

## Overview

The proxy acts as a middleware that:
1. Receives requests from Cursor
2. Processes them through a local Ollama instance running Deepseek for initial thoughts
3. Forwards the enhanced prompt to Claude via OpenRouter for final response generation
4. Streams the response back to Cursor

## Setup Requirements

### 1. OpenRouter Setup
- Create an account at [OpenRouter](https://openrouter.ai/)
- Get your API key from the dashboard

### 2. Cursor Setup
- Open Cursor Settings
- Go to Model Settings
- Set your OpenAI API key to your OpenRouter API key
- Enter the URL of your proxy server (note: https, and not localhost. ngrok recommended)
- Select `gpt-4o` as your model

### 3. Local Setup
1. Install Node.js and npm
2. Install [Ollama](https://ollama.ai/)
3. Pull the Deepseek model:
   ```bash
   ollama pull deepseek-r1:1.5b
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the server:
   ```bash
   node src/index.js
   ```

The server will run on port 9000 by default.

## How It Works

1. When you make a request in Cursor, it's sent to this proxy server
2. The proxy first processes your request through the local Deepseek model to generate initial thoughts
3. These thoughts are then combined with your original request and sent to Claude via OpenRouter
4. Claude's response is streamed back through the proxy to Cursor

## Environment Variables

- `PORT`: Server port (default: 9000)
- The OpenRouter API key is passed through the Authorization header from Cursor

## Important Notes

- Ensure Ollama is running locally before starting the proxy
- The proxy must be running for Cursor to work with this setup
- All API keys should be kept secure and never committed to version control

## Troubleshooting

If you encounter issues:
1. Ensure Ollama is running (`ollama serve`)
2. Verify your OpenRouter API key is correctly set in Cursor
3. Check that the proxy server is running
4. Ensure port 9000 is available (or configure a different port)

## Contributing

Feel free to open issues or submit pull requests for improvements.

## License

MIT 
