import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KaraokeSettings, KaraokeSession, SongQueueItem } from '../types';
import { Settings, Video, Music, Image as ImageIcon, Type, Palette, AlignCenter, Layout, Eye, EyeOff, Timer, RotateCcw, ListMusic, Search, Trash2, Plus, Play, Layers, LogOut, Power, XOctagon, Chrome, MonitorPlay, ExternalLink, Copy, HardDrive, FileText, CloudDownload } from 'lucide-react';
import { analyzeAudio } from '../lib/audioAnalysis';
import { searchKaraoke, SearchResult, getPlaylistItems } from '../services/youtubeSearchService';
import { listDriveFiles, getFileContent, getDriveDownloadUrl, DriveFile } from '../services/googleDriveService';
import { auth, signInWithGoogle, User } from '../lib/firebase';
import { signOut } from 'firebase/auth';

const MicLevelMeter = () => {
  const barRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    let raf: number;
    const loop = () => {
      const analyser = (window as any).karaokeMicAnalyser;
      if (analyser && barRef.current) {
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for(let i=0; i<data.length; i++) sum += data[i]*data[i];
        const rms = Math.sqrt(sum / data.length);
        const percent = Math.min(100, rms * 500); // Scale RMS mapped visually
        barRef.current.style.width = `${percent}%`;
        barRef.current.style.backgroundColor = percent > 80 ? '#ef4444' : '#22c55e';
      } else if (barRef.current) {
        barRef.current.style.width = '0%';
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden flex border border-white/5">
      <div ref={barRef} className="h-full bg-green-500 w-0 transition-all duration-75 ease-linear" />
    </div>
  );
};

interface ControlPanelProps {
  user: User | null;
  userAuth: { accessToken: string; expiry: number } | null;
  setUserAuth: (auth: { accessToken: string; expiry: number } | null) => void;
  settings: KaraokeSettings;
  setSettings: (s: KaraokeSettings) => void;
  session: KaraokeSession;
  setSession: React.Dispatch<React.SetStateAction<KaraokeSession>>;
  onParseLyrics: (content: string) => void;
  onMediaUpload: (type: string, file: File, url: string) => void;
  onSyncSession?: (updates: any) => void;
  playbackState: { currentTime: number; phase: any; isPlaying: boolean; duration: number };
}

export default function ControlPanel({
  user,
  userAuth,
  setUserAuth,
  settings,
  setSettings,
  session,
  setSession,
  onParseLyrics,
  onMediaUpload,
  onSyncSession,
  playbackState
}: ControlPanelProps) {

  const [activeTab, setActiveTab] = React.useState<'config' | 'maker' | 'queue' | 'library'>('queue');
  const [libraryView, setLibraryView] = React.useState<'online' | 'cloud' | 'local'>('online');
  const [makerLyrics, setMakerLyrics] = React.useState<string>("");
  const [makerLines, setMakerLines] = React.useState<string[]>([]);
  const [makerStep, setMakerStep] = React.useState(0);
  const [makerResults, setMakerResults] = React.useState<{text: string, startTime: number, endTime: number}[]>([]);
  const [isReviewingMaker, setIsReviewingMaker] = React.useState(false);
  const [ytUrl, setYtUrl] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [driveFiles, setDriveFiles] = React.useState<DriveFile[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isDriveLoading, setIsDriveLoading] = React.useState(false);

  const [queue, setQueue] = React.useState<SongQueueItem[]>(() => {
    try {
      const saved = localStorage.getItem('karaoke_queue');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to load queue", e);
      return [];
    }
  });

  const handleGoogleLogin = async () => {
    try {
      const { accessToken } = await signInWithGoogle();
      if (accessToken) {
        setUserAuth({ accessToken, expiry: Date.now() + 3600 * 1000 });
      }
    } catch (e) {
      console.error("Auth error:", e);
      alert(`Login Error: ${e instanceof Error ? e.message : "Connection failed"}`);
    }
  };

  const handleGoogleLogout = async () => {
    await signOut(auth);
    setUserAuth(null);
    localStorage.removeItem('google_auth');
  };

  const saveQueue = (newQueue: SongQueueItem[]) => {
    setQueue(newQueue);
    localStorage.setItem('karaoke_queue', JSON.stringify(newQueue));
    const bc = new BroadcastChannel('karaoke-sync');
    bc.postMessage({ type: 'QUEUE_SYNC', payload: newQueue });
    bc.close();
  };

  const clearQueue = () => {
    if (window.confirm("Are you sure you want to clear the entire song queue? This will reset the playlist for all projection windows.")) {
      saveQueue([]);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setSearchResults([]); 
    const results = await searchKaraoke(searchQuery, userAuth?.accessToken);
    setSearchResults(results);
    setIsSearching(false);
  };

  const loadDriveFiles = async (query: string = "") => {
    if (!userAuth?.accessToken) return;
    setIsDriveLoading(true);
    try {
      const files = await listDriveFiles(userAuth.accessToken, query);
      setDriveFiles(files);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to access Google Drive");
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleDriveFileSelect = async (file: DriveFile) => {
    if (!userAuth?.accessToken) return;
    
    // If it's a text file, it's likely lyrics
    if (file.mimeType.startsWith('text/')) {
       setIsDriveLoading(true);
       const content = await getFileContent(file.id, userAuth.accessToken);
       onParseLyrics(content);
       setIsDriveLoading(false);
       
       if (onSyncSession) {
         onSyncSession({ lyrics: session.lyrics });
       }
       alert(`Lyrics loaded from: ${file.name}`);
    } 
    // If it's video or audio, it's media
    else if (file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/')) {
       const url = getDriveDownloadUrl(file.id, userAuth.accessToken);
       setSession(prev => ({ 
         ...prev, 
         mediaUrl: url,
         isAudioOnly: file.mimeType.startsWith('audio/') 
       }));
       
       if (onSyncSession) {
         onSyncSession({ mediaUrl: url, isAudioOnly: file.mimeType.startsWith('audio/') });
       }
       
       alert(`Media loaded from: ${file.name}`);
    }
  };

  const addToQueue = async (item: SearchResult) => {
    if (item.isPlaylist) {
      const items = await getPlaylistItems(item.id, userAuth?.accessToken);
      const newItems: SongQueueItem[] = items.map(res => ({
        id: Math.random().toString(36).substr(2, 9),
        title: res.title,
        mediaUrl: `https://www.youtube.com/watch?v=${res.id}`,
        lyrics: [],}));
      saveQueue([...queue, ...newItems]);
    } else {
      const newItem: SongQueueItem = {
        id: Math.random().toString(36).substr(2, 9),
        title: item.title,
        mediaUrl: `https://www.youtube.com/watch?v=${item.id}`,
        lyrics: [],};
      saveQueue([...queue, newItem]);
    }
    setActiveTab('queue');
  };

  const loadFromQueue = (item: SongQueueItem) => {
    // Guess isAudioOnly from title/url if missing, else default false so video plays
    let audioOnly = false;
    if (item.title?.toLowerCase().match(/\.(mp3|wav|ogg|m4a|aac)$/i)) audioOnly = true;

    const sessionUpdate = {
      mediaUrl: item.mediaUrl,
      lyrics: item.lyrics,
      isAudioOnly: audioOnly,
      bpm: item.bpm || null,
      musicalKey: item.musicalKey || null,
      bumperInUrl: item.bumperInUrl || session.bumperInUrl,
      bumperOutUrl: item.bumperOutUrl || session.bumperOutUrl
    };

    setSession(prev => ({
      ...prev,
      ...sessionUpdate
    }));
    
    onParseLyrics((item.lyrics || []).map(l => `[${formatTime(l.startTime)}-${formatTime(l.endTime)}] ${l.text}`).join('\n'));

    if (onSyncSession) {
      onSyncSession(sessionUpdate);
    }
  };

  const removeFromQueue = (id: string) => {
    saveQueue(queue.filter(q => q.id !== id));
  };

  const handleYtSubmit = () => {
    if (!ytUrl) return;
    setSession(prev => ({ 
      ...prev, 
      mediaUrl: ytUrl,
      isAudioOnly: false 
    }));
    if (onSyncSession) {
      onSyncSession({ 
        mediaUrl: ytUrl,
        isAudioOnly: false
      });
    }
  };

  const handleMakerCapture = React.useCallback(() => {
    const time = playbackState.currentTime;
    const line = makerLines[makerStep];
    if (!line) return;
    
    setMakerResults(prev => [...prev, { text: line, startTime: time, endTime: time + 3 }]);
    setMakerStep(s => s + 1);
    
    if (makerStep + 1 === makerLines.length) {
      setIsReviewingMaker(true);
    }
  }, [playbackState.currentTime, makerLines, makerStep]);

  const finalizeFromResults = () => {
    const formatted = makerResults.map(r => `[${formatTime(r.startTime)}-${formatTime(r.endTime)}] ${r.text}`).join('\n');
    onParseLyrics(formatted);
    if (onSyncSession) {
      onSyncSession({ lyrics: session.lyrics });
    }
    setActiveTab('config');
    setIsReviewingMaker(false);
    setMakerStep(0);
    setMakerResults([]);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a textarea or input
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      
      if (e.code === 'Space' && activeTab === 'maker' && playbackState.isPlaying && makerStep < makerLines.length) {
        e.preventDefault();
        handleMakerCapture();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, playbackState.isPlaying, makerStep, makerLines.length, handleMakerCapture]);

  // finalizeMaker removed in favor of finalizeFromResults

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const nextLyric = (session.lyrics || []).find(l => l && l.startTime > playbackState.currentTime);

  const handleFileUpload = (type: keyof KaraokeSession) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'lyrics' as any) {
       const reader = new FileReader();
       reader.onload = (e) => {
         const content = e.target?.result as string;
         import('../lib/lyricParser').then(({ parseLyrics }) => {
            const parsed = parseLyrics(content);
            onParseLyrics(content);
            if (onSyncSession) {
               onSyncSession({ lyrics: parsed });
            }
         });
       };
       reader.readAsText(file);
    } else {
       const url = URL.createObjectURL(file);
       onMediaUpload(type as string, file, url);
       
       if (type === 'mediaUrl') {
         const { bpm, key } = await analyzeAudio(url);
         const isAudio = file.type.startsWith('audio') || (!file.type.startsWith('video') && file.type !== '');
         setSession(prev => ({ 
           ...prev, 
           mediaUrl: url,
           isAudioOnly: isAudio,
           bpm, 
           musicalKey: key 
         }));
         if (onSyncSession) {
            onSyncSession({ 
              mediaUrl: url, 
              isAudioOnly: isAudio,
              bpm, 
              musicalKey: key 
            });
         }
       }
    }
  };

  const updateSetting = (key: keyof KaraokeSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('karaoke_settings', JSON.stringify(newSettings));
  };

  const handleManualSync = () => {
    if (onSyncSession) {
      onSyncSession({ ...session, updatedAt: new Date().toISOString() });
    }
  };

  const handleShutdown = () => {
    if (window.confirm("ARE YOU SURE? This will shut down the entire Praise Studio system and close all projection windows.")) {
       // 1. Signal everyone else first using a stable channel send
       const bc = new BroadcastChannel('karaoke-sync');
       bc.postMessage({ type: 'COMMAND', payload: { action: 'APP_EXIT' } });
       
       // 2. Clear local session data
       localStorage.removeItem('karaoke_queue');
       
       // 3. Attempt to close this window
       if (window.electronAPI?.exitApp) {
          window.electronAPI.exitApp();
       }
       
       try {
         window.close();
       } catch (e) {}
       
       // 4. Fallback: navigate to blank
       setTimeout(() => {
         bc.close();
         window.location.href = 'about:blank';
       }, 200);
    }
  };

  const loadSample = () => {
    onParseLyrics("[00:00.00-00:05.00] Welcome to ProKaraoke Studio\n[00:05.00-00:10.00] Ready for Sunday Event?\n[00:10.00-00:15.00] Let the music play!");
    setSession(prev => ({ ...prev, bpm: 128, musicalKey: 'C Major' }));
  };

  return (
    <div className="w-[380px] h-full glass-panel border-l-0 rounded-none border-y-0 flex flex-col overflow-hidden">
      <div className="p-6 border-bottom border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-gold/10 rounded-xl flex items-center justify-center text-brand-gold border border-brand-gold/20">
            <Settings size={20} className="animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold tracking-tight text-white/90">Operator Desk</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-brand-gold font-mono font-bold">READY // V1.4</span>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {user && (
            <button 
              onClick={handleShutdown}
              className="w-8 h-8 rounded border border-red-500/20 bg-red-500/5 flex items-center justify-center text-red-500/40 hover:text-red-400 hover:border-red-400 hover:bg-red-400/10 transition-all group relative"
              title="SYSTEM SHUTDOWN // CLOSE ALL WINDOWS"
            >
              <Power size={14} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse border-2 border-brand-dark" />
            </button>
          )}
          <button 
            onClick={loadSample}
            className="w-8 h-8 rounded border border-white/10 flex items-center justify-center text-white/20 hover:text-brand-gold hover:border-brand-gold/50 transition-colors"
            title="Load Sample Script"
          >
            <Music size={14} />
          </button>
          <button 
            onClick={() => updateSetting('viewType', settings.viewType === 'operator' ? 'prompter' : 'operator')}
            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all shadow-sm ${settings.viewType !== 'operator' ? 'bg-brand-gold text-black border-brand-gold' : 'border-white/10 text-white/40 hover:border-white/30'}`}
            title={settings.viewType !== 'operator' ? "Exit Performer View" : "Enter Performer View"}
          >
            {settings.viewType !== 'operator' ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Mode Selectors */}
      <div className="px-4 flex border-b border-white/5 scroll-x-auto bg-black/20">
        {(['queue', 'library', 'maker', 'config'] as const).map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-[9px] font-mono uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === tab ? 'border-brand-gold text-brand-gold' : 'border-transparent text-white/30'}`}
          >
            {tab === 'queue' && <ListMusic size={12} />}
            {tab === 'library' && <Layers size={12} />}
            {tab === 'config' && <Settings size={12} />}
            {tab === 'maker' && <Type size={12} />}
            {tab === 'library' ? 'Library' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-12 custom-scrollbar">
        {activeTab === 'queue' && (
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="input-label m-0 flex items-center gap-2 underline decoration-brand-gold/30">Playlist Queue</h3>
                <div className="flex items-center gap-3">
                  {queue.length > 0 && (
                    <button 
                      onClick={clearQueue}
                      className="text-[9px] font-mono text-red-500/60 hover:text-red-400 flex items-center gap-1 uppercase tracking-tighter transition-colors"
                    >
                      <Trash2 size={10} /> Clear All
                    </button>
                  )}
                  <span className="text-[10px] font-mono text-white/20">{queue.length} Tracks</span>
                </div>
              </div>
              
              {queue.length === 0 ? (
                <div className="p-8 border border-dashed border-white/5 rounded-2xl flex flex-col items-center gap-3 text-center">
                  <ListMusic size={32} className="text-white/10" />
                  <p className="text-[10px] text-white/20 uppercase tracking-widest font-mono">Queue is empty</p>
                  <button onClick={() => setActiveTab('library')} className="text-[10px] text-brand-gold border border-brand-gold/20 px-3 py-1 rounded-full hover:bg-brand-gold/5 transition-colors">Start Searching</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((item, i) => {
                    const isPlaying = item.mediaUrl === session.mediaUrl;
                    const isNext = !isPlaying && i > queue.findIndex(q => q.mediaUrl === session.mediaUrl);
                    
                    let statusColor = "bg-white/5 border-white/10 text-white/90";
                    let statusIcon = <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-[10px] font-bold text-white/30">{i + 1}</div>;
                    
                    if (isPlaying) {
                      statusColor = "bg-brand-gold/10 border-brand-gold/50 shadow-[0_0_15px_rgba(255,215,0,0.2)]";
                      statusIcon = <div className="w-8 h-8 rounded-lg bg-brand-gold text-black flex items-center justify-center text-[10px] font-bold animate-pulse"><Play size={14} fill="currentColor" /></div>;
                    } else if (isNext && item.status === 'downloading') {
                      statusColor = "bg-blue-500/10 border-blue-500/30";
                      statusIcon = <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold animate-pulse">...</div>;
                    }
                    
                    return (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 border rounded-xl hover:border-brand-gold/30 transition-all group flex items-center gap-3 ${statusColor}`}
                    >
                      {statusIcon}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold truncate ${isPlaying ? 'text-brand-gold' : 'text-white/90'}`}>{item.title}</p>
                        <div className="flex items-center gap-2">
                           <p className="text-[9px] font-mono text-white/30 truncate">
                             {item.status === 'downloading' ? 'DOWNLOADING...' : (item.mediaUrl.includes('google') ? 'Cloud Source' : 'Local Source')}
                           </p>
                           <div className="flex gap-2">
                             {item.bumperInUrl ? (
                               <span className="text-[7px] bg-brand-gold/10 text-brand-gold px-1 py-0.5 rounded border border-brand-gold/20 flex items-center gap-0.5">
                                 <Video size={7} /> INTRO
                               </span>
                             ) : (
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   const input = document.createElement('input');
                                   input.type = 'file'; input.accept = 'video/*';
                                   input.onchange = (ev: any) => {
                                     const file = ev.target.files[0];
                                     if (file) {
                                       const url = URL.createObjectURL(file);
                                       const newQueue = [...queue];
                                       newQueue[i].bumperInUrl = url;
                                       saveQueue(newQueue);
                                     }
                                   };
                                   input.click();
                                 }}
                                 className="text-[7px] text-white/20 hover:text-brand-gold underline"
                               >
                                 SET INTRO
                               </button>
                             )}
                             {item.bumperOutUrl ? (
                               <span className="text-[7px] bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded border border-blue-500/20 flex items-center gap-0.5">
                                 <Video size={7} /> OUTRO
                               </span>
                             ) : (
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   const input = document.createElement('input');
                                   input.type = 'file'; input.accept = 'video/*';
                                   input.onchange = (ev: any) => {
                                     const file = ev.target.files[0];
                                     if (file) {
                                       const url = URL.createObjectURL(file);
                                       const newQueue = [...queue];
                                       newQueue[i].bumperOutUrl = url;
                                       saveQueue(newQueue);
                                     }
                                   };
                                   input.click();
                                 }}
                                 className="text-[7px] text-white/20 hover:text-blue-400 underline"
                               >
                                 SET OUTRO
                               </button>
                             )}
                           </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => loadFromQueue(item)}
                          className="w-8 h-8 rounded bg-brand-gold text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                        >
                          <Play size={14} fill="currentColor" />
                        </button>
                        <button 
                          onClick={() => removeFromQueue(item.id)}
                          className="w-8 h-8 rounded bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </motion.div>
                  )})}
                </div>
              )}
           </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-6">
            {!user ? (
               <div className="p-8 bg-brand-gold/5 border border-brand-gold/10 rounded-2xl flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-brand-gold/10 rounded-full flex items-center justify-center text-brand-gold animate-pulse">
                  <Chrome size={32} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-2">Unified Studio Access</h4>
                  <p className="text-[10px] text-white/40 leading-relaxed px-4">One login to rule them all. Access YouTube search, Google Drive library, and cloud synchronization instantly.</p>
                </div>
                <button 
                  onClick={handleGoogleLogin}
                  className="w-full h-11 bg-brand-gold text-black text-xs font-black rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-gold/10"
                >
                  <Chrome size={18} /> INITIALIZE GOOGLE CLOUD ACCESS
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-brand-gold/20 flex items-center justify-center text-brand-gold bg-black/40">
                      {user.photoURL ? <img src={user.photoURL} alt="" /> : <Chrome size={18} />}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white uppercase tracking-wider">{user.displayName || 'Authorized'}</p>
                      <p className="text-[9px] font-mono text-green-500 uppercase tracking-tighter">Unified System Online</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleGoogleLogout}
                    className="p-2.5 text-white/20 hover:text-red-400 hover:bg-red-400/5 rounded-full transition-all"
                    title="Logout"
                  >
                    <LogOut size={16} />
                  </button>
                </div>

                <div className="flex p-1 bg-black/40 rounded-xl border border-white/10">
                  <button 
                    onClick={() => setLibraryView('online')}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${libraryView === 'online' ? 'bg-brand-gold text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    <Search size={14} /> ONLINE
                  </button>
                  <button 
                    onClick={() => { setLibraryView('cloud'); if(driveFiles.length === 0) loadDriveFiles(); }}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${libraryView === 'cloud' ? 'bg-brand-gold text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    <HardDrive size={14} /> CLOUD
                  </button>
                  <button 
                    onClick={() => setLibraryView('local')}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${libraryView === 'local' ? 'bg-brand-gold text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    <MonitorPlay size={14} /> LOCAL
                  </button>
                </div>

                {libraryView === 'online' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                          <input 
                             type="text"
                             placeholder="Search YouTube Karaoke..."
                             value={searchQuery}
                             onChange={(e) => setSearchQuery(e.target.value)}
                             onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                             className="w-full h-10 bg-black/40 border border-white/10 rounded-full text-[11px] pl-10 pr-4 focus:outline-none focus:border-brand-gold"
                          />
                        </div>
                        <button 
                           onClick={handleSearch}
                           disabled={isSearching}
                           className="w-10 h-10 rounded-full bg-brand-gold text-black flex items-center justify-center disabled:opacity-50"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                    </div>

                    {isSearching ? (
                      <div className="py-12 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-2 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin" />
                        <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest text-center">Consulting AI...</p>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-3">
                        {searchResults.map((res) => (
                           <motion.div 
                             key={res.id}
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="flex gap-3 p-3 bg-white/2 border border-white/5 rounded-xl hover:border-brand-gold/20 transition-all group"
                           >
                              <div className="relative w-20 h-14 bg-black/40 rounded-lg overflow-hidden border border-white/5 shrink-0">
                                <img src={res.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                {res.isPlaylist && <div className="absolute top-1 right-1 bg-brand-gold text-black p-0.5 rounded shadow-lg"><Layers size={10} /></div>}
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col justify-between">
                                <p className="text-[10px] font-bold text-white/80 line-clamp-2 leading-tight">{res.title}</p>
                                <div className="flex gap-2">
                                  <button onClick={() => { setYtUrl(`https://www.youtube.com/watch?v=${res.id}`); handleYtSubmit(); }} className="text-[9px] font-bold text-brand-gold hover:underline">LOAD</button>
                                  <button onClick={() => addToQueue(res)} className="text-[9px] font-bold text-white/40 hover:text-brand-gold flex items-center gap-1">
                                    <Plus size={10} /> ENQUEUE
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setMakerLines([res.title, "(Verse 1)", "...", "(Chorus)", "..."]);
                                      setActiveTab('maker');
                                      setYtUrl(`https://www.youtube.com/watch?v=${res.id}`);
                                    }}
                                    className="text-[9px] font-bold text-white/20 hover:text-brand-gold transition-colors"
                                  >
                                    SYNC
                                  </button>
                                </div>
                              </div>
                           </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {['Sing King', 'KaraokeOnYT', 'Karaoke Version', 'Sunfly Karaoke'].map(target => (
                          <button 
                            key={target}
                            onClick={() => { setSearchQuery(target + " "); handleSearch(); }}
                            className="p-3 bg-white/5 border border-white/10 rounded-xl text-center text-[10px] text-white/40 hover:text-brand-gold hover:border-brand-gold/40 transition-all font-mono"
                          >
                            {target}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {libraryView === 'cloud' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                        <input 
                          type="text" 
                          placeholder="Search GDrive..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:border-brand-gold/50 outline-none font-mono"
                          onKeyDown={(e) => { if (e.key === 'Enter') loadDriveFiles(e.currentTarget.value); }}
                        />
                      </div>
                      <button onClick={() => loadDriveFiles()} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-brand-gold"><RotateCcw size={16} /></button>
                    </div>

                    {isDriveLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center gap-4">
                         <div className="w-8 h-8 border-2 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin" />
                      </div>
                    ) : driveFiles.length > 0 ? (
                      <div className="space-y-1.5 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {driveFiles.map(file => (
                          <motion.div
                            key={file.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 hover:border-brand-gold/30 rounded-xl transition-all group cursor-pointer"
                            onClick={() => handleDriveFileSelect(file)}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${file.mimeType.startsWith('text/') ? 'bg-blue-500/10 text-blue-400' : 'bg-brand-gold/10 text-brand-gold'}`}>
                              {file.mimeType.startsWith('text/') ? <FileText size={16} /> : <CloudDownload size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-white/80 truncate group-hover:text-brand-gold">{file.name}</p>
                              <div className="flex gap-2 items-center">
                                <p className="text-[8px] font-mono text-white/20 uppercase">{(parseInt(file.size || "0") / 1024 / 1024).toFixed(1)}MB</p>
                                {!file.mimeType.startsWith('text/') && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newId = Math.random().toString(36).substr(2, 9);
                                      const tempUrl = getDriveDownloadUrl(file.id, userAuth!.accessToken);
                                      
                                      const newItem: SongQueueItem = {
                                        id: newId,
                                        title: file.name,
                                        mediaUrl: tempUrl, // fallback
                                        lyrics: [],
                                        status: 'downloading',
                                        bumperInUrl: session.bumperInUrl,
                                        bumperOutUrl: session.bumperOutUrl
                                      };
                                      
                                      const updatedQueue = [...queue, newItem];
                                      saveQueue(updatedQueue);
                                      setActiveTab('queue');
                                      
                                      // Start background download to bypass CORS / direct stream issues
                                      fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                                         headers: { 'Authorization': `Bearer ${userAuth!.accessToken}` }
                                      })
                                      .then(async res => {
                                         if (!res.ok) throw new Error("Failed to download");
                                         const blob = await res.blob();
                                         const url = URL.createObjectURL(blob);
                                         
                                         setQueue(currentQueue => {
                                            const newlyUpdated = currentQueue.map(q => q.id === newId ? { ...q, mediaUrl: url, status: 'ready' as any } : q);
                                            localStorage.setItem('karaoke_queue', JSON.stringify(newlyUpdated));
                                            return newlyUpdated;
                                         });
                                      })
                                      .catch(err => {
                                         console.error("G-Drive Download Error:", err);
                                         setQueue(currentQueue => {
                                            const newlyUpdated = currentQueue.map(q => q.id === newId ? { ...q, status: 'ready' as any } : q);
                                            localStorage.setItem('karaoke_queue', JSON.stringify(newlyUpdated));
                                            return newlyUpdated;
                                         });
                                      });
                                    }}
                                    className="text-[8px] font-bold text-brand-gold hover:underline"
                                  >
                                    ENQUEUE
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center opacity-20">
                         <CloudDownload size={32} className="mx-auto mb-2" />
                         <p className="text-[10px] font-mono uppercase">Search Drive Access...</p>
                      </div>
                    )}
                  </div>
                )}

                {libraryView === 'local' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-1 gap-3">
                       <label className="flex items-center gap-4 p-4 bg-white/5 border border-dashed border-white/20 rounded-2xl hover:border-brand-gold/50 cursor-pointer transition-all group">
                         <div className="w-12 h-12 bg-brand-gold/10 rounded-xl flex items-center justify-center text-brand-gold group-hover:scale-110 transition-transform">
                            <Video size={24} />
                         </div>
                             <div className="flex-1">
                                <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">Video / Audio</h4>
                                <div className="flex gap-2">
                                  <p className="text-[10px] text-white/30 font-mono">MP4, MKV, MP3, WAV...</p>
                                  <button 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'video/*,audio/*';
                                      input.onchange = async (ev: any) => {
                                        const file = ev.target.files[0];
                                        if (file) {
                                          const url = URL.createObjectURL(file);
                                          const newItem: SongQueueItem = {
                                            id: Math.random().toString(36).substr(2, 9),
                                            title: file.name,
                                            mediaUrl: url,
                                            lyrics: [],
                                            bumperInUrl: session.bumperInUrl,
                                            bumperOutUrl: session.bumperOutUrl
                                          };
                                          saveQueue([...queue, newItem]);
                                          setActiveTab('queue');
                                        }
                                      };
                                      input.click();
                                    }}
                                    className="text-[9px] font-bold text-brand-gold hover:underline"
                                  >
                                    ADD TO QUEUE
                                  </button>
                                </div>
                             </div>
                         <input type="file" className="hidden" accept="video/*,audio/*" onChange={handleFileUpload('mediaUrl')} />
                       </label>

                       <label className="flex items-center gap-4 p-4 bg-white/5 border border-dashed border-white/20 rounded-2xl hover:border-brand-gold/50 cursor-pointer transition-all group">
                         <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                            <FileText size={24} />
                         </div>
                         <div className="flex-1">
                            <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">Timed Lyrics</h4>
                            <p className="text-[10px] text-white/30 font-mono">TXT, LRC Source...</p>
                         </div>
                         <input type="file" className="hidden" accept=".txt,.lrc" onChange={handleFileUpload('lyrics' as any)} />
                       </label>

                       <div className="grid grid-cols-2 gap-3 p-4 bg-white/5 border border-dashed border-white/20 rounded-2xl">
                          <label className="flex flex-col items-center gap-2 p-3 bg-black/40 rounded-xl hover:border-brand-gold/50 cursor-pointer transition-all border border-white/5">
                             <Video size={20} className="text-brand-gold" />
                             <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">Bumper IN</span>
                             <input type="file" className="hidden" accept="video/*" onChange={handleFileUpload('bumperInUrl')} />
                          </label>
                          <label className="flex flex-col items-center gap-2 p-3 bg-black/40 rounded-xl hover:border-blue-500/50 cursor-pointer transition-all border border-white/5">
                             <Video size={20} className="text-blue-400" />
                             <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">Bumper OUT</span>
                             <input type="file" className="hidden" accept="video/*" onChange={handleFileUpload('bumperOutUrl')} />
                          </label>
                       </div>
                    </div>

                    <div className="p-4 bg-brand-gold/5 border border-brand-gold/10 rounded-2xl">
                       <p className="text-[10px] text-brand-gold/60 leading-relaxed italic text-center">
                         Local files are loaded instantly from your device. Best for regions with limited internet or specialized performance MKVs.
                       </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Removed redundant activeTab === 'drive' logic as it is merged into library */}

        {activeTab === 'config' && (
          <div className="space-y-8 pb-12">
            {/* Playback Status */}
            <section className="p-5 bg-gradient-to-br from-brand-gold/10 to-transparent rounded-2xl border border-brand-gold/10 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Timer size={48} className="rotate-12" />
               </div>
               <div className="grid grid-cols-2 gap-6 mb-5">
                  <div className="flex flex-col">
                     <span className="text-[9px] uppercase font-mono text-white/40 mb-1 tracking-wider">Elapsed Time</span>
                     <span className="text-2xl font-mono font-bold text-brand-gold tabular-nums">{formatTime(playbackState.currentTime)}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/10 pl-6">
                     <span className="text-[9px] uppercase font-mono text-white/40 mb-1 tracking-wider">Remaining</span>
                     <span className="text-2xl font-mono font-bold text-white/80 tabular-nums">{formatTime(playbackState.duration - playbackState.currentTime)}</span>
                  </div>
               </div>
               <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-mono text-white/40 tracking-wider">Next Lyrical Cue</span>
                    {nextLyric && <span className="text-[8px] font-mono text-brand-gold uppercase">IN {formatTime(nextLyric.startTime - playbackState.currentTime)}</span>}
                  </div>
                  <div className="text-sm font-medium text-white/70 truncate italic bg-black/30 p-2.5 rounded-lg border border-white/5">
                     {nextLyric ? `"${nextLyric.text}"` : "--- End of Track ---"}
                  </div>
               </div>
            </section>

            {/* Production Monitors */}
            <section className="space-y-4">
              <h3 className="input-label flex items-center gap-2 m-0"><Chrome size={14} className="text-brand-gold" /> Output Manager</h3>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2 space-y-2 mb-2 p-3 bg-black/40 rounded-xl border border-white/10">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex justify-between items-center text-[9px] uppercase tracking-widest text-white/40">
                      <span>Mic Input</span>
                    </label>
                    <select
                      value={settings.audioDeviceId || ''}
                      onChange={(e) => updateSetting('audioDeviceId', e.target.value)}
                      className="w-full h-8 bg-white/5 border border-white/10 rounded overflow-hidden text-[10px] px-2 outline-none mb-1"
                      onClick={async (e) => {
                        const target = e.currentTarget;
                        if (target.options.length <= 1) {
                          try {
                            const devices = await navigator.mediaDevices.enumerateDevices();
                            const audioInputs = devices.filter(d => d.kind === 'audioinput');
                            const currentVal = target.value;
                            target.innerHTML = '<option value="">Default System Mic</option>';
                            audioInputs.forEach(d => {
                              const opt = document.createElement('option');
                              opt.value = d.deviceId;
                              opt.text = d.label || `Microphone ${d.deviceId.slice(0, 5)}...`;
                              target.appendChild(opt);
                            });
                            target.value = currentVal;
                          } catch(err) {}
                        }
                      }}
                    >
                      <option value="">Default System Mic</option>
                      {settings.audioDeviceId && <option value={settings.audioDeviceId}>Selected Audio Input</option>}
                    </select>
                    <MicLevelMeter />
                  </div>
                  
                  <div className="flex gap-4 px-1 py-2">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="flex justify-between text-[8px] font-mono text-brand-gold">
                        <span>MIC VOL</span><span>{Math.round((settings.micVolume ?? 0.8) * 100)}%</span>
                      </label>
                      <input 
                        type="range" min="0" max="1" step="0.05" 
                        value={settings.micVolume ?? 0.8} 
                        onChange={(e) => updateSetting('micVolume', parseFloat(e.target.value))} 
                        className="w-full h-1 accent-brand-gold" 
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="flex justify-between text-[8px] font-mono text-green-400">
                        <span>ECHO FX</span><span>{Math.round((settings.micEcho ?? 0.3) * 100)}%</span>
                      </label>
                      <input 
                        type="range" min="0" max="1" step="0.05" 
                        value={settings.micEcho ?? 0.3} 
                        onChange={(e) => updateSetting('micEcho', parseFloat(e.target.value))} 
                        className="w-full h-1 accent-green-400" 
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                    <label className="text-[9px] uppercase tracking-widest text-white/40">Playback Output</label>
                    <select
                      value={settings.audioOutputId || ''}
                      onChange={(e) => updateSetting('audioOutputId', e.target.value)}
                      className="w-full h-8 bg-white/5 border border-white/10 rounded overflow-hidden text-[10px] px-2 outline-none"
                      onClick={async (e) => {
                        const target = e.currentTarget;
                        if (target.options.length <= 1) {
                          try {
                            const devices = await navigator.mediaDevices.enumerateDevices();
                            const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
                            const currentVal = target.value;
                            target.innerHTML = '<option value="">Default System Output</option>';
                            audioOutputs.forEach(d => {
                              const opt = document.createElement('option');
                              opt.value = d.deviceId;
                              opt.text = d.label || `Speaker ${d.deviceId.slice(0, 5)}...`;
                              target.appendChild(opt);
                            });
                            target.value = currentVal;
                          } catch(err) {}
                        }
                      }}
                    >
                      <option value="">Default System Output</option>
                      {settings.audioOutputId && <option value={settings.audioOutputId}>Selected Audio Output</option>}
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                      <label className="flex justify-between text-[8px] font-mono text-white/80">
                        <span>MEDIA MASTER VOL</span><span>{Math.round((settings.mediaVolume ?? 1.0) * 100)}%</span>
                      </label>
                      <input 
                        type="range" min="0" max="1" step="0.05" 
                        value={settings.mediaVolume ?? 1.0} 
                        onChange={(e) => updateSetting('mediaVolume', parseFloat(e.target.value))} 
                        className="w-full h-1 accent-white" 
                      />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      if (window.electronAPI?.openProjection) {
                        window.electronAPI.openProjection('prompter');
                      } else {
                        window.open(`${window.location.origin}${window.location.pathname}?view=prompter`, 'prompter', 'menubar=no,toolbar=no,location=no,status=no,width=1920,height=1080');
                      }
                    }}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-brand-gold/50 hover:bg-white/10 transition-all text-center group h-full"
                  >
                    <div className="w-12 h-12 rounded-full bg-black/50 border border-brand-gold/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MonitorPlay size={20} className="text-white/70 group-hover:text-brand-gold" />
                    </div>
                    <div>
                      <h4 className="text-[12px] font-bold text-white uppercase tracking-wider leading-tight">Prompter <br />Window</h4>
                    </div>
                  </button>
                  <button 
                    onClick={(e) => {
                      const url = `${window.location.origin}${window.location.pathname}?view=prompter`;
                      navigator.clipboard.writeText(url);
                      const el = e.currentTarget.querySelector('span');
                      if(el) { el.innerText = 'COPIED!'; setTimeout(() => el.innerText = 'COPY BROWSER URL', 2000); }
                    }}
                    className="flex justify-center items-center gap-1.5 text-[9px] font-bold text-white/30 hover:text-brand-gold transition-colors py-2 bg-white/5 rounded-lg"
                  >
                    <Copy size={10} /> <span>COPY BROWSER URL</span>
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      if (window.electronAPI?.openProjection) {
                        window.electronAPI.openProjection('visuals');
                      } else {
                        window.open(`${window.location.origin}${window.location.pathname}?view=visuals`, 'visuals', 'menubar=no,toolbar=no,location=no,status=no,width=1920,height=1080');
                      }
                    }}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-brand-gold/50 hover:bg-white/10 transition-all text-center group h-full"
                  >
                    <div className="w-12 h-12 rounded-full bg-black/50 border border-[#ff0055]/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ExternalLink size={20} className="text-white/70 group-hover:text-[#ff0055]" />
                    </div>
                    <div>
                      <h4 className="text-[12px] font-bold text-white uppercase tracking-wider leading-tight">Visuals <br />Output</h4>
                    </div>
                  </button>
                  <button 
                    onClick={(e) => {
                      const url = `${window.location.origin}${window.location.pathname}?view=visuals`;
                      navigator.clipboard.writeText(url);
                      const el = e.currentTarget.querySelector('span');
                      if(el) { el.innerText = 'COPIED!'; setTimeout(() => el.innerText = 'COPY BROWSER URL', 2000); }
                    }}
                    className="flex justify-center items-center gap-1.5 text-[9px] font-bold text-white/30 hover:text-[#ff0055] transition-colors py-2 bg-white/5 rounded-lg"
                  >
                    <Copy size={10} /> <span>COPY BROWSER URL</span>
                  </button>
                </div>
              </div>

              <div className="p-3 border border-brand-gold/20 bg-brand-gold/5 text-brand-gold rounded-xl space-y-2">
                <p className="text-[10px] leading-relaxed font-mono uppercase tracking-wide opacity-90 border-b border-brand-gold/10 pb-2">
                  <strong>Method 1: Windows Projecting</strong><br/>
                  Click the large window buttons to launch a clean feed. Drag this window to your projector or capture it using OBS "Window Capture". (Recommended for perfect sync).
                </p>
                <p className="text-[10px] leading-relaxed font-mono uppercase tracking-wide opacity-90">
                  <strong>Method 2: Directly via URL</strong><br/>
                  Copy the URL to load as a direct hardware input or OBS Browser Source.
                </p>
              </div>

              <button 
                onClick={handleManualSync}
                className="w-full py-3 flex items-center justify-center gap-2 text-[10px] uppercase font-mono text-white/50 bg-black/40 rounded-xl border border-white/10 hover:text-white hover:border-brand-gold/50 transition-all"
              >
                <RotateCcw size={14} /> Force Sync to Windows
              </button>
            </section>

            {/* Custom Color Overrides for Prompter */}
            <section className="space-y-3">
              <h3 className="input-label m-0">Prompter Mode Settings</h3>
              <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
                 <button 
                  onClick={() => updateSetting('prompterBgColor', '#000000')} 
                  className={`flex-1 py-1 text-[9px] rounded flex items-center justify-center gap-2 ${settings.prompterBgColor === '#000000' ? 'bg-white/10' : ''}`}
                 >
                   <div className="w-2 h-2 rounded-full bg-black border border-white/20" /> Black
                 </button>
                 <button 
                  onClick={() => updateSetting('prompterBgColor', '#00ff00')} 
                  className={`flex-1 py-1 text-[9px] rounded flex items-center justify-center gap-2 ${settings.prompterBgColor === '#00ff00' ? 'bg-white/10' : ''}`}
                 >
                   <div className="w-2 h-2 rounded-full bg-green-500" /> Green Screen
                 </button>
              </div>
            </section>

            {/* Stage Visual Sensitivity */}
            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="input-label m-0">Visual Reactivity</h3>
                <span className="text-[9px] font-mono text-brand-gold">{Math.round(settings.audioReactivity * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={settings.audioReactivity} 
                onChange={(e) => updateSetting('audioReactivity', parseFloat(e.target.value))} 
                className="w-full accent-brand-gold h-1" 
              />
            </section>

            {/* File Configuration Section (Removed redundant, merged into Library Local view) */}
            <section className="space-y-3 opacity-50">
               <h3 className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Quick Local Fallback</h3>
               <div className="flex gap-2">
                 <button onClick={() => setLibraryView('local')} className="flex-1 py-2 bg-white/5 border border-white/10 rounded-lg text-[9px] uppercase font-bold hover:text-brand-gold">Access Local Library</button>
               </div>
            </section>

            {/* Lyrics Designer */}
            <section className="space-y-4">
              <h3 className="input-label m-0 flex items-center gap-2"><Palette size={14} /> Aesthetics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                   <select
                     value={settings.fontFamily}
                     onChange={(e) => updateSetting('fontFamily', e.target.value)}
                     className="w-full h-10 bg-black/40 border border-white/10 rounded-lg text-xs px-3"
                   >
                     <option value="Inter">Sans Serif (Inter)</option>
                     <option value="Outfit">Grotesk (Outfit)</option>
                     <option value="JetBrains Mono">Monospace</option>
                   </select>
                </div>
                <div>
                   <input type="range" min="16" max="72" value={settings.fontSize} onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))} className="w-full accent-brand-gold" />
                </div>
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
                   <button onClick={() => updateSetting('lyricsPosition', 'bottom')} className={`flex-1 py-1 text-[10px] rounded ${settings.lyricsPosition === 'bottom' ? 'bg-white/10' : ''}`}>Bottom</button>
                   <button onClick={() => updateSetting('lyricsPosition', 'center')} className={`flex-1 py-1 text-[10px] rounded ${settings.lyricsPosition === 'center' ? 'bg-white/10' : ''}`}>Center</button>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'maker' && (
          <div className="space-y-6">
             {!isReviewingMaker ? (
               <>
                 <div className="p-4 bg-brand-gold/5 rounded-xl border border-brand-gold/10">
                    <h4 className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-2">1. Paste Raw Text</h4>
                    <textarea 
                       placeholder="Paste lyrics line-by-line here..."
                       className="w-full h-32 bg-black/40 border border-white/10 rounded-lg text-[10px] p-3 focus:outline-none focus:border-brand-gold font-mono leading-relaxed"
                       onChange={(e) => {
                         const lines = e.target.value.split('\n').filter(l => l.trim());
                         setMakerLines(lines);
                       }}
                    />
                 </div>

                 <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                    <h4 className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-3">2. Capture Timing</h4>
                    <p className="text-[10px] text-white/40 italic mb-4">Spacebar or button to mark start.</p>
                    
                    <div className="bg-black/40 p-3 rounded-lg border border-white/5 mb-4 max-h-48 overflow-y-auto custom-scrollbar">
                       {makerLines.map((line, i) => (
                          <div key={i} className={`text-[10px] py-1 border-b border-white/5 last:border-0 ${i === makerStep ? 'text-brand-gold font-bold bg-brand-gold/5' : i < makerStep ? 'text-green-500 opacity-50' : 'text-white/20'}`}>
                             {i < makerStep ? "✓ " : i === makerStep ? "> " : "• "}{line}
                          </div>
                       ))}
                    </div>

                    <div className="flex gap-3">
                      <button 
                        disabled={makerStep >= makerLines.length || !playbackState.isPlaying}
                        onClick={handleMakerCapture}
                        className="flex-1 py-4 bg-brand-gold text-black font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all"
                      >
                        {makerStep >= makerLines.length ? 'COMPLETE' : 'RECORD MARKER'}
                      </button>
                      <button onClick={() => { setMakerStep(0); setMakerResults([]); }} className="w-12 h-14 border border-white/10 flex items-center justify-center rounded-xl text-white/40 hover:text-white transition-colors">
                        <RotateCcw size={16} />
                      </button>
                    </div>
                 </div>
               </>
             ) : (
               <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">3. Validation & Tuning</h4>
                    <button onClick={() => setIsReviewingMaker(false)} className="text-[9px] font-mono text-white/40 hover:text-white">BACK</button>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {makerResults.map((res, i) => (
                      <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-3">
                        <div className="text-[11px] font-medium text-white/80 italic">"{res.text}"</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-mono text-white/20 uppercase">Start (s)</label>
                            <input 
                              type="number" 
                              step="0.1"
                              value={res.startTime.toFixed(2)} 
                              onChange={(e) => {
                                const newResults = [...makerResults];
                                newResults[i].startTime = parseFloat(e.target.value);
                                setMakerResults(newResults);
                              }}
                              className="w-full bg-black/40 border border-white/5 rounded p-1 text-[10px] font-mono text-brand-gold focus:border-brand-gold/50 outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-mono text-white/20 uppercase">End (s)</label>
                            <input 
                              type="number" 
                              step="0.1"
                              value={res.endTime.toFixed(2)} 
                              onChange={(e) => {
                                const newResults = [...makerResults];
                                newResults[i].endTime = parseFloat(e.target.value);
                                setMakerResults(newResults);
                              }}
                              className="w-full bg-black/40 border border-white/5 rounded p-1 text-[10px] font-mono text-white/60 focus:border-brand-gold/50 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={finalizeFromResults}
                    className="w-full py-4 bg-green-500 text-black font-black text-xs rounded-xl shadow-lg shadow-green-500/20 active:scale-95 transition-all mt-4"
                  >
                    FINALIZE & SAVE PRODUCTION SYNC
                  </button>
               </div>
             )}
          </div>
        )}
      </div>

      <div className="p-6 bg-white/5 border-t border-white/10">
         <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Persistence Status</span>
            <span className="text-[10px] font-mono text-green-400">Local Auto-Save Active</span>
         </div>
      </div>
    </div>
  );
}
