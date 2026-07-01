export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

export interface SpotifyTrack {
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  duration_ms: number;
  is_local: boolean;
  uri: string;
  id?: string;
  external_urls?: { spotify?: string };
}

export interface CurrentlyPlaying {
  is_playing: boolean;
  item: SpotifyTrack | null;
  progress_ms?: number;
  timestamp: number;
}

export interface CoverCache {
  [key: string]: { url: string; hash?: string; updatedAt: number };
}
