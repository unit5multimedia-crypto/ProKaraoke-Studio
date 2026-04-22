/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { KaraokeSettings, KaraokeSession, DEFAULT_SETTINGS, ViewType } from './types';
import KaraokeStage from './components/KaraokeStage';
import ControlPanel from './components/ControlPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { parseLyrics } from './lib/lyricParser';
import { Mic, Music, Layout, Settings, Timer } from 'lucide-react';
import { auth, db, User, validateConnection } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userAuth, setUserAuth] = useState<{ accessToken: string; expiry: number } | null>(() => {
    const saved = localStorage.getItem('google_auth');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (Date.now() > parsed.expiry) {
        localStorage.removeItem('google_auth');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
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

  const sessionRef = useRef(session);
  const settingsRef = useRef(settings);
  const mediaFilesRef = useRef<Record<string, File>>({});

  useEffect(() => {
    validateConnection();
    
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync state from Firestore when logged in
  useEffect(() => {
    if (!user) return;

    const sessionDocRef = doc(db, 'users', user.uid, 'sessions', 'current');
    const unsubscribeSession = onSnapshot(sessionDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Only sync if we are NOT the operator to avoid feedback loops
        // OR if the media has changed
        if (settingsRef.current.viewType !== 'operator') {
          setSession(prev => ({
            ...prev,
            mediaUrl: data.mediaUrl,
            isYouTube: data.isYouTube || false,
            isAudioOnly: data.isAudioOnly || false,
            bumperUrl: data.bumperUrl || null,
            backgroundUrl: data.backgroundUrl || null,
            lyrics: data.lyrics || [],
            bpm: data.bpm || null,
            musicalKey: data.musicalKey || null,
            duration: data.duration || 0,
          }));
          
          setPlaybackState(prev => ({
            ...prev,
            isPlaying: data.isPlaying,
            currentTime: data.currentTime || 0,
          }));
        }
      }
    });

    return () => unsubscribeSession();
  }, [user]);

  const updateSessionOnCloud = useCallback(async (updates: Partial<KaraokeSession & { isPlaying: boolean }>) => {
    if (!user) return;
    const sessionDocRef = doc(db, 'users', user.uid, 'sessions', 'current');
    
    try {
      await setDoc(sessionDocRef, {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Cloud Sync Error:", e);
    }
  }, [user]);

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

  if (authLoading) {
    return (
      <div className="flex h-screen w-full bg-brand-dark items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin" />
          <span className="text-white/40 font-mono text-[10px] uppercase tracking-widest">Warming up ProKaraoke Studio...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full bg-brand-dark items-center justify-center p-6">
        <div className="max-w-md w-full glass-panel p-10 flex flex-col items-center text-center space-y-8 animate-in fade-in zoom-in duration-500">
           <div className="w-20 h-20 bg-brand-gold/10 rounded-3xl flex items-center justify-center text-brand-gold border border-brand-gold/20">
              <Mic size={40} />
           </div>
           
           <div className="space-y-2">
              <h1 className="text-2xl font-bold text-brand-gold tracking-tight">ProKaraoke Studio</h1>
              <p className="text-[11px] font-mono text-white/40 uppercase tracking-widest leading-relaxed">
                Professional Real-Time Karaoke Engine <br />
                Sunday Gathering Milestone // v3.0
              </p>
           </div>

           <div className="w-full h-px bg-white/5" />

           <div className="space-y-4 w-full">
              <p className="text-xs text-white/60">Access is restricted to authorized operators. Sign in to initialize the studio environment.</p>
              
              <button 
                onClick={async () => {
                  import('./lib/firebase').then(async ({ signInWithGoogle }) => {
                    try {
                      const { accessToken } = await signInWithGoogle();
                      if (accessToken) {
                         const expiry = Date.now() + 3600 * 1000;
                         const authData = { accessToken, expiry };
                         setUserAuth(authData);
                         localStorage.setItem('google_auth', JSON.stringify(authData));
                      }
                    } catch (e) {
                      alert(`Login failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
                    }
                  });
                }}
                className="w-full h-12 bg-brand-gold text-black font-black text-sm rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-gold/10"
              >
                <Music size={18} /> INITIALIZE STUDIO ACCESS
              </button>
           </div>
           
           <div className="pt-4 text-[9px] font-mono text-white/20 uppercase tracking-tighter">
              Aesthetic Architecture by antigravity // SOLI DEO GLORIA!
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-brand-dark overflow-hidden font-sans">
      {/* Sidebar / Console */}
      {settings.viewType === 'operator' && (
        <div 
          className={`transition-all duration-300 ease-in-out flex-shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ width: isSidebarOpen ? '380px' : '0' }}
        >
          <ControlPanel 
            user={user}
            userAuth={userAuth}
            setUserAuth={setUserAuth}
            settings={settings}
            setSettings={setSettings}
            session={session}
            setSession={setSession}
            onParseLyrics={handleLyricsContent}
            onMediaUpload={handleMediaUpload}
            onSyncSession={updateSessionOnCloud}
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
        <ErrorBoundary>
          <KaraokeStage 
            {...session}
            settings={settings}
            onStateUpdate={handleStageUpdate}
            onMediaUpload={handleMediaUpload}
          />
        </ErrorBoundary>
        
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
