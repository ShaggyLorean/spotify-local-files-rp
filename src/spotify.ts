import { config } from './config';
import { SpotifyTokens, CurrentlyPlaying } from './types';
import fs from 'fs';
import http from 'http';
import { exec } from 'child_process';
import express from 'express';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const SCOPES = 'user-read-currently-playing user-read-playback-state';
const MAX_SPOTIFY_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(res: Response): number {
  const retryAfter = res.headers.get('retry-after');
  if (!retryAfter) return 5000;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(seconds * 1000, 1000);

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) return Math.max(dateMs - Date.now(), 1000);

  return 5000;
}

async function readResponseBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

async function readJsonResponse<T>(res: Response, context: string): Promise<T> {
  const body = await readResponseBody(res);
  if (!body) return null as T;

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`${context} returned invalid JSON (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
}

function loadTokens(): SpotifyTokens | null {
  try {
    if (fs.existsSync(config.tokensPath)) {
      return JSON.parse(fs.readFileSync(config.tokensPath, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveTokens(tokens: SpotifyTokens): void {
  fs.writeFileSync(config.tokensPath, JSON.stringify(tokens, null, 2));
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` :
              process.platform === 'darwin' ? `open "${url}"` :
              `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log(`Open this URL manually:\n${url}`);
  });
}

async function exchangeCode(code: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.spotifyRedirectUri,
    client_id: config.spotifyClientId,
    client_secret: config.spotifyClientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await res.json() as any;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.spotifyClientId,
    client_secret: config.spotifyClientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await res.json() as any;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
  };
}

function performOAuthFlow(): Promise<SpotifyTokens> {
  return new Promise((resolve, reject) => {
    const app = express();
    let server: http.Server;
    let resolved = false;

    app.get(config.spotifyRedirectPath, async (req, res) => {
      const code = req.query.code as string;
      if (!code) {
        res.send('<h1>Error</h1><p>No authorization code received.</p>');
        if (!resolved) { resolved = true; reject(new Error('No code')); server.close(); }
        return;
      }

      try {
        const tokens = await exchangeCode(code);
        saveTokens(tokens);
        res.send('<h1>Success!</h1><p>You can close this tab now.</p><script>window.close()</script>');
        if (!resolved) { resolved = true; resolve(tokens); server.close(); }
      } catch (err) {
        res.send(`<h1>Error</h1><p>${err}</p>`);
        if (!resolved) { resolved = true; reject(err); server.close(); }
      }
    });

    server = app.listen(config.port, '127.0.0.1', () => {
      const authUrl = `${AUTH_URL}?client_id=${config.spotifyClientId}&response_type=code&redirect_uri=${encodeURIComponent(config.spotifyRedirectUri)}&scope=${encodeURIComponent(SCOPES)}`;
      console.log('\nOpening browser for Spotify authentication...');
      console.log(`If it doesn't open, visit:\n${authUrl}\n`);
      openBrowser(authUrl);
    });

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (resolved) return;
      resolved = true;
      const message = err.code === 'EADDRINUSE'
        ? `OAuth callback port ${config.port} is already in use. Close the process using it or change SPOTIFY_REDIRECT_URI to another registered localhost callback.`
        : `OAuth callback server failed: ${err.message}`;
      reject(new Error(message));
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('OAuth timed out after 5 minutes'));
        server.close();
      }
    }, 5 * 60 * 1000);
  });
}

let currentTokens: SpotifyTokens | null = null;

export async function authenticate(): Promise<SpotifyTokens> {
  const existing = loadTokens();
  if (existing) {
    currentTokens = existing;
    if (Date.now() >= existing.expires_at - 60000) {
      currentTokens = await refreshAccessToken(existing.refresh_token);
      saveTokens(currentTokens);
    }
    return currentTokens;
  }

  currentTokens = await performOAuthFlow();
  return currentTokens;
}

async function getValidToken(): Promise<string> {
  if (!currentTokens) throw new Error('Not authenticated');
  if (Date.now() >= currentTokens.expires_at - 60000) {
    currentTokens = await refreshAccessToken(currentTokens.refresh_token);
    saveTokens(currentTokens);
  }
  return currentTokens.access_token;
}

async function spotifyFetch(endpoint: string, attempt = 1): Promise<any> {
  const token = await getValidToken();
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err: any) {
    if (attempt < MAX_SPOTIFY_RETRIES) {
      const waitMs = 1000 * attempt;
      console.error(`Spotify request failed: ${err.message}. Retrying in ${waitMs}ms...`);
      await sleep(waitMs);
      return spotifyFetch(endpoint, attempt + 1);
    }
    throw new Error(`Spotify request failed: ${err.message}`);
  }

  if (res.status === 204) return null;
  if (res.status === 401) {
    if (attempt >= MAX_SPOTIFY_RETRIES) {
      const error = await readResponseBody(res);
      throw new Error(`Spotify auth failed after token refresh: ${error || res.statusText}`);
    }

    currentTokens = await refreshAccessToken(currentTokens!.refresh_token);
    saveTokens(currentTokens);
    return spotifyFetch(endpoint, attempt + 1);
  }

  if (res.status === 429) {
    const waitMs = retryAfterMs(res);
    if (attempt < MAX_SPOTIFY_RETRIES) {
      console.error(`Spotify rate limited. Retrying in ${Math.ceil(waitMs / 1000)}s...`);
      await sleep(waitMs);
      return spotifyFetch(endpoint, attempt + 1);
    }
    throw new Error(`Spotify rate limited after ${attempt} attempts`);
  }

  if (res.status >= 500 && attempt < MAX_SPOTIFY_RETRIES) {
    const waitMs = 1000 * attempt;
    console.error(`Spotify API HTTP ${res.status}. Retrying in ${waitMs}ms...`);
    await sleep(waitMs);
    return spotifyFetch(endpoint, attempt + 1);
  }

  if (!res.ok) {
    const error = await readResponseBody(res);
    throw new Error(`Spotify API HTTP ${res.status}: ${error || res.statusText}`);
  }

  return readJsonResponse(res, 'Spotify API');
}

export async function getCurrentlyPlaying(): Promise<CurrentlyPlaying | null> {
  return spotifyFetch('/me/player/currently-playing');
}
