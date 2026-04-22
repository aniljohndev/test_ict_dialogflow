require('dotenv').config();

const WebSocket = require('ws');
const http      = require('http');
const path      = require('path');
const fs        = require('fs');
const { detectIntent } = require('./dialogflow');

const PORT = process.env.PORT || 3000;

// Basic HTTP server to serve the frontend
const httpServer = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        const filePath = path.join(__dirname, 'public', 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`Client connected: ${clientIp}`);

    ws.on('message', async (rawData) => {
        try {
            const data = JSON.parse(rawData);

            // Only handle user_message type
            if (data.type !== 'user_message') return;

            const { message, sessionId } = data;

            if (!message || !sessionId) {
                ws.send(JSON.stringify({
                    type:    'error',
                    message: 'Invalid message format',
                }));
                return;
            }

            console.log(`[${sessionId}] User: ${message}`);

            // Send message to Dialogflow ES
            const dialogflowResponse = await detectIntent(sessionId, message);

            console.log(`[${sessionId}] Bot: ${dialogflowResponse.fulfillmentText}`);
            console.log(`[${sessionId}] Intent: ${dialogflowResponse.intent} (${(dialogflowResponse.confidence * 100).toFixed(0)}%)`);

            // Send Dialogflow response back to client via WebSocket
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type:       'bot_response',
                    message:    dialogflowResponse.fulfillmentText,
                    intent:     dialogflowResponse.intent,
                    confidence: dialogflowResponse.confidence,
                }));
            }

        } catch (err) {
            console.error('Error processing message:', err.message);

            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type:    'error',
                    message: 'Failed to process your message. Please try again.',
                }));
            }
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${clientIp}`);
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`WebSocket listening on ws://localhost:${PORT}`);
});
