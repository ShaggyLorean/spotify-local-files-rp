# Spotify Local Files - Discord Rich Presence

Spotify's Discord Rich Presence integration works great for catalog tracks — song name, artist, album art, and playback bar all show up perfectly. There's one problem: **local files don't show album art on Discord**, and often just display "Spotify" with the artist name and nothing else.

This tool fixes that by reading cover art directly from your local mp3/flac files and pushing it to Discord as a custom Rich Presence activity.

## How It Works

1. Polls the Spotify API for your currently playing track
2. When a local file is detected, finds the matching file on your disk
3. Matches files by embedded metadata first, then falls back to filename parsing
4. Uploads the cover to imgbb (cached after first upload)
5. Sets Discord Rich Presence with full track info: artist name, song title, album art, and playback bar

**For non-local (catalog) tracks, it does nothing** — Discord's built-in Spotify integration handles those.

Discord's native Spotify status is separate from this app's Rich Presence activity. If `Display Spotify as your status` is enabled in Discord, Discord may show both cards while local files are playing. This app cannot disable that setting for you; keeping it enabled preserves Spotify-native features like Listen Along.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A Spotify account
- A Discord account

### 1. Create a Spotify App

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create app"
3. Add `http://127.0.0.1:3000/callback` as the Redirect URI
4. Note down the Client ID and Client Secret

### 2. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" — **name it "Spotify"** (so Discord shows "Listening to Spotify")
3. Copy the **Application ID** from General Information
4. Go to Rich Presence > Art Assets and upload an image named **"spotify-icon"** (a Spotify logo or similar)

### 3. Get an imgbb API Key

1. Go to [imgbb.com/api](https://api.imgbb.com/) and sign up for a free API key

The app can run without an imgbb key, but cover art upload will be disabled.

### 4. Install

```bash
git clone https://github.com/ShaggyLorean/spotify-local-files-rp.git
cd spotify-local-files-rp
npm install
```

Copy `.env.example` to `.env` and fill in your credentials:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
DISCORD_APPLICATION_ID=your_discord_application_id
IMGBB_API_KEY=your_imgbb_api_key
MUSIC_DIRS=C:\Users\you\Music;D:\Albums
POLL_INTERVAL=5000
DETAILS_FORMAT={track}
STATE_FORMAT={artist} - {album}
ACTIVITY_NAME_FORMAT={artist}
SHOW_PLAYBACK_BAR=true
```

### 5. Run

```bash
npm start
```

Or just double-click `start.bat` on Windows.

On first run, a browser window will open for Spotify authorization. After that, it reconnects automatically.

## Auto-Start on Windows Boot

To have the app start silently in the background when you log in:

1. Double-click **`install-startup.bat`** — this adds a startup entry and sets `START_MINIMIZED=true` in your `.env`
2. The app will now launch silently on every Windows login

To remove:

- Double-click **`uninstall-startup.bat`**

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DETAILS_FORMAT` | `{track}` | Main line (song title) |
| `STATE_FORMAT` | `{album}` | Second line |
| `ACTIVITY_NAME_FORMAT` | `{artist}` | The "Listening to ..." part |
| `SHOW_PLAYBACK_BAR` | `true` | Show the playback progress bar |
| `POLL_INTERVAL` | `5000` | How often to check Spotify (ms) |
| `START_MINIMIZED` | `false` | Run without a visible console window |
| `SPOTIFY_REDIRECT_URI` | `http://127.0.0.1:3000/callback` | OAuth callback URL; the app listens on this URL's port and path |

Available placeholders: `{track}`, `{artist}`, `{album}`

Example:
```env
ACTIVITY_NAME_FORMAT={artist}
DETAILS_FORMAT={track}
STATE_FORMAT={album}
```

## What It Looks Like

```
Listening to Playboi Carti
  Skeleton
  Whole Lotta Red V1
  [████████░░░░░░░░] 1:42 / 3:03
  🖼️ Album cover art
```

## Notes

- Cover art is uploaded once per unchanged image and cached in `.cover-cache.json`; if the embedded cover changes, it uploads a fresh image
- The app keeps forcing the custom local-file activity every poll so Discord's native Spotify card is less likely to visually win while local files are playing
- You can keep Discord's Spotify connection enabled for Listen Along and native Spotify behavior, but Discord can still show the native Spotify card alongside this custom local-file card
- Switching from a local file to a catalog track automatically hands back to Discord's native Spotify RP
- Spotify API rate limits and transient 5xx errors are retried with backoff

## Tech Stack

- TypeScript
- discord-rpc (IPC transport)
- Spotify Web API
- music-metadata
- imgbb API

## License

MIT
