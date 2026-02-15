# 🔊 Audiobookshelf-Sonos

> **A fork of Audiobookshelf with native Sonos speaker support**

Stream your audiobooks and podcasts to any Sonos speaker in your home.

---

## 🚀 Quick Start

### 1. Install node-sonos-http-api

This bridge connects Audiobookshelf to your Sonos system:

```bash
git clone https://github.com/jishi/node-sonos-http-api.git
cd node-sonos-http-api
npm install
npm start
```

The API auto-discovers your Sonos speakers on port `5005`.

### 2. Configure in Settings

Navigate to **Settings** → **Sonos Integration**:

| Setting               | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| **Enable**            | Toggle Sonos output on/off                                          |
| **Sonos HTTP API URL**| URL of node-sonos-http-api (e.g., `http://192.168.1.100:5005`)      |
| **Server URL**        | Your Audiobookshelf URL that Sonos can reach (LAN IP, not localhost)|
| **Test Connection**   | Verifies API is reachable and discovers speakers                    |
| **Select Speakers**   | Check one or multiple speakers (multiple = grouped playback)        |

> ⚠️ **Server URL** must be your LAN IP (e.g., `http://192.168.1.50:13378`). Sonos speakers fetch audio directly from your server.

### 3. Play!

Click the **🔊 speaker icon** in the player bar → playback starts on your configured Sonos speaker(s).

---

## ⚙️ Advanced Timing Settings

Expand **Advanced Timing Configuration** if you have network issues:

| Setting                | Default | Purpose                                  |
| ---------------------- | ------- | ---------------------------------------- |
| Seek Initial Delay     | 500ms   | Wait before seeking after play starts    |
| Seek Retry Delay       | 300ms   | Delay between seek retry attempts        |
| Position Tolerance     | 3s      | Acceptable position difference           |
| Max Seek Attempts      | 3       | Retry count for seeking                  |
| Group Formation Delay  | 1000ms  | Wait for speakers to group               |
| Request Timeout        | 5000ms  | HTTP request timeout                     |
| Poll Interval          | 1000ms  | State polling frequency                  |

---

## 🔧 Troubleshooting

**No speakers appear?**
- Check node-sonos-http-api is running: `http://<api-ip>:5005/zones`
- Verify all devices on same network subnet

**No audio?**
- Server URL must be reachable from Sonos (use LAN IP)
- Check firewall allows port 13378

**Seeking doesn't work?**
- Increase Seek Initial Delay to 1000ms+

---

## 📝 About

Fork of [Audiobookshelf](https://github.com/advplyr/audiobookshelf) v2.32.1 with Sonos integration.

**Repository**: [github.com/Olioli4/audiobookshelf-Sonos](https://github.com/Olioli4/audiobookshelf-Sonos)

GPL-3.0 License
