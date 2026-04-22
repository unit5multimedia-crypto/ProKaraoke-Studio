import { Type } from "@google/genai";

// Get API keys from Vite environment variables
const YOUTUBE_API_KEY = (import.meta as any).env?.VITE_YOUTUBE_API_KEY || "";

export interface SearchResult {
  id: string;
  title: string;
  thumbnail: string;
  isPlaylist?: boolean;
}

export async function searchKaraoke(query: string, accessToken?: string): Promise<SearchResult[]> {
  // Try direct API first for speed (either using key or user token)
  const keyOrToken = accessToken ? `access_token=${accessToken}` : (YOUTUBE_API_KEY ? `key=${YOUTUBE_API_KEY}` : null);

  if (keyOrToken) {
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query + " karaoke")}&type=video,playlist&${keyOrToken}`);
      const data = await response.json();
      
      if (data.items) {
        return data.items.map((item: any) => ({
          id: item.id.videoId || item.id.playlistId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
          isPlaylist: !!item.id.playlistId
        }));
      }
    } catch (e) {
      console.error("Direct YouTube API error:", e);
    }
  }

  return [];
}

export async function getPlaylistItems(playlistId: string, accessToken?: string): Promise<SearchResult[]> {
  const keyOrToken = accessToken ? `access_token=${accessToken}` : (YOUTUBE_API_KEY ? `key=${YOUTUBE_API_KEY}` : null);
  if (!keyOrToken) return [];
  
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&${keyOrToken}`);
    const data = await response.json();
    
    if (data.items) {
      return data.items.map((item: any) => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url
      }));
    }
  } catch (e) {
    console.error("Playlist fetch error:", e);
  }
  return [];
}
