import { config } from './config';
import { CoverCache } from './types';
import fs from 'fs';
import crypto from 'crypto';

let cache: CoverCache = {};
let warnedMissingImgbbKey = false;

export function loadCache(): void {
  try {
    if (fs.existsSync(config.cachePath)) {
      cache = JSON.parse(fs.readFileSync(config.cachePath, 'utf-8'));
    }
  } catch {
    cache = {};
  }
}

function saveCache(): void {
  fs.writeFileSync(config.cachePath, JSON.stringify(cache, null, 2));
}

function imageHash(data: Buffer): string {
  return crypto.createHash('md5').update(data).digest('hex');
}

export async function uploadToImgbb(imageData: Buffer): Promise<string | null> {
  if (!config.imgbbApiKey) {
    if (!warnedMissingImgbbKey) {
      console.warn('  IMGBB_API_KEY is not configured; cover art upload is disabled.');
      warnedMissingImgbbKey = true;
    }
    return null;
  }

  const base64 = imageData.toString('base64');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${config.imgbbApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `image=${encodeURIComponent(base64)}`,
      });

      if (!res.ok) {
        const error = await res.text();
        console.error(`  imgbb upload failed (attempt ${attempt}): ${error}`);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
          continue;
        }
        return null;
      }

      const data = await res.json() as any;
      return data?.data?.display_url || data?.data?.url || null;
    } catch (err: any) {
      console.error(`  imgbb upload error (attempt ${attempt}): ${err.message}`);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }
  return null;
}

export async function getCachedOrUpload(
  key: string,
  imageData: Buffer
): Promise<string | null> {
  const hash = imageHash(imageData);
  const cached = cache[key];

  if (
    cached &&
    cached.hash === hash &&
    cached.updatedAt > Date.now() - 30 * 24 * 60 * 60 * 1000
  ) {
    return cached.url;
  }

  console.log(`  Uploading cover art to imgbb...`);
  const url = await uploadToImgbb(imageData);
  if (url) {
    cache[key] = { url, hash, updatedAt: Date.now() };
    saveCache();
  }
  return url;
}
