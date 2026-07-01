import { config } from './config';
import path from 'path';
import fs from 'fs';
import * as mm from 'music-metadata';

interface MusicFile {
  filePath: string;
  artist: string;
  title: string;
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac', '.wma', '.opus']);

let index: Map<string, MusicFile[]> = new Map();

function normalize(str: string): string {
  return str
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function makeKey(artist: string, title: string): string {
  return `${normalize(artist)}::${normalize(title)}`;
}

function hasBufferData(value: unknown): value is { data: Buffer | Uint8Array } {
  if (!value || typeof value !== 'object' || !('data' in value)) return false;
  const data = (value as { data?: unknown }).data;
  return Buffer.isBuffer(data) || data instanceof Uint8Array;
}

function parseNameFallback(filePath: string): Pick<MusicFile, 'artist' | 'title'> {
  const basename = path.basename(filePath, path.extname(filePath));
  const parts = basename.split(/\s*[-–—]\s*/);

  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim(),
    };
  }

  return { artist: '', title: basename.trim() };
}

async function readMetadataTags(filePath: string): Promise<Pick<MusicFile, 'artist' | 'title'> | null> {
  try {
    const metadata = await mm.parseFile(filePath, {
      skipCovers: true,
      includeChapters: false,
    });

    const title = metadata.common.title?.trim();
    const artist = (
      metadata.common.artist ||
      metadata.common.artists?.join(', ') ||
      metadata.common.albumartist ||
      ''
    ).trim();

    if (title) return { artist, title };
  } catch (err: any) {
    console.warn(`  Metadata index failed for ${path.basename(filePath)}: ${err.message}`);
  }

  return null;
}

function addEntry(entry: MusicFile): void {
  const key = makeKey(entry.artist, entry.title);
  if (!index.has(key)) index.set(key, []);
  index.get(key)!.push(entry);

  if (entry.title) {
    const titleOnlyKey = makeKey('', entry.title);
    if (!index.has(titleOnlyKey)) index.set(titleOnlyKey, []);
    index.get(titleOnlyKey)!.push(entry);
  }
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

export async function buildIndex(): Promise<void> {
  console.log('Scanning music directories...');
  index.clear();

  const allFiles: string[] = [];
  for (const dir of config.musicDirs) {
    console.log(`  Scanning: ${dir}`);
    allFiles.push(...scanDir(dir));
  }

  console.log(`  Found ${allFiles.length} audio files`);

  for (const filePath of allFiles) {
    const fallback = parseNameFallback(filePath);
    const metadataTags = await readMetadataTags(filePath);
    const primary = metadataTags || fallback;

    addEntry({ filePath, artist: primary.artist, title: primary.title });

    if (
      metadataTags &&
      (normalize(metadataTags.artist) !== normalize(fallback.artist) ||
        normalize(metadataTags.title) !== normalize(fallback.title))
    ) {
      addEntry({ filePath, artist: fallback.artist, title: fallback.title });
    }
  }

  console.log(`  Index built with ${index.size} unique keys\n`);
}

export function findFile(artist: string, title: string): string | null {
  const exactKey = makeKey(artist, title);
  const candidates = index.get(exactKey);
  if (candidates?.length) return candidates[0].filePath;

  const normArtist = normalize(artist);
  const normTitle = normalize(title);
  if (!normTitle) return null;

  const titleOnlyKey = makeKey('', title);
  const titleCandidates = index.get(titleOnlyKey);
  if (titleCandidates?.length) {
    const artistMatch = titleCandidates.find((entry) => {
      const indexedArtist = normalize(entry.artist);
      return !!normArtist && !!indexedArtist && (indexedArtist.includes(normArtist) || normArtist.includes(indexedArtist));
    });
    return (artistMatch || titleCandidates[0]).filePath;
  }

  for (const [key, entries] of index) {
    const [indexedArtist, indexedTitle] = key.split('::');
    if (!indexedTitle) continue;

    if (indexedTitle.includes(normTitle) || normTitle.includes(indexedTitle)) {
      if (!normArtist || indexedArtist.includes(normArtist)) {
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
          if (hasBufferData(val)) {
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
