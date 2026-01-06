import express from 'express';
import { createServer } from 'http';
import { readFile } from 'node:fs/promises';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Map of TikTok username -> { connection, clients: Set<WebSocket> }
const tiktokConnections = new Map();

app.use(express.json());
app.use(express.static('.'));

app.get('/', async (req, res) => {
    res.send(await readFile('./index.html', 'utf8'));
});

app.get('/dashboard', async (req, res) => {
    res.send(await readFile('./dashboard.html', 'utf8'));
});

// WebSocket connection handler
wss.on('connection', function connection(ws, req) {
    console.log('Browser connected');

    // Extract username from query parameter
    const url = new URL(req.url, `http://${req.headers.host}`);
    const tiktokUsername = url.searchParams.get('username');

    if (tiktokUsername) {
        console.log(`Connecting to TikTok user: ${tiktokUsername}`);

        // Store the username on the WebSocket for later reference
        ws.tiktokUsername = tiktokUsername;

        // Check if we already have a connection for this user
        if (tiktokConnections.has(tiktokUsername)) {
            // Add this client to the existing connection's client set
            const connectionInfo = tiktokConnections.get(tiktokUsername);
            connectionInfo.clients.add(ws);

            // Send status to just this client
            if (connectionInfo.connection.isConnected) {
                ws.send(
                    JSON.stringify({
                        type: 'status',
                        message: `Connected to @${tiktokUsername}`,
                    })
                );
            }
        } else {
            // Create new connection for this user
            connectToTikTok(tiktokUsername, ws);
        }
    } else {
        ws.send(
            JSON.stringify({ type: 'error', message: 'No username provided' })
        );
    }

    ws.on('close', () => {
        console.log('Browser disconnected');

        // Remove this client from the TikTok connection
        if (ws.tiktokUsername && tiktokConnections.has(ws.tiktokUsername)) {
            const connectionInfo = tiktokConnections.get(ws.tiktokUsername);
            connectionInfo.clients.delete(ws);

            // If no more clients watching this user, disconnect from TikTok
            if (connectionInfo.clients.size === 0) {
                console.log(
                    `No more clients for @${ws.tiktokUsername}, disconnecting from TikTok`
                );
                if (connectionInfo.connection.isConnected) {
                    connectionInfo.connection.disconnect();
                }
                tiktokConnections.delete(ws.tiktokUsername);
            }
        }
    });
});

// Function to broadcast to all clients watching a specific TikTok user
function broadcastToUser(tiktokUsername, data) {
    const connectionInfo = tiktokConnections.get(tiktokUsername);
    if (connectionInfo) {
        connectionInfo.clients.forEach((client) => {
            // 1 = OPEN
            if (client.readyState === 1) {
                client.send(JSON.stringify(data));
            }
        });
    }
}

// TikTok Live Connection

function connectToTikTok(tiktokUsername, initialClient) {
    const tiktokConnection = new TikTokLiveConnection(tiktokUsername);

    // Store connection info with initial client
    const connectionInfo = {
        connection: tiktokConnection,
        clients: new Set([initialClient]),
    };
    tiktokConnections.set(tiktokUsername, connectionInfo);

    tiktokConnection
        .connect()
        .then((state) => {
            console.info(
                `Connected to TikTok @${tiktokUsername} roomId ${state.roomId}`
            );
            broadcastToUser(tiktokUsername, {
                type: 'status',
                message: `Connected to @${tiktokUsername}`,
            });
        })
        .catch((err) => {
            console.error(
                `Failed to connect to TikTok @${tiktokUsername}:`,
                err
            );
            broadcastToUser(tiktokUsername, {
                type: 'error',
                message: 'Failed to connect to TikTok live',
            });
            // Clean up failed connection
            tiktokConnections.delete(tiktokUsername);
        });

    // Chat messages
    tiktokConnection.on(WebcastEvent.CHAT, (data) => {
        const message = {
            type: 'chat',
            user: data.user.uniqueId,
            name: data.user.nickname,
            avatar: data.user.profilePictureUrl,
            comment: data.comment,
            timestamp: new Date().toLocaleTimeString(),
        };
        console.log(
            `[@${tiktokUsername}] [CHAT] ${data.user.uniqueId}: ${data.comment}`
        );
        broadcastToUser(tiktokUsername, message);
    });

    // Gifts
    tiktokConnection.on(WebcastEvent.GIFT, data => {

        // Only process when the gift combo/repeat has ended
        if (data.repeatEnd === 0) return;
        
        const gift = {
            type: 'gift',
            user: data.user.uniqueId,
            name: data.user.nickname,
            giftName: data.giftDetails.giftName,
            count: data.repeatCount,
            timestamp: new Date().toLocaleTimeString(),
        };
        console.log(
            `[@${tiktokUsername}] [GIFT] ${data.user.uniqueId} sent ${data.giftName}`
        );
        broadcastToUser(tiktokUsername, gift);
    });

    // Likes
    tiktokConnection.on(WebcastEvent.LIKE, (data) => {
        broadcastToUser(tiktokUsername, {
            type: 'like',
            user: data.user.uniqueId,
            name: data.user.nickname,
            likeCount: data.likeCount,
            timestamp: new Date().toLocaleTimeString(),
        });
    });

    // Follows
    tiktokConnection.on(WebcastEvent.FOLLOW, data => {
        const follow = {
            type: 'follow',
            user: data.user.uniqueId,
            name: data.user.nickname,
            timestamp: new Date().toLocaleTimeString()
        };
        console.log(
            `[@${tiktokUsername}] [FOLLOW] ${data.user.uniqueId} followed`
        );
        broadcastToUser(tiktokUsername, follow);
    });

    // Viewer Count Updates
    tiktokConnection.on(WebcastEvent.ROOM_USER, data => {
        broadcastToUser(tiktokUsername, {
            type: 'viewerCount',
            viewerCount: data.viewerCount
        });
    });
    
    // Disconnection
    tiktokConnection.on(WebcastEvent.DISCONNECT, () => {
        console.log(`Disconnected from TikTok @${tiktokUsername}`);
        broadcastToUser(tiktokUsername, {
            type: 'status',
            message: 'Disconnected from TikTok',
        });
        tiktokConnections.delete(tiktokUsername);
    });
}

// Start connections
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
