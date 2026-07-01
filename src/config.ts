import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const spotifyRedirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3000/callback';
const spotifyRedirectUrl = parseRedirectUrl(spotifyRedirectUri);

function parseRedirectUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function getRedirectPort(url: URL | null): number {
  if (!url) return 3000;
  if (url.port) return Number(url.port);
  return url.protocol === 'https:' ? 443 : 80;
}

export const config = {
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  spotifyRedirectUri,
  spotifyRedirectPath: spotifyRedirectUrl?.pathname || '/callback',
  discordApplicationId: process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID || '',
  imgbbApiKey: process.env.IMGBB_API_KEY || '',
  musicDirs: (process.env.MUSIC_DIRS || '').split(';').filter(Boolean),
  pollInterval: parseInt(process.env.POLL_INTERVAL || '5000', 10),
  detailsFormat: process.env.DETAILS_FORMAT || '{track}',
  stateFormat: process.env.STATE_FORMAT || '{artist} \u2022 {album}',
  activityNameFormat: process.env.ACTIVITY_NAME_FORMAT || '{artist}',
  showPlaybackBar: (process.env.SHOW_PLAYBACK_BAR || 'true') === 'true',
  tokensPath: path.join(process.cwd(), '.tokens.json'),
  cachePath: path.join(process.cwd(), '.cover-cache.json'),
  port: getRedirectPort(spotifyRedirectUrl),
};

export function validateConfig(): void {
  const missing: string[] = [];
  if (!config.spotifyClientId) missing.push('SPOTIFY_CLIENT_ID');
  if (!config.spotifyClientSecret) missing.push('SPOTIFY_CLIENT_SECRET');
  if (!config.discordApplicationId) missing.push('DISCORD_APPLICATION_ID');
  if (config.musicDirs.length === 0) missing.push('MUSIC_DIRS');
  if (!spotifyRedirectUrl) missing.push('valid SPOTIFY_REDIRECT_URI');

  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }
}
