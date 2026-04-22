import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Use direct YouTube API if key is available for speed
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

  // Check if we have Gemini API key for fallback
  if (!ai.apiKey) {
    throw new Error("API key is missing. Please provide a valid GEMINI_API_KEY or YOUTUBE_API_KEY in your .env file.");
  }

  // Check if we have Gemini API key for fallback
  if (!ai.apiKey || ai.apiKey.trim() === "") {
    throw new Error("API key is missing. Please provide a valid GEMINI_API_KEY or YOUTUBE_API_KEY in your .env file.");
  }

  // Fallback to Gemini if no API key or failure
  try {
    const prompt = `CRITICAL: Do NOT hallucinate or guess YouTube IDs. 
    1. Use the googleSearch tool to find 5 ACTUAL karaoke or minus-one videos on YouTube for: "${query}".
    2. Prefer videos that are likely to be embeddable (official karaoke channels like Sing King).
    3. Only use the IDs and titles found in the search results.
    4. Return a JSON array. Each object MUST have valid "id", "title", and "thumbnail" fields.
    5. If no results are found via the tool, return an empty array [].`;

    const result = await (ai.models.generateContent as any)({
      model: "gemini-3-flash-preview",
      contents: prompt,
      tools: [{ googleSearch: {} }],
      toolConfig: { includeServerSideToolInvocations: true },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Actual 11-char YouTube ID or Playlist ID" },
              title: { type: Type.STRING, description: "Accurate Video Title" },
              thumbnail: { type: Type.STRING, description: "HTTPS thumbnail URL" }
            },
            required: ["id", "title", "thumbnail"]
          }
        }
      }
    });

    const text = result.text || "[]";
    let parsed: SearchResult[] = [];
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.warn("Retrying search parsing...", e);
      return [];
    }
    
    return (Array.isArray(parsed) ? parsed : []).map(item => ({
      ...item,
      id: String(item.id || ""),
      title: String(item.title || "Unknown Track"),
      thumbnail: (item.id && (!item.thumbnail || !item.thumbnail.startsWith('http'))) 
        ? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` 
        : String(item.thumbnail || "")
    })).filter(item => item.id);
  } catch (error) {
    console.error("YouTube search error:", error);
    return [];
  }
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
