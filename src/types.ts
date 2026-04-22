export interface LyricLine {
  startTime: number; // in seconds
  endTime: number;
  text: string;
  targetFrequency?: number; // Optional frequency for scoring
}

export type ViewType = 'operator' | 'prompter' | 'stage';

export interface KaraokeSettings {
  fontSize: number;
  fontFamily: string;
  idleColor: string;
  activeColor: string;
  finishedColor: string;
  lyricsPosition: 'bottom' | 'center';
  bumperFadeDuration: number;
  viewType: ViewType;
  prompterBgColor: string; // e.g., '#000000', '#00ff00' for green screen
  visualTheme: string; // shadertoy theme name
  audioReactivity: number; // sensitivity 0 to 1
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

export interface ElectronAPI {
  onResetViews: (callback: () => void) => void;
  onEnableVideoOutput: (callback: () => void) => void;
  enterProjectionMode: () => Promise<void>;
  exitProjectionMode: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const DEFAULT_SETTINGS: KaraokeSettings = {
  fontSize: 32,
  fontFamily: 'Inter',
  idleColor: '#ffffff99',
  activeColor: '#ffffff',
  finishedColor: '#ffd700',
  lyricsPosition: 'bottom',
  bumperFadeDuration: 1.5,
  viewType: 'operator',
  prompterBgColor: '#000000',
  visualTheme: 'vibrant_nebula',
  audioReactivity: 0.5,
};
