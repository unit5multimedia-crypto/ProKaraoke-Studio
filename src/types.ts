export interface LyricLine {
  startTime: number; // in seconds
  endTime: number;
  text: string;
  targetFrequency?: number; // Optional frequency for scoring
}

export type ViewType = 'operator' | 'prompter' | 'visuals';

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
  customGLSL?: string; // custom shader code
  audioReactivity: number; // sensitivity 0 to 1
  audioDeviceId?: string; // input mic
  audioOutputId?: string; // media output
  micOutputId?: string;   // mic specific output
  micVolume?: number;     // 0.0 to 1.0
  micEcho?: number;       // 0.0 to 1.0
  micReverb?: number;     // 0.0 to 1.0
  mediaVolume?: number;   // 0.0 to 1.0
  vocalCut?: boolean;     // Enable multiplex vocal reduction
}

export interface SongQueueItem {
  id: string;
  title: string;
  mediaUrl: string;
  lyrics: LyricLine[];
  bpm?: number | null;
  musicalKey?: string | null;
  bumperInUrl?: string | null;
  bumperOutUrl?: string | null;
  status?: 'idle' | 'downloading' | 'ready';
}

export interface KaraokeSession {
  bumperInUrl: string | null;
  bumperOutUrl: string | null;
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
  viewType: 'operator',
  prompterBgColor: '#000000',
  visualTheme: 'vibrant_nebula',
  audioReactivity: 0.5,
  micVolume: 0.8,
  micEcho: 0.3,
  micReverb: 0.3,
  mediaVolume: 1.0,
  vocalCut: false
};

export interface OBSProjectorConfig {
  type: 'prompter' | 'visuals' | 'multiview';
  monitor: number; // -1 for Windowed, 0 for Primary, 1+ for other specific external displays
  name?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      openProjector: (config: OBSProjectorConfig) => void;
      send: (channel: string, data: any) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;
      removeListener: (channel: string, func: (...args: any[]) => void) => void;
      exitApp: () => void;
    };
  }
}
