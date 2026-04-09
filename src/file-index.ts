import { config } from './config';
import path from 'path';
import fs from 'fs';
import mm from 'music-metadata';

interface MusicFile {
  filePath: string;
  artist: string;
  title: string;
  normalKey: string;
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac', '.wma', '.opus']);

let index: Map<string, MusicFile[]> = new Map();

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function makeKey(artist: string, title: string): string {
  return `${normalize(artist)}::${normalize(title)}`;
}

function scanDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    console.warn(`  Directory not found: ${dir}`);
    return results;
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanDir(fullPath));
      } else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  } catch (err: any) {
    console.warn(`  Cannot read directory ${dir}: ${err.message}`);
  }

  return results;
}

export function buildIndex(): void {
  console.log('Scanning music directories...');
  index.clear();

  const allFiles: string[] = [];
  for (const dir of config.musicDirs) {
    console.log(`  Scanning: ${dir}`);
    allFiles.push(...scanDir(dir));
  }

  console.log(`  Found ${allFiles.length} audio files`);

  for (const filePath of allFiles) {
    const basename = path.basename(filePath, path.extname(filePath));
    const parts = basename.split(/\s*[-–—]\s*/);

    let artist = '';
    let title = '';

    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else {
      title = basename.trim();
    }

    const key = makeKey(artist, title);
    const entry: MusicFile = { filePath, artist, title, normalKey: key };

    if (!index.has(key)) index.set(key, []);
    index.get(key)!.push(entry);

    if (artist && title) {
      const titleOnlyKey = makeKey('', title);
      if (!index.has(titleOnlyKey)) index.set(titleOnlyKey, []);
      index.get(titleOnlyKey)!.push(entry);
    }
  }

  console.log(`  Index built with ${index.size} unique keys\n`);
}

export function findFile(artist: string, title: string): string | null {
  const exactKey = makeKey(artist, title);
  const candidates = index.get(exactKey);
  if (candidates?.length) return candidates[0].filePath;

  const titleOnlyKey = makeKey('', title);
  const titleCandidates = index.get(titleOnlyKey);
  if (titleCandidates?.length) return titleCandidates[0].filePath;

  const normArtist = normalize(artist);
  const normTitle = normalize(title);
  for (const [key, entries] of index) {
    if (key.includes(normTitle) || normTitle.includes(key.split('::')[1])) {
      if (!normArtist || key.includes(normArtist)) {
        return entries[0].filePath;
      }
    }
  }

  return null;
}

export async function extractCoverArt(filePath: string): Promise<Buffer | null> {
  try {
    const metadata = await mm.parseFile(filePath, {
      skipCovers: false,
      includeChapters: false,
    });

    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      console.log(`  Cover found: ${pic.format} ${pic.data.length} bytes from ${path.basename(filePath)}`);
      return Buffer.from(pic.data);
    }

    const native = metadata.native;
    for (const fmt of Object.keys(native)) {
      for (const tag of native[fmt]) {
        const id = tag.id.toLowerCase();
        if (id === 'apic' || id === 'cover art (front)' || id === 'metadata_block_picture' || id === 'covr') {
          const val = tag.value;
          if (Buffer.isBuffer(val)) {
            console.log(`  Cover found in native tag [${fmt}]: ${id} ${val.length} bytes`);
            return val;
          }
          if (val && typeof val === 'object' && val.data && Buffer.isBuffer(val.data)) {
            console.log(`  Cover found in native tag [${fmt}]: ${id} ${val.data.length} bytes`);
            return Buffer.from(val.data);
          }
        }
      }
    }

    console.log(`  No cover art in any tag: ${path.basename(filePath)}`);
  } catch (err: any) {
    console.error(`  Error reading ${path.basename(filePath)}: ${err.message}`);
  }
  return null;
}
