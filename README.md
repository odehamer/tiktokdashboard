# TikTok Live Dashboard

A real-time dashboard for monitoring TikTok live streams, displaying chat messages, gifts, likes, and followers.

## Features

- Real-time connection to TikTok live streams
- WebSocket-based updates to the browser
- Displays chat messages, gifts, likes, and new followers
- Simple web interface for entering TikTok usernames

## Running with Docker

### Prerequisites

- Docker installed on your system
- Node.js and npm installed (for building the image)

### Building the Docker Image

First, ensure dependencies are installed on your host system:

```bash
npm install
```

Then build the Docker image:

```bash
docker build -t tiktokdashboard .
```

### Running the Container

Run the container with:

```bash
docker run -d -p 3000:3000 tiktokdashboard
```

The application will be available at `http://localhost:3000`

### Environment Variables

- `PORT`: The port the server listens on (default: 3000)

Example with custom port:

```bash
docker run -d -p 8080:8080 -e PORT=8080 tiktokdashboard
```

## Running Without Docker

Install dependencies:

```bash
npm install
```

Start the server:

```bash
node server.js
```

The application will be available at `http://localhost:3000`

## Usage

1. Open the application in your web browser
2. Enter a TikTok username
3. Click "Go to Dashboard"
4. The dashboard will connect to the user's live stream and display real-time events

## License

MIT
