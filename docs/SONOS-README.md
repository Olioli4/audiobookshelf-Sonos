# 🔊 Audiobookshelf-Sonos

> **A fork of Audiobookshelf with native Sonos speaker support**

Stream your audiobooks and podcasts to any Sonos speaker in your home while keeping perfect sync with your reading progress.

---

## ✨ What Can You Do?

| Feature                      | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| 🎧 **One-Click Playback**    | Tap the speaker icon and your audiobook starts playing on Sonos |
| 🏠 **Multi-Room Audio**      | Group multiple speakers for whole-home listening                |
| ⏱️ **Perfect Position Sync** | Resume exactly where you left off, on any device                |
| 🔄 **Seamless Switching**    | Move between browser, phone, and Sonos mid-chapter              |
| 📊 **Progress Tracking**     | All listening time counts toward your statistics                |

---

## 🚀 Quick Start

### 1. Install node-sonos-http-api

This bridge connects Audiobookshelf to your Sonos system:

```bash
# Clone and run
git clone https://github.com/jishi/node-sonos-http-api.git
cd node-sonos-http-api
npm install
npm start
```

The API will auto-discover your Sonos speakers on port `5005`.

### 2. Configure Audiobookshelf

Navigate to **Settings** → scroll to **Sonos Integration**:

1. **Enable** Sonos speaker output
2. Enter your **Sonos API URL**: `http://<sonos-api-ip>:5005`
3. Enter your **Server URL**: `http://<audiobookshelf-ip>:13378`
4. Click **Test Connection** ✓

> ⚠️ **Important**: Use your server's LAN IP address, not `localhost`. Sonos speakers need to reach your server directly.

### 3. Play!

1. Open any audiobook or podcast
2. Click the **🔊 speaker icon** in the player bar
3. Select your Sonos room
4. Enjoy!

---

## 🎛️ Player Controls

When streaming to Sonos, all controls work as expected:

| Control           | Action                                       |
| ----------------- | -------------------------------------------- |
| ▶️ **Play/Pause** | Start or pause Sonos playback                |
| ⏪ ⏩ **Skip**    | Jump between chapters                        |
| 🔊 **Volume**     | Adjust Sonos speaker volume (slider appears) |
| ⏱️ **Seek**       | Jump to any position in the track            |
| 🔄 **Speed**      | Playback speed (1x, 1.5x, 2x)                |

The player bar shows a **green speaker icon** when actively streaming to Sonos.

---

## 🏠 Multi-Room & Grouping

### Single Room

Select one room from the list — audio plays on that speaker only.

### Grouped Speakers

In **Settings → Sonos**, check multiple speakers to create a group:

- All selected speakers play in sync
- The first speaker becomes the "coordinator"
- Volume is controlled per-speaker or all together

### Existing Groups

If your speakers are already grouped in the Sonos app, Audiobookshelf respects that grouping. Select the group coordinator to play on all grouped speakers.

---

## ⚙️ Advanced Settings

For fine-tuning playback behavior, expand **Advanced Timing Configuration** in settings:

| Setting                | Default | Purpose                                  |
| ---------------------- | ------- | ---------------------------------------- |
| Seek Initial Delay     | 500ms   | Wait before seeking after play starts    |
| Seek Retry Delay       | 300ms   | Delay between seek retry attempts        |
| Position Tolerance     | 3s      | Acceptable difference in resume position |
| Max Seek Attempts      | 3       | How many times to retry seeking          |
| Post-Seek Resume Delay | 200ms   | Wait after seek before resuming          |
| Group Formation Delay  | 1000ms  | Wait for speakers to group               |

> 💡 **Tip**: If seeking doesn't work reliably on your network, try increasing the delays.

---

## 🔧 Troubleshooting

### No Sonos rooms appear

- Verify node-sonos-http-api is running: visit `http://<api-ip>:5005/zones`
- Check the Sonos API URL in settings
- Ensure all devices are on the same network subnet

### "Check sonosServerUrl" error

- Your **Server URL** must be reachable from Sonos speakers
- Use your LAN IP (e.g., `192.168.1.50`), not `localhost`
- Check firewall allows connections on port 13378

### Playback starts but no audio

- Verify the Server URL is correct and accessible
- Try: `curl http://<your-server>:13378/api/ping` from another device

### Position doesn't resume correctly

- Increase **Seek Initial Delay** to 1000ms
- This gives Sonos time to buffer before seeking

---

## 🛠️ For Developers

### Architecture

```
┌─────────────────────┐
│   Browser Client    │
│  (Vue.js Frontend)  │
└──────────┬──────────┘
           │ WebSocket + REST
           ▼
┌─────────────────────┐         ┌─────────────────────┐
│   Audiobookshelf    │────────▶│  node-sonos-http-   │
│       Server        │  REST   │        api          │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │ HTTP Stream                   │ UPnP/SOAP
           ▼                               ▼
    ┌─────────────────────────────────────────┐
    │            Sonos Speaker(s)             │
    │  ← fetches audio directly from server   │
    └─────────────────────────────────────────┘
```

### Prerequisites

| Requirement         | Version       | Notes                          |
| ------------------- | ------------- | ------------------------------ |
| Node.js             | 18+           | For Audiobookshelf server      |
| node-sonos-http-api | Latest        | Sonos bridge (runs separately) |
| Sonos speakers      | S2 compatible | Must be on same network        |

### REST API Endpoints

All endpoints are prefixed with `/api/sonos/`.

#### Discovery

```http
GET /api/sonos/rooms
```

Returns available Sonos rooms/zones.

```json
{
  "rooms": [
    { "name": "Living Room", "volume": 45, "state": "STOPPED" },
    { "name": "Kitchen", "volume": 30, "state": "PLAYING" }
  ]
}
```

#### Playback Control

```http
POST /api/sonos/room/:roomName/play-item
Content-Type: application/json

{
  "libraryItemId": "li_abc123",
  "episodeId": "ep_xyz789",     // optional, for podcasts
  "startTime": 3600             // optional, seconds
}
```

```http
POST /api/sonos/room/:roomName/play
POST /api/sonos/room/:roomName/pause
POST /api/sonos/room/:roomName/stop
```

#### Seek & Volume

```http
POST /api/sonos/room/:roomName/seek
{ "position": 3600 }

POST /api/sonos/room/:roomName/volume
{ "volume": 50 }

POST /api/sonos/room/:roomName/mute
POST /api/sonos/room/:roomName/unmute
```

#### Grouping

```http
POST /api/sonos/room/:roomName/group-all
POST /api/sonos/room/:roomName/ungroup
```

### Key Source Files

| File                                              | Purpose                       |
| ------------------------------------------------- | ----------------------------- |
| `server/routers/SonosRouter.js`                   | REST API endpoint definitions |
| `server/integrations/SonosIntegration.js`         | Sonos HTTP API client wrapper |
| `client/components/player/PlayerSonosControl.vue` | Player UI component           |
| `client/components/app/SonosSettingsCard.vue`     | Settings panel                |
| `server/objects/settings/ServerSettings.js`       | Configuration storage         |

### Configuration Options (ServerSettings)

```javascript
{
  sonosEnabled: true,
  sonosApiUrl: 'http://192.168.1.100:5005',
  sonosServerUrl: 'http://192.168.1.50:13378',
  sonosDefaultRoom: 'Living Room',
  sonosSelectedSpeakers: ['Living Room', 'Kitchen'],

  // Timing (milliseconds)
  sonosSeekInitialDelayMs: 500,
  sonosSeekRetryDelayMs: 300,
  sonosPositionToleranceSeconds: 3,
  sonosMaxSeekAttempts: 3,
  sonosPostSeekResumeDelayMs: 200,
  sonosGroupFormationDelayMs: 1000
}
```

---

## � Modified Files from Original Audiobookshelf

This section documents all files added or modified compared to the upstream Audiobookshelf project.

### 🆕 New Files (Sonos-Specific)

| File                                              | Purpose                                   |
| ------------------------------------------------- | ----------------------------------------- |
| `server/routers/SonosRouter.js`                   | REST API endpoints for Sonos control      |
| `server/integrations/SonosIntegration.js`         | Client wrapper for node-sonos-http-api    |
| `server/integrations/BaseStreamTarget.js`         | Abstract base class for streaming targets |
| `server/integrations/index.js`                    | Integration module exports                |
| `client/components/player/PlayerSonosControl.vue` | Player bar Sonos toggle & room selector   |
| `client/components/app/SonosSettingsCard.vue`     | Settings page Sonos configuration panel   |
| `docs/sonos-integration.md`                       | Technical integration documentation       |
| `docs/SONOS-README.md`                            | This file                                 |
| `sonos-http-api/`                                 | Bundled node-sonos-http-api (submodule)   |

### ✏️ Modified Server Files

| File                                          | Change                                               |
| --------------------------------------------- | ---------------------------------------------------- |
| `server/Server.js`                            | Register SonosRouter                                 |
| `server/routers/ApiRouter.js`                 | Mount `/api/sonos` routes                            |
| `server/objects/settings/ServerSettings.js`   | Add Sonos config properties (URLs, timing, speakers) |
| `server/managers/PlaybackSessionManager.js`   | Support Sonos as playback target                     |
| `server/controllers/SessionController.js`     | Handle Sonos session data                            |
| `server/controllers/LibraryItemController.js` | Stream URL generation for Sonos                      |
| `server/models/User.js`                       | Store user's Sonos preferences                       |

### ✏️ Modified Client Files

| File                                             | Change                                 |
| ------------------------------------------------ | -------------------------------------- |
| `client/layouts/default.vue`                     | Include SonosSettingsCard              |
| `client/pages/config/index.vue`                  | Add Sonos settings section             |
| `client/components/player/PlayerUi.vue`          | Integrate PlayerSonosControl component |
| `client/components/app/MediaPlayerContainer.vue` | Pass Sonos state to player             |
| `client/players/PlayerHandler.js`                | Route playback commands to Sonos       |
| `client/players/AudioTrack.js`                   | Sonos playback awareness               |
| `client/store/index.js`                          | Sonos state management (Vuex)          |
| `client/strings/en-us.json`                      | Sonos-related UI strings               |
| `client/pages/item/_id/index.vue`                | Sonos play button integration          |

### ⚙️ Config & Build Files

| File                 | Change                         |
| -------------------- | ------------------------------ |
| `package.json`       | Version bump, scripts          |
| `docker-compose.yml` | Include sonos-http-api service |
| `.gitignore`         | Ignore build artifacts         |
| `.gitattributes`     | Line ending rules              |

### 📝 Unrelated Changes (Also in Fork)

These files contain changes unrelated to Sonos (podcast improvements, bug fixes):

| File                                                             | Change                                |
| ---------------------------------------------------------------- | ------------------------------------- |
| `server/managers/PodcastManager.js`                              | Podcast episode handling improvements |
| `server/scanner/PodcastScanner.js`                               | Scanner enhancements                  |
| `server/models/PodcastEpisode.js`                                | Episode model updates                 |
| `server/models/Podcast.js`                                       | Podcast model updates                 |
| `server/models/FeedEpisode.js`                                   | Feed episode handling                 |
| `server/controllers/PodcastController.js`                        | Podcast API improvements              |
| `server/migrations/v2.27.0-podcast-episode-audio-source-type.js` | Database migration                    |
| `client/components/modals/podcast/EpisodeFeed.vue`               | Episode feed UI                       |
| `client/components/tables/podcast/*`                             | Podcast table components              |

---

## �📝 About This Fork

This is a fork of Audiobookshelf that adds Sonos speaker integration. The Sonos features are developed and maintained independently.

**Fork Repository**: [github.com/Olioli4/audiobookshelf-Sonos](https://github.com/Olioli4/audiobookshelf-Sonos)

Licensed under GPL-3.0.

---

<p align="center">
  <b>Made with ❤️ for audiobook lovers who want great sound</b>
</p>
