# Spotify Local Files - Discord Rich Presence

Spotify'ın Discord Rich Presence entegrasyonu normalde mükemmel çalışır — şarkı adı, sanatçı, albüm kapağı, zaman çubuğu hepsi görünür. Tek bir sorun var: **local files ile eklenen müziklerde albüm kapağı gösterilmez** ve çoğu zaman sadece "Spotify" yazar.

Bu araç, Spotify local files çaldığınızda Discord profilinizde albüm kapağını ve tüm track bilgilerini gösterir.

## Nasıl Çalışıyor

1. Spotify API üzerinden o an çalan şarkıyı dinler
2. Local file algılandığında, diskinizdeki mp3/flac dosyasını bulur
3. Dosyanın embedded cover art'ını okur (`music-metadata`)
4. Cover art'ı imgbb'ye upload eder ve cache'ler
5. Discord RPC üzerinden "Listening to [sanatçı]" formatında günceller

**Normal (Spotify kataloğu) müziklerde hiçbir şey yapmaz** — Discord'un kendi Spotify entegrasyonu çalışmaya devam eder.

## Kurulum

### Gereksinimler

- [Node.js](https://nodejs.org/) 18+
- Spotify hesabı
- Discord hesabı

### 1. Spotify App Oluştur

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)'a git
2. "Create app" tıkla
3. Redirect URI olarak `http://127.0.0.1:3000/callback` ekle
4. Client ID ve Client Secret'ı not al

### 2. Discord Application Oluştur

1. [Discord Developer Portal](https://discord.com/developers/applications)'a git
2. "New Application" tıkla, **ismini "Spotify" koy** (Discord'da "Listening to Spotify" görünmesi için)
3. General Information'dan **Application ID**'yi not al
4. Rich Presence > Art Assets'a git, **"spotify-icon"** adında bir görsel yükle (Spotify logosu gibi bir şey)

### 3. imgbb API Key

1. [imgbb.com/api](https://api.imgbb.com/)'ye git, ücretsiz bir API key al

### 4. Proje Kurulumu

```bash
git clone https://github.com/ShaggyLorean/spotify-local-files-rp.git
cd spotify-local-files-rp
npm install
```

`.env.example` dosyasını `.env` olarak kopyala ve doldur:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
DISCORD_APPLICATION_ID=your_discord_application_id
IMGBB_API_KEY=your_imgbb_api_key
MUSIC_DIRS=C:\Users\you\Music;D:\Albums
```

### 5. Çalıştır

```bash
npm start
```

İlk çalıştırmada tarayıcıda Spotify yetkilendirme sayfası açılır. Sonraki çalıştırmalarda otomatik giriş yapar.

Windows'ta `start.bat` dosyasına çift tıklayarak da başlatabilirsin.

## Yapılandırma

| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| `DETAILS_FORMAT` | `{track}` | Ana satır (şarkı adı) |
| `STATE_FORMAT` | `{album}` | Alt satır |
| `ACTIVITY_NAME_FORMAT` | `{artist}` | "Listening to ..." kısmı |
| `SHOW_PLAYBACK_BAR` | `true` | Zaman çubuğu gösterilsin mi |
| `POLL_INTERVAL` | `5000` | Spotify API sorgu aralığı (ms) |

Placeholder'lar: `{track}`, `{artist}`, `{album}`

Örnekler:
```env
ACTIVITY_NAME_FORMAT={artist}
DETAILS_FORMAT={track}
STATE_FORMAT={album}
```

## Nasıl Görünür

```
Listening to Playboi Carti
  Skeleton
  Whole Lotta Red V1
  [████████░░░░░░░░] 1:42 / 3:03
  🖼️ Album cover art
```

## Notlar

- Cover art'lar her müzik için sadece **1 kez** upload edilir, sonrasında `.cover-cache.json` üzerinden cache'lenir
- Spotify'ın Discord connection'ını **açık bırakabilirsin** — araç sadece local file çaldığında aktif olur
- Local file'dan normal müziğe geçince otomatik olarak Discord'un native Spotify RP'sine döner

## Tech Stack

- TypeScript
- discord-rpc (IPC)
- Spotify Web API
- music-metadata
- imgbb API

## License

MIT
