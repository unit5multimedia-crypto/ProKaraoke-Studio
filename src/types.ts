export interface LyricLine {
  startTime: number; // in seconds
  endTime: number;
  text: string;
  targetFrequency?: number; // Optional frequency for scoring
}

export interface KaraokeSettings {
  fontSize: number;
  fontFamily: string;
  idleColor: string;
  activeColor: string;
  finishedColor: string;
  lyricsPosition: 'bottom' | 'center';
  bumperFadeDuration: number;
  isPresentationMode: boolean;
}

export interface SongQueueItem {
  id: string;
  title: string;
  mediaUrl: string;
  lyrics: LyricLine[];
  isYouTube: boolean;
  bpm?: number | null;
  musicalKey?: string | null;
}

export interface KaraokeSession {
  bumperUrl: string | null;
  mediaUrl: string | null;
  backgroundUrl: string | null;
  isAudioOnly: boolean;
  lyrics: LyricLine[];
  bpm: number | null;
  musicalKey: string | null;
  duration: number;
}

export const DEFAULT_SETTINGS: KaraokeSettings = {
  fontSize: 32,
  fontFamily: 'Inter',
  idleColor: '#ffffff99',
  activeColor: '#ffffff',
  finishedColor: '#ffd700',
  lyricsPosition: 'bottom',
  bumperFadeDuration: 1.5,
  isPresentationMode: false,
};
