# 🔊 Audiobookshelf-Sonos

> **A fork of Audiobookshelf with native Sonos speaker support**

Stream your audiobooks and podcasts to any Sonos speaker in your home.

---

## 🚀 Installation

### Option A: Docker (Recommended)

The docker-compose includes both Audiobookshelf and the Sonos HTTP API:

```bash
git clone https://github.com/Olioli4/audiobookshelf-Sonos.git
cd audiobookshelf-Sonos

# Edit docker-compose.yml to set your media paths
docker-compose up -d
```

Both services start automatically. The Sonos API runs on port `5005` and auto-discovers your speakers.

### Option B: Manual Installation

If running without Docker, you need to install node-sonos-http-api separately:

```bash
# 1. Install Sonos HTTP API
git clone https://github.com/jishi/node-sonos-http-api.git
cd node-sonos-http-api
npm install
npm start  # Runs on port 5005

# 2. Install Audiobookshelf-Sonos (in another terminal)
git clone https://github.com/Olioli4/audiobookshelf-Sonos.git
cd audiobookshelf-Sonos
npm install
npm run client  # Build frontend
npm start
```

---

## ⚙️ Configuration

Navigate to **Settings** → **Sonos Integration**:

| Setting               | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| **Enable**            | Toggle Sonos output on/off                                          |
| **Sonos HTTP API URL**| URL of the API (`http://localhost:5005` for Docker)                 |
| **Server URL**        | Your Audiobookshelf URL that Sonos can reach (LAN IP, not localhost)|
| **Test Connection**   | Verifies API is reachable and discovers speakers                    |
| **Select Speakers**   | Check one or multiple speakers (multiple = grouped playback)        |

> ⚠️ **Server URL** must be your LAN IP (e.g., `http://192.168.1.50:13378`). Sonos speakers fetch audio directly from your server.

---

## ▶️ Usage

Click the **🔊 speaker icon** in the player bar → playback starts on your configured Sonos speaker(s).

---

## 🔧 Advanced Timing Settings

Expand **Advanced Timing Configuration** in settings if you have network issues:

| Setting                | Default | Purpose                                  |
| ---------------------- | ------- | ---------------------------------------- |
| Seek Initial Delay     | 500ms   | Wait before seeking after play starts    |
| Seek Retry Delay       | 300ms   | Delay between seek retry attempts        |
| Position Tolerance     | 3s      | Acceptable position difference           |
| Max Seek Attempts      | 3       | Retry count for seeking                  |
| Group Formation Delay  | 1000ms  | Wait for speakers to group               |

---

## 🐛 Troubleshooting

**No speakers appear?**
- Check node-sonos-http-api is running: `http://<api-ip>:5005/zones`
- Verify all devices on same network subnet

**No audio?**
- Server URL must be reachable from Sonos (use LAN IP)
- Check firewall allows port 13378

---

## 📝 About

Fork of [Audiobookshelf](https://github.com/advplyr/audiobookshelf) v2.32.1 with Sonos integration.

GPL-3.0 License
