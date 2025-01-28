const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Constants
const OLLAMA_URL = 'http://127.0.0.1:11434';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEEPSEEK_CHAT_MODEL = 'deepseek-r1:1.5b';
const CLAUDE_MODEL = 'anthropic/claude-3.5-sonnet';
const DEFAULT_PORT = 9000;

// Error classes for better error handling
class APIError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'APIError';
    }
}

// Utility functions
function validateRequest(req) {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new APIError('Invalid request: messages array is required', 400);
    }
    return req.body;
}

function getOpenRouterKey(req) {
    const key = req.headers.authorization?.replace('Bearer ', '');
    if (!key) {
        throw new APIError('Missing OpenRouter API key', 401);
    }
    return key;
}

// Main chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
    console.log('received request');
    try {
        const chatReq = validateRequest(req);
        const lastMessage = chatReq.messages[chatReq.messages.length - 1];
        const isToolMessage = lastMessage?.role === 'tool';
        
        // Skip Ollama for tool messages
        const thoughtContent = !isToolMessage 
            ? await processOllamaRequest(chatReq)
            : '';

        console.log('thoughtContent:', thoughtContent);

        console.log('contacting openrouter');
        await handleOpenRouterRequest(chatReq, thoughtContent, req, res);
    } catch (error) {
        handleError(error, res);
    }
});

async function processOllamaRequest(chatReq) {
    console.log('contacting deepseek');
    const ollamaReq = prepareOllamaRequest(chatReq);
    const response = await sendOllamaRequest(ollamaReq);
    return extractThoughtContent(response);
}

function prepareOllamaRequest(chatReq) {
    const { tools, ...cleanReq } = chatReq;
    
    return {
        ...{ ...cleanReq, messages: cleanReq.messages.map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content })) },
        model: DEEPSEEK_CHAT_MODEL,
        options: { stop: ["</think>"] }
    };
}

async function sendOllamaRequest(ollamaReq) {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ollamaReq)
    });

    if (!response.ok) {
        throw new APIError(`Ollama request failed: ${response.status}`, response.status);
    }

    return response;
}

async function extractThoughtContent(response) {
    const rawResponse = await response.text();
    const lines = rawResponse.split('\n').filter(Boolean);
    let accumulatedContent = '';
    
    for (const line of lines) {
        try {
            const { message, done } = JSON.parse(line);
            if (message?.content) {
                accumulatedContent += message.content;
            }
            if (done) break;
        } catch (error) {
            console.error('Error parsing Ollama response line:', error);
        }
    }

    const thinkMatch = accumulatedContent.match(/<think>(.*)/s);
    return thinkMatch ? `${thinkMatch[1].trim()}</think>` : '';
}

async function handleOpenRouterRequest(chatReq, thoughtContent, req, res) {
    const openrouterKey = getOpenRouterKey(req);
    const openrouterReq = prepareOpenRouterRequest(chatReq, thoughtContent);
    
    const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterKey}`,
            'HTTP-Referer': 'https://github.com/cursor-ai',
            'X-Title': 'Cursor AI'
        },
        body: JSON.stringify(openrouterReq)
    });

    if (!response.ok) {
        throw new APIError(`OpenRouter request failed: ${response.status}`, response.status);
    }

    chatReq.stream
        ? await handleStreamingResponse(response, res)
        : res.json(await response.json());
}

function prepareOpenRouterRequest(chatReq, thoughtContent) {
    return {
        ...chatReq,
        model: CLAUDE_MODEL,
        messages: [
            ...chatReq.messages,
            ...(thoughtContent ? [{
                role: "assistant",
                content: thoughtContent
            }] : [])
        ]
    };
}

async function handleStreamingResponse(response, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value));
        }
    } finally {
        clearInterval(heartbeat);
        res.end();
    }
}

function handleError(error, res) {
    console.error('Error:', error);
    const statusCode = error instanceof APIError ? error.statusCode : 500;
    res.status(statusCode).json({
        error: error.message || 'Internal server error'
    });
}

// Start server
const PORT = process.env.PORT || DEFAULT_PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Global error handling
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 
