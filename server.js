import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { type } from 'node:os';

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

let tiktokConnection = null;

app.use(express.json());

app.get('/', async (req, res) => {
    res.send(await readFile('./index.html', 'utf8'));
});

app.get('/dashboard', async (req, res) => {
    res.send(await readFile('./dashboard.html', 'utf8'));
});

let tiktokUsername = '';

app.post('/dashboard', async (req, res) => {
    console.log(req.body.username);
    tiktokUsername = req.body.username;

    if (tiktokConnection && tiktokConnection.isConnected) {
        tiktokConnection.disconnect();
    }
    
    connectToTikTok();s
    res.redirect('/dashboard');
});

// WebSocket connection handler
wss.on('connection', function connection(ws) {
    console.log('Browser connected');
    
    // Send connection status
    if (tiktokConnection && tiktokConnection.isConnected) {
        ws.send(JSON.stringify({ type: 'status', message: 'Connected to TikTok live' }));
    }
    
    ws.on('close', () => {
        console.log('Browser disconnected');
    });
});

// Function to broadcast to all connected browsers
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(JSON.stringify(data));
        }
    });
}

// TikTok Live Connection

function connectToTikTok() {
    tiktokConnection = new TikTokLiveConnection(tiktokUsername);
    
    tiktokConnection.connect().then(state => {
        console.info(`Connected to TikTok roomId ${state.roomId}`);
        broadcast({ type: 'status', message: `Connected to @${tiktokUsername}` });
    }).catch(err => {
        console.error('Failed to connect to TikTok:', err);
        broadcast({ type: 'error', message: 'Failed to connect to TikTok live' });
    });
    
    // Chat messages
    tiktokConnection.on(WebcastEvent.CHAT, data => {
        const message = {
            type: 'chat',
            user: data.user.uniqueId,
            avatar: data.user.profilePictureUrl,
            comment: data.comment,
            timestamp: new Date().toLocaleTimeString()
        };
        console.log(`[CHAT] ${data.user.uniqueId}: ${data.comment}`);
        broadcast(message);
    });
    
    // Gifts
    tiktokConnection.on(WebcastEvent.GIFT, data => {
        const gift = {
            type: 'gift',
            user: data.user.uniqueId,
            gift: data.giftName,
            count: data.repeatCount,
            timestamp: new Date().toLocaleTimeString()
        };
        console.log(`[GIFT] ${data.user.uniqueId} sent ${data.giftName}`);
        broadcast(gift);
    });
    
    // Likes
    tiktokConnection.on(WebcastEvent.LIKE, data => {
        broadcast({
            type: 'like',
            user: data.user.uniqueId,
            likeCount: data.likeCount,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    tiktokConnection.on(WebcastEvent.FOLLOW, data => {
        const follow = {
            type: 'follow',
            user: data.user.uniqueId,
            timestamp: new Date().toLocaleTimeString()
        };
        console.log(`[FOLLOW] ${data.user.uniqueId} followed`);
        broadcast(follow);
    });
    
    // Disconnection
    tiktokConnection.on(WebcastEvent.DISCONNECT, () => {
        console.log('Disconnected from TikTok');
        broadcast({ type: 'status', message: 'Disconnected from TikTok' });
    });
}

// Start connections
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    connectToTikTok();
});