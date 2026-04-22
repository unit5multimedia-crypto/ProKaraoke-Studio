/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { KaraokeSettings, KaraokeSession, DEFAULT_SETTINGS } from './types';
import KaraokeStage from './components/KaraokeStage';
import ControlPanel from './components/ControlPanel';
import VisualStage from './components/VisualStage';
import { parseLyrics } from './lib/lyricParser';
import { Mic, Music, Layout, Settings, Timer } from 'lucide-react';

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

  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const sessionRef = useRef(session);
  const settingsRef = useRef(settings);
  const mediaFilesRef = useRef<Record<string, File>>({});
  const [localFiles, setLocalFiles] = useState<File[]>([]);

  // Keep refs in sync with state for broadcast handlers
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    broadcastRef.current = new BroadcastChannel('karaoke-sync');
    
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    
    if (viewParam === 'prompter') {
      setSettings(prev => ({ ...prev, isPresentationMode: true }));
      setIsSidebarOpen(false);
    } else if (viewParam === 'stage') {
      setSettings(prev => ({ ...prev, isPresentationMode: false })); // Or custom for stage
      setIsSidebarOpen(false);
    } else if (viewParam === 'operator') {
      setSettings(prev => ({ ...prev, isPresentationMode: false }));
      setIsSidebarOpen(true);
    }

    // Initialize YouTube API once
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    broadcastRef.current.onmessage = (event) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case 'SYNC_REQUEST': {
          // If we are the operator, send EVERYTHING to the newcomer
          if (!settingsRef.current.isPresentationMode && broadcastRef.current) {
             console.log('Fulfilling sync request for new tab...');
             broadcastRef.current.postMessage({ type: 'SETTINGS_SYNC', payload: settingsRef.current });
             broadcastRef.current.postMessage({ type: 'LYRICS_SYNC', payload: sessionRef.current.lyrics });
             
             // Send binary files if we have them
             Object.entries(mediaFilesRef.current).forEach(([mediaType, file]) => {
                broadcastRef.current?.postMessage({ 
                   type: 'MEDIA_SYNC', 
                   payload: { mediaType, file } 
                });
             });
          }
          break;
        }
        case 'MEDIA_SYNC': {
          const { mediaType, file, isYt, url } = payload;
          if (isYt) {
            console.log(`Received remote YouTube URL: ${url}`);
            setSession(prev => ({ ...prev, [mediaType]: url }));
          } else if (file) {
            console.log(`Received remote media: ${mediaType}`, file.name);
            const blobUrl = URL.createObjectURL(file);
            setSession(prev => ({ ...prev, [mediaType]: blobUrl }));
          }
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
    };

    // If prompter or stage view, request current state from operator
    if (viewParam === 'prompter' || viewParam === 'stage') {
      setTimeout(() => {
        console.log('Sending sync request to operator...');
        broadcastRef.current?.postMessage({ type: 'SYNC_REQUEST' });
      }, 800);
    }

    const saved = localStorage.getItem('karaoke_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    }

    return () => {
      broadcastRef.current?.close();
    };
  }, []);

  // Electron reset views listener
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onResetViews(() => {
        setSession({
          bumperUrl: null,
          mediaUrl: null,
          backgroundUrl: null,
          isAudioOnly: false,
          lyrics: [],
          bpm: null,
          musicalKey: null,
          duration: 0,
        });
        setPlaybackState({
          currentTime: 0,
          phase: 'idle',
          isPlaying: false,
          duration: 0
        });
        setSettings(DEFAULT_SETTINGS);
      });
    }
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

  const viewParam = new URLSearchParams(window.location.search).get('view') || 'operator';

  return (
    <div className="flex h-screen w-full bg-brand-dark overflow-hidden font-sans">
      {/* Sidebar / Console */}
      {viewParam === 'operator' && (
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
            localFiles={localFiles}
          />
        </div>
      )}

      {/* Toggle Button (Hidden in presentation mode) */}
      {viewParam === 'operator' && (
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed top-8 left-4 z-[100] w-10 h-10 glass-panel flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <Settings size={18} className={isSidebarOpen ? 'text-brand-gold rotate-90 duration-300' : 'text-white'} />
        </button>
      )}

      {/* Main Stage */}
      <main className="flex-1 relative overflow-hidden flex-col">
        {(viewParam === 'operator' || viewParam === 'prompter') ? (
          <KaraokeStage 
            {...session}
            settings={settings}
            onStateUpdate={handleStageUpdate}
            onMediaUpload={handleMediaUpload}
          />
        ) : viewParam === 'stage' ? (
          <VisualStage 
            session={session}
            settings={settings}
            playbackState={playbackState}
          />
        ) : null}
        
        {/* Status Bar */}
        {!settings.isPresentationMode && (
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
