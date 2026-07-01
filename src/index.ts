import { config, validateConfig } from './config';
import { getCurrentlyPlaying, authenticate } from './spotify';
import { initDiscord, setActivity, clearActivity } from './discord';
import { buildIndex, findFile, extractCoverArt } from './file-index';
import { getCachedOrUpload, loadCache } from './cover-art';
import { SpotifyTrack } from './types';
import { initTray, setupLogging, killTray } from './tray';

let wasLocalFile = false;
let polling = false;
const resolvedCoverUrls = new Map<string, string | null>();

async function shutdown(): Promise<void> {
  console.log('Shutting down...');
  await clearActivity();
  killTray();
  process.exit(0);
}

function formatTrack(format: string, track: SpotifyTrack): string {
  const artist = track.artists.map((a) => a.name).join(', ');
  const album = track.album?.name || '';
  return format
    .replace(/\{track\}/g, track.name)
    .replace(/\{artist\}/g, artist)
    .replace(/\{album\}/g, album);
}

async function resolveCoverArt(track: SpotifyTrack): Promise<string | null> {
  const artist = track.artists[0]?.name || '';
  const title = track.name;
  const trackKey = track.uri || `${artist}::${title}`;

  if (resolvedCoverUrls.has(trackKey)) {
    return resolvedCoverUrls.get(trackKey) || null;
  }

  const filePath = findFile(artist, title);
  if (!filePath) {
    console.log(`  File not found in index: ${artist} - ${title}`);
    resolvedCoverUrls.set(trackKey, null);
    return null;
  }

  const coverBuffer = await extractCoverArt(filePath);
  if (!coverBuffer) {
    console.log(`  No embedded cover art: ${filePath}`);
    resolvedCoverUrls.set(trackKey, null);
    return null;
  }

  const cacheKey = `${artist}::${title}`;
  const imageUrl = await getCachedOrUpload(cacheKey, coverBuffer);
  resolvedCoverUrls.set(trackKey, imageUrl);
  return imageUrl;
}

async function updatePresence(): Promise<void> {
  if (polling) return;
  polling = true;

  try {
    const data = await getCurrentlyPlaying();

    if (!data || !data.is_playing || !data.item) {
      if (wasLocalFile) {
        await clearActivity();
        wasLocalFile = false;
        console.log('Playback stopped, cleared custom RP');
      }
      return;
    }

    const track = data.item;

    if (!track.is_local) {
      if (wasLocalFile) {
        await clearActivity();
        wasLocalFile = false;
        console.log('Switched to non-local track, cleared custom RP');
      }
      return;
    }

    wasLocalFile = true;

    const artist = track.artists.map((a) => a.name).join(', ');
    console.log(`[Local File] ${artist} - ${track.name}`);

    const imageUrl = await resolveCoverArt(track);

    const activity: Record<string, any> = {
      type: 2,
      name: formatTrack(config.activityNameFormat, track),
      details: formatTrack(config.detailsFormat, track),
      state: formatTrack(config.stateFormat, track),
      instance: false,
    };

    if (config.showPlaybackBar) {
      const progress = data.progress_ms || 0;
      const duration = track.duration_ms;
      activity.startTimestamp = Date.now() - progress;
      activity.endTimestamp = Date.now() - progress + duration;
    }

    if (imageUrl) {
      activity.largeImageKey = imageUrl;
      activity.largeImageText = artist;
    }

    activity.smallImageKey = 'spotify-icon';
    activity.smallImageText = 'Spotify';

    await setActivity(activity);
    console.log(`  RP updated${imageUrl ? ' with cover art' : ' (no cover art)'}\n`);
  } catch (err: any) {
    console.error('Update error:', err.message);
  } finally {
    polling = false;
  }
}

async function main(): Promise<void> {
  setupLogging();
  console.log('=== Spotify Local Files RP Fixer ===\n');
  validateConfig();

  loadCache();
  await buildIndex();

  console.log('Connecting to Discord...');
  while (true) {
    try {
      await initDiscord();
      break;
    } catch (err: any) {
      console.error(`Discord connection failed: ${err.message}. Retrying in 10s...`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  console.log('\nAuthenticating with Spotify...');
  await authenticate();
  console.log('Spotify connected!\n');

  console.log('Monitoring Spotify playback...');
  console.log('Only local files will trigger custom RP.');
  console.log("Non-local tracks use Spotify's native Discord integration.\n");

  await initTray(shutdown);

  while (true) {
    await updatePresence();
    await new Promise((r) => setTimeout(r, config.pollInterval));
  }
}

process.on('SIGINT', shutdown);

main().catch((err) => {
  console.error('Fatal:', err);
  killTray();
  process.exit(1);
});
