/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { KaraokeSettings, KaraokeSession, DEFAULT_SETTINGS, ViewType } from './types';
import KaraokeStage from './components/KaraokeStage';
import ControlPanel from './components/ControlPanel';
import { parseLyrics } from './lib/lyricParser';
import { Mic, Music, Layout, Settings, Timer } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

export default function App() {
  const [settings, setSettings] = useState<KaraokeSettings>(DEFAULT_SETTINGS);
  const [session, setSession] = useState<KaraokeSession>({
    bumperUrl: null,
    mediaUrl: null,
    backgroundUrl: null,
    isAudioOnly: false,
    lyrics: [],
    bpm: null,
    musicalKey: null,
    duration: 0,
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [playbackState, setPlaybackState] = useState({
    currentTime: 0,
    phase: 'idle',
    isPlaying: false,
    duration: 0
  });

  const socketRef = useRef<Socket | null>(null);
  const sessionRef = useRef(session);
  const settingsRef = useRef(settings);
  const mediaFilesRef = useRef<Record<string, File>>({});

  // Keep refs in sync with state for broadcast handlers
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    // 1. Start with defaults
    let finalSettings = { ...DEFAULT_SETTINGS };

    // 2. Merge from LocalStorage
    const saved = localStorage.getItem('karaoke_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // We exclude viewType from localStorage to prevent cross-tab pollution
        const { viewType, ...otherSettings } = parsed;
        finalSettings = { ...finalSettings, ...otherSettings };
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    }

    // 3. Override from URL
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as ViewType | null;
    if (viewParam) {
      finalSettings.viewType = viewParam;
      if (viewParam !== 'operator') setIsSidebarOpen(false);
    }

    // 4. Update state ONCE
    setSettings(finalSettings);

    // Initialize YouTube API once
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Initialize Socket.io connecting to the Express server for Method 2 Relay
    const socket = io();
    socketRef.current = socket;

    socket.on('karaoke-sync', (message: any) => {
      const { type, payload } = message;
      
      switch (type) {
        case 'SYNC_REQUEST': {
          // If we are the operator, send EVERYTHING to the newcomer
          if (settingsRef.current.viewType === 'operator') {
             console.log('Fulfilling sync request for new tab/OBS...');
             socket.emit('karaoke-sync', { type: 'SETTINGS_SYNC', payload: settingsRef.current });
             socket.emit('karaoke-sync', { type: 'LYRICS_SYNC', payload: sessionRef.current.lyrics });
             
             // Send YouTube data (we can't easily serialize massive File blobs over socket efficiently in this quick setup, so we expect pre-loaded YouTube links or host the blobs)
             if (sessionRef.current.mediaUrl && sessionRef.current.mediaUrl.includes('youtube')) {
                socket.emit('karaoke-sync', {
                   type: 'MEDIA_SYNC', 
                   payload: { mediaType: 'mediaUrl', isYt: true, url: sessionRef.current.mediaUrl }
                });
             }
          }
          break;
        }
        case 'MEDIA_SYNC': {
          const { mediaType, isYt, url } = payload;
          if (isYt && url) {
            console.log(`Received remote YouTube URL: ${url}`);
            setSession(prev => ({ ...prev, [mediaType]: url }));
          }
          // Note: Full File blob syncing is restricted via websockets to prevent massive memory crashes. 
          // Re-adding Local broadcast channel purely as a fallback for Method 1 (local windows) to receive huge binary blobs.
          break;
        }
        case 'LYRICS_SYNC': {
          setSession(prev => ({ ...prev, lyrics: payload }));
          break;
        }
        case 'SETTINGS_SYNC': {
          setSettings(payload);
          break;
        }
      }
    });

    // Also spin up a local broadcast channel just for local massive File blobs (Method 1)
    const bc = new BroadcastChannel('karaoke-sync-local');
    bc.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'MEDIA_SYNC' && payload.file) {
            console.log(`Received local massive binary blob: ${payload.mediaType}`);
            const blobUrl = URL.createObjectURL(payload.file);
            setSession(prev => ({ ...prev, [payload.mediaType]: blobUrl }));
        }
    };

    // If secondary view, request current state from any open operator tab
    if (viewParam && viewParam !== 'operator') {
      setTimeout(() => {
        console.log('Sending sync request to operator...');
        socket.emit('karaoke-sync', { type: 'SYNC_REQUEST' });
      }, 800);
    }

    return () => {
      socket.disconnect();
      bc.close();
    };
  }, []);

  const handleMediaUpload = useCallback((type: string, file: File, url: string) => {
    mediaFilesRef.current[type] = file;
    setSession(prev => ({ ...prev, [type]: url }));
  }, []);

  const handleLyricsContent = useCallback((content: string) => {
    const parsed = parseLyrics(content);
    setSession(prev => ({ ...prev, lyrics: parsed }));
  }, []);

  const handleStageUpdate = useCallback((state: any) => {
    setPlaybackState(state);
    
    // Check duration change logic using functional update to avoid session dependency
    setSession(prev => {
      if (prev.duration !== state.duration) {
        return { ...prev, duration: state.duration };
      }
      return prev;
    });
  }, []);

  return (
    <div className="flex h-screen w-full bg-brand-dark overflow-hidden font-sans">
      {/* Sidebar / Console */}
      {settings.viewType === 'operator' && (
        <div 
          className={`transition-all duration-300 ease-in-out flex-shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ width: isSidebarOpen ? '380px' : '0' }}
        >
          <ControlPanel 
            settings={settings}
            setSettings={setSettings}
            session={session}
            setSession={setSession}
            onParseLyrics={handleLyricsContent}
            onMediaUpload={handleMediaUpload}
            playbackState={playbackState}
          />
        </div>
      )}

      {/* Toggle Button (Hidden in presentation mode) */}
      {settings.viewType === 'operator' && (
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed top-8 left-4 z-[100] w-10 h-10 glass-panel flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <Settings size={18} className={isSidebarOpen ? 'text-brand-gold rotate-90 duration-300' : 'text-white'} />
        </button>
      )}

      {/* Main Stage */}
      <main className="flex-1 relative overflow-hidden flex-col">
        <KaraokeStage 
          {...session}
          settings={settings}
          onStateUpdate={handleStageUpdate}
          onMediaUpload={handleMediaUpload}
        />
        
        {/* Status Bar */}
        {settings.viewType === 'operator' && (
          <footer className="absolute bottom-4 left-4 right-4 h-12 flex items-center justify-between px-6 glass-panel pointer-events-none opacity-50 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${session.mediaUrl ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">Media Feed</span>
              </div>
              <div className={`flex items-center gap-2 ${session.bpm ? 'opacity-100' : 'opacity-0'}`}>
                <Timer size={14} className="text-brand-gold" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">{session.bpm} BPM</span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-brand-gold uppercase tracking-[0.2em]">
              ProKaraoke Studio // Real-Time Pitch Engine Active
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
