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

    app.get('/callback', async (req, res) => {
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

    server = app.listen(config.port, () => {
      const authUrl = `${AUTH_URL}?client_id=${config.spotifyClientId}&response_type=code&redirect_uri=${encodeURIComponent(config.spotifyRedirectUri)}&scope=${encodeURIComponent(SCOPES)}`;
      console.log('\nOpening browser for Spotify authentication...');
      console.log(`If it doesn't open, visit:\n${authUrl}\n`);
      openBrowser(authUrl);
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

async function spotifyFetch(endpoint: string): Promise<any> {
  const token = await getValidToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204) return null;
  if (res.status === 401) {
    currentTokens = await refreshAccessToken(currentTokens!.refresh_token);
    saveTokens(currentTokens);
    const retry = await fetch(`${API_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${currentTokens.access_token}` },
    });
    if (retry.status === 204) return null;
    return retry.json();
  }

  return res.json();
}

export async function getCurrentlyPlaying(): Promise<CurrentlyPlaying | null> {
  return spotifyFetch('/me/player/currently-playing');
}
