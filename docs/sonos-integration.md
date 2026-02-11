# Sonos Integration

Audiobookshelf supports streaming audiobooks and podcasts to Sonos speakers via the [node-sonos-http-api](https://github.com/jishi/node-sonos-http-api).

## Prerequisites

1. **node-sonos-http-api** must be running on your network (default port: 5005)
2. Sonos speakers must be discoverable on the same network

## Configuration

Navigate to **Settings** → **Sonos** tab to configure:

| Setting | Description | Example |
|---------|-------------|---------|
| **Sonos API URL** | URL of your sonos-http-api instance | `http://192.168.1.100:5005` |
| **Server URL** | Your Audiobookshelf server URL accessible from Sonos | `http://192.168.1.50:13378` |
| **Default Room** | Room to use when auto-playing | `Living Room` |
| **Auto Group** | Automatically group all speakers when playing | checkbox |

### Important: Server URL

The **Server URL** must be the LAN IP address of your Audiobookshelf server, not `localhost`. Sonos speakers need to reach your server to stream audio.

## Usage

### Playing on Sonos

1. Open any audiobook or podcast in the player
2. Click the **speaker icon** in the player controls
3. Select a Sonos room from the dropdown (or it auto-plays on your saved/default room)
4. Playback begins on the selected Sonos speaker

### Player Controls in Sonos Mode

When streaming to Sonos, the player controls behave differently:

| Control | Behavior |
|---------|----------|
| **Play/Pause** | Controls Sonos playback |
| **Seek** | Seeks on the Sonos speaker |
| **Volume** | Adjusts Sonos speaker volume |
| **Skip** | Skips chapters (if available) |

### Resume Position

When switching to Sonos, playback resumes from your current position. The server seeks to the correct timestamp after initiating playback.

## API Endpoints

The Sonos integration exposes the following REST API endpoints:

### Rooms

```
GET /api/sonos/rooms
```
Returns list of available Sonos rooms/zones.

**Response:**
```json
{
  "rooms": ["Living Room", "Kitchen", "Bedroom"]
}
```

### Room State

```
GET /api/sonos/room/:roomName
```
Returns current playback state for a room.

**Response:**
```json
{
  "roomName": "Living Room",
  "state": "playing",
  "volume": 45,
  "muted": false,
  "currentTrack": {
    "title": "Chapter 1",
    "artist": "Author Name"
  }
}
```

### Play Item

```
POST /api/sonos/room/:roomName/play-item
Content-Type: application/json

{
  "libraryItemId": "li_xxxxx",
  "episodeId": "ep_xxxxx",  // optional, for podcasts
  "startTime": 3600         // optional, seek position in seconds
}
```
Starts playback of a library item on the specified room.

### Playback Controls

```
POST /api/sonos/room/:roomName/play
POST /api/sonos/room/:roomName/pause
POST /api/sonos/room/:roomName/stop
```

### Seek

```
POST /api/sonos/room/:roomName/seek
Content-Type: application/json

{
  "position": 3600  // seconds
}
```

### Volume

```
POST /api/sonos/room/:roomName/volume
Content-Type: application/json

{
  "volume": 50  // 0-100
}
```

```
POST /api/sonos/room/:roomName/mute
POST /api/sonos/room/:roomName/unmute
```

### Grouping

```
POST /api/sonos/room/:roomName/group-all
```
Groups all speakers with the specified room as coordinator.

```
POST /api/sonos/room/:roomName/ungroup
```
Removes room from its current group.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Audiobookshelf │────▶│ node-sonos-http- │────▶│  Sonos Speaker  │
│     Client      │     │       api        │     │                 │
└────────┬────────┘     └──────────────────┘     └────────▲────────┘
         │                                                │
         │                                                │
         ▼                                                │
┌─────────────────┐                                       │
│  Audiobookshelf │───────────────────────────────────────┘
│     Server      │        (audio stream)
└─────────────────┘
```

1. Client sends play command to Audiobookshelf server
2. Server creates a playback session and generates stream URL
3. Server sends stream URL to node-sonos-http-api
4. Sonos speaker fetches audio directly from Audiobookshelf server

## Troubleshooting

### Sonos rooms not appearing

- Verify node-sonos-http-api is running: `http://your-api-ip:5005/zones`
- Check that the Sonos API URL is correctly configured
- Ensure all devices are on the same network/subnet

### Playback fails with "check sonosServerUrl"

- The Server URL must be reachable from your Sonos speakers
- Use your server's LAN IP, not `localhost` or `127.0.0.1`
- Check firewall rules allow connections on your server port

### Audio stutters or stops

- Ensure stable network connection between server and Sonos
- Check server resources (CPU, memory)
- Try reducing the number of grouped speakers

### Position doesn't sync

- Seek commands require a small delay after playback starts
- If resuming doesn't work, try pausing and seeking manually

## Implementation Files

| File | Description |
|------|-------------|
| `server/routers/SonosRouter.js` | REST API endpoints |
| `server/libs/sonos/SonosIntegration.js` | Sonos HTTP API client |
| `server/libs/sonos/BaseStreamTarget.js` | Abstract base class for streaming targets |
| `client/components/player/PlayerSonosControl.vue` | Sonos player controls |
| `server/objects/settings/ServerSettings.js` | Sonos configuration settings |
