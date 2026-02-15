# 🔊 Audiobookshelf-Sonos

> **A fork of Audiobookshelf with native Sonos speaker support**

Stream your audiobooks and podcasts to any Sonos speaker in your home while syncing your reading progress.

---

## ✨ What Can You Do?

| Feature                   | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| 🎧 **One-Click Playback** | Tap the speaker icon and your audiobook starts playing on Sonos |
| 🏠 **Multi-Room Audio**   | Group multiple speakers for whole-home listening                |
| ⏱️ **Position Sync**      | Resume where you left off when switching to Sonos               |

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

### Key Source Files

| File                                              | Purpose                       |
| ------------------------------------------------- | ----------------------------- |
| `server/routers/SonosRouter.js`                   | REST API endpoint definitions |
| `server/integrations/SonosIntegration.js`         | Sonos HTTP API client wrapper |
| `client/components/player/PlayerSonosControl.vue` | Player UI component           |
| `client/components/app/SonosSettingsCard.vue`     | Settings panel                |

See [docs/sonos-integration.md](docs/sonos-integration.md) for full API documentation.

---

## 📝 About This Fork

This is a fork of [Audiobookshelf](https://github.com/advplyr/audiobookshelf) v2.32.1 that adds Sonos speaker integration.

**Fork Repository**: [github.com/Olioli4/audiobookshelf-Sonos](https://github.com/Olioli4/audiobookshelf-Sonos)

Licensed under GPL-3.0.

---

<p align="center">
  <b>Made with ❤️ for audiobook lovers who want great sound</b>
</p>
