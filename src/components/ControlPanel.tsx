import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KaraokeSettings, KaraokeSession, SongQueueItem } from '../types';
import { Settings, Video, Music, Image as ImageIcon, Type, Palette, AlignCenter, Layout, Eye, EyeOff, Timer, RotateCcw, ListMusic, Search, Trash2, Plus, Play, Layers, LogOut, Chrome } from 'lucide-react';
import { analyzeAudio } from '../lib/audioAnalysis';
import { searchKaraoke, SearchResult, getPlaylistItems } from '../services/youtubeSearchService';

interface ControlPanelProps {
  settings: KaraokeSettings;
  setSettings: (s: KaraokeSettings) => void;
  session: KaraokeSession;
  setSession: React.Dispatch<React.SetStateAction<KaraokeSession>>;
  onParseLyrics: (content: string) => void;
  onMediaUpload: (type: string, file: File, url: string) => void;
  playbackState: { currentTime: number; phase: any; isPlaying: boolean; duration: number };
  localFiles?: File[];
}

export default function ControlPanel({
  settings,
  setSettings,
  session,
  setSession,
  onParseLyrics,
  onMediaUpload,
  playbackState,
  localFiles = []
}: ControlPanelProps) {

  const [activeTab, setActiveTab] = React.useState<'config' | 'maker' | 'queue' | 'search' | 'local' | 'visual'>('queue');
  const [makerLyrics, setMakerLyrics] = React.useState<string>("");
  const [makerLines, setMakerLines] = React.useState<string[]>([]);
  const [makerStep, setMakerStep] = React.useState(0);
  const [ytUrl, setYtUrl] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [userAuth, setUserAuth] = React.useState<{ accessToken: string; expiry: number } | null>(() => {
    const saved = localStorage.getItem('google_auth');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (Date.now() > parsed.expiry) {
      localStorage.removeItem('google_auth');
      return null;
    }
    return parsed;
  });
  const [queue, setQueue] = React.useState<SongQueueItem[]>(() => {
    const saved = localStorage.getItem('karaoke_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [fragmentShader, setFragmentShader] = React.useState<string>(`
    precision mediump float;
    uniform float iTime;
    uniform vec2 iResolution;
    uniform vec3 iAudioLow;
    uniform vec3 iAudioMid;
    uniform vec3 iAudioHigh;

    void main() {
      vec2 uv = gl_FragCoord.xy / iResolution.xy;
      uv = uv * 2.0 - 1.0;
      uv.x *= iResolution.x / iResolution.y;

      vec3 color = vec3(0.0);
      color.r = iAudioLow.x * 0.5 + sin(iTime + uv.x * 10.0) * 0.1;
      color.g = iAudioMid.y * 0.5 + cos(iTime + uv.y * 8.0) * 0.1;
      color.b = iAudioHigh.z * 0.5 + sin(iTime * 2.0 + length(uv) * 5.0) * 0.1;

      float pattern = sin(uv.x * 20.0 + iTime) * sin(uv.y * 20.0 + iTime);
      color += vec3(pattern * 0.1);

      gl_FragColor = vec4(color, 1.0);
    }
  `);

  React.useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) return;

      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const tokens = event.data.payload;
        const expiry = Date.now() + (tokens.expires_in * 1000);
        const authData = { accessToken: tokens.access_token, expiry };
        setUserAuth(authData);
        localStorage.setItem('google_auth', JSON.stringify(authData));
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const resp = await fetch('/api/auth/google/url');
      const { url } = await resp.json();
      window.open(url, 'google_oauth', 'width=600,height=700');
    } catch (e) {
      console.error("Auth error:", e);
    }
  };

  const handleGoogleLogout = () => {
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

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setSearchResults([]); 
    const results = await searchKaraoke(searchQuery, userAuth?.accessToken);
    setSearchResults(results);
    setIsSearching(false);
  };

  const addToQueue = async (item: SearchResult) => {
    if (item.isPlaylist) {
      const items = await getPlaylistItems(item.id, userAuth?.accessToken);
      const newItems: SongQueueItem[] = items.map(res => ({
        id: Math.random().toString(36).substr(2, 9),
        title: res.title,
        mediaUrl: `https://www.youtube.com/watch?v=${res.id}`,
        lyrics: [],
        isYouTube: true
      }));
      saveQueue([...queue, ...newItems]);
    } else {
      const newItem: SongQueueItem = {
        id: Math.random().toString(36).substr(2, 9),
        title: item.title,
        mediaUrl: `https://www.youtube.com/watch?v=${item.id}`,
        lyrics: [],
        isYouTube: true
      };
      saveQueue([...queue, newItem]);
    }
    setActiveTab('queue');
  };

  const loadFromQueue = (item: SongQueueItem) => {
    setSession(prev => ({
      ...prev,
      mediaUrl: item.mediaUrl,
      lyrics: item.lyrics,
      isAudioOnly: false,
      bpm: item.bpm || null,
      musicalKey: item.musicalKey || null
    }));
    
    onParseLyrics(item.lyrics.map(l => `[${formatTime(l.startTime)}-${formatTime(l.endTime)}] ${l.text}`).join('\n'));

    const bc = new BroadcastChannel('karaoke-sync');
    bc.postMessage({ type: 'MEDIA_SYNC', payload: { mediaType: 'mediaUrl', isYt: item.isYouTube, url: item.mediaUrl } });
    bc.postMessage({ type: 'LYRICS_SYNC', payload: item.lyrics });
    bc.close();
  };

  const removeFromQueue = (id: string) => {
    saveQueue(queue.filter(q => q.id !== id));
  };

  const handleYtSubmit = () => {
    if (!ytUrl) return;
    setSession(prev => ({ ...prev, mediaUrl: ytUrl, isAudioOnly: false }));
    const bc = new BroadcastChannel('karaoke-sync');
    bc.postMessage({ type: 'MEDIA_SYNC', payload: { mediaType: 'mediaUrl', isYt: true, url: ytUrl } });
    bc.close();
  };

  const handleMakerCapture = () => {
    const time = playbackState.currentTime;
    const line = makerLines[makerStep];
    if (!line) return;
    const endTime = time + 5; 
    const formatted = `[${formatTime(time)}-${formatTime(endTime)}] ${line}`;
    setMakerLyrics(prev => prev + (prev ? "\n" : "") + formatted);
    setMakerStep(s => s + 1);
  };

  const finalizeMaker = () => {
    onParseLyrics(makerLyrics);
    const bc = new BroadcastChannel('karaoke-sync');
    bc.postMessage({ type: 'LYRICS_SYNC', payload: session.lyrics });
    bc.close();
    setActiveTab('config');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const nextLyric = session.lyrics.find(l => l.startTime > playbackState.currentTime);

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
            const bc = new BroadcastChannel('karaoke-sync');
            bc.postMessage({ type: 'LYRICS_SYNC', payload: parsed });
            bc.close();
         });
       };
       reader.readAsText(file);
    } else {
       const url = URL.createObjectURL(file);
       onMediaUpload(type as string, file, url);
       const bc = new BroadcastChannel('karaoke-sync');
       bc.postMessage({ type: 'MEDIA_SYNC', payload: { mediaType: type, file } });
       bc.close();
       if (type === 'mediaUrl') {
         const { bpm, key } = await analyzeAudio(url);
         setSession(prev => ({ ...prev, mediaUrl: url, bpm, musicalKey: key }));
       }
    }
  };

  const updateSetting = (key: keyof KaraokeSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('karaoke_settings', JSON.stringify(newSettings));
  };

  const handleManualSync = () => {
    const bc = new BroadcastChannel('karaoke-sync');
    bc.postMessage({ type: 'SETTINGS_SYNC', payload: settings });
    bc.postMessage({ type: 'LYRICS_SYNC', payload: session.lyrics });
    bc.close();
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
          <button 
            onClick={loadSample}
            className="w-8 h-8 rounded border border-white/10 flex items-center justify-center text-white/20 hover:text-brand-gold hover:border-brand-gold/50 transition-colors"
            title="Load Sample Script"
          >
            <Music size={14} />
          </button>
          <button 
            onClick={() => updateSetting('isPresentationMode', !settings.isPresentationMode)}
            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-all shadow-sm ${settings.isPresentationMode ? 'bg-brand-gold text-black border-brand-gold' : 'border-white/10 text-white/40 hover:border-white/30'}`}
            title={settings.isPresentationMode ? "Exit Presentation Mode" : "Enter Presentation Mode"}
          >
            {settings.isPresentationMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Mode Selectors */}
      <div className="px-4 flex border-b border-white/5 scroll-x-auto">
        {(['queue', 'search', 'local', 'visual', 'config', 'maker'] as const).map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-[9px] font-mono uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === tab ? 'border-brand-gold text-brand-gold' : 'border-transparent text-white/30'}`}
          >
            {tab === 'queue' && <ListMusic size={12} />}
            {tab === 'search' && <Search size={12} />}
            {tab === 'local' && <Video size={12} />}
            {tab === 'visual' && <Palette size={12} />}
            {tab === 'config' && <Settings size={12} />}
            {tab === 'maker' && <Type size={12} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-12 custom-scrollbar">
        {activeTab === 'queue' && (
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="input-label m-0 flex items-center gap-2 underline decoration-brand-gold/30">Playlist Queue</h3>
                <span className="text-[10px] font-mono text-white/20">{queue.length} Tracks</span>
              </div>
              
              {queue.length === 0 ? (
                <div className="p-8 border border-dashed border-white/5 rounded-2xl flex flex-col items-center gap-3 text-center">
                  <ListMusic size={32} className="text-white/10" />
                  <p className="text-[10px] text-white/20 uppercase tracking-widest font-mono">Queue is empty</p>
                  <button onClick={() => setActiveTab('search')} className="text-[10px] text-brand-gold border border-brand-gold/20 px-3 py-1 rounded-full hover:bg-brand-gold/5 transition-colors">Start Searching</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((item, i) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl hover:border-brand-gold/30 transition-all group flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-[10px] font-bold text-white/30">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white/90 truncate">{item.title}</p>
                        <p className="text-[9px] font-mono text-white/30 truncate">{item.isYouTube ? 'YouTube Source' : 'Local Source'}</p>
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
                  ))}
                </div>
              )}
           </div>
        )}

        {activeTab === 'search' && (
          <div className="space-y-6">
            {!userAuth ? (
              <div className="p-4 bg-brand-gold/5 border border-brand-gold/10 rounded-2xl flex flex-col items-center gap-3 text-center">
                <Chrome size={24} className="text-brand-gold" />
                <div>
                  <h4 className="text-[11px] font-bold text-white mb-1">Instant YouTube Access</h4>
                  <p className="text-[9px] text-white/40 leading-relaxed">Sign in with Google to search karaoke tracks and import playlists instantly without any manual setup.</p>
                </div>
                <button 
                  onClick={handleGoogleLogin}
                  className="w-full h-9 bg-brand-gold text-black text-[10px] font-bold rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Chrome size={14} /> SIGN IN WITH GOOGLE
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center text-brand-gold">
                    <Chrome size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase tracking-wider">Authorized</p>
                    <p className="text-[8px] font-mono text-white/30 uppercase">Direct Search Engine Ready</p>
                  </div>
                </div>
                <button 
                  onClick={handleGoogleLogout}
                  className="p-2 text-white/20 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="input-label m-0">Unified YouTube Search</h3>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                  <input 
                     type="text"
                     placeholder="Search Artist, Song or 'Karaoke'..."
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
              <div className="py-20 flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-brand-gold/20 border-t-brand-gold rounded-full animate-spin" />
                <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest text-center">Consulting AI for song metadata...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.length > 0 && (
                   <div className="space-y-3">
                     {searchResults.map((res) => (
                       <motion.div 
                         key={res.id}
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         className="flex gap-3 p-3 bg-white/5 border border-white/5 rounded-xl hover:border-brand-gold/20 transition-all"
                       >
                         <div className="relative w-20 h-14 bg-black/40 rounded-lg overflow-hidden border border-white/5 shrink-0">
                           <img 
                             src={res.thumbnail} 
                             className="w-full h-full object-cover" 
                             referrerPolicy="no-referrer"
                             onError={(e) => {
                               const target = e.target as HTMLImageElement;
                               if (target.src.includes('hqdefault.jpg')) {
                                 target.src = `https://i.ytimg.com/vi/${res.id}/mqdefault.jpg`;
                               } else if (target.src.includes('mqdefault.jpg')) {
                                 target.src = `https://i.ytimg.com/vi/${res.id}/0.jpg`;
                               } else {
                                 // Final fallback to a generic music icon if all YT thumbnails fail
                                 target.style.display = 'none';
                                 const parent = target.parentElement;
                                 if (parent) {
                                   const icon = document.createElement('div');
                                   icon.className = "w-full h-full flex items-center justify-center bg-white/5 text-white/20";
                                   icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
                                   parent.appendChild(icon);
                                 }
                               }
                             }}
                           />
                           <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                           {res.isPlaylist && (
                             <div className="absolute top-1 right-1 bg-brand-gold/90 text-black p-0.5 rounded shadow-lg">
                               <Layers size={10} />
                             </div>
                           )}
                         </div>
                         <div className="flex-1 min-w-0 flex flex-col justify-between">
                           <p className="text-[10px] font-bold text-white/80 line-clamp-2 leading-tight">{res.title}</p>
                           <div className="flex gap-2">
                             <button 
                               onClick={() => {
                                 setYtUrl(`https://www.youtube.com/watch?v=${res.id}`);
                                 handleYtSubmit();
                               }}
                               className="text-[9px] font-bold text-brand-gold hover:underline"
                             >
                               LOAD NOW
                             </button>
                             <button 
                               onClick={() => addToQueue(res)}
                               className={`text-[9px] font-bold ${res.isPlaylist ? 'text-brand-gold' : 'text-white/40'} hover:text-white flex items-center gap-1`}
                             >
                               {res.isPlaylist ? <><Layers size={10} /> ENQUEUE PLAYLIST</> : <><Plus size={10} /> ENQUEUE</>}
                             </button>
                           </div>
                         </div>
                       </motion.div>
                     ))}
                   </div>
                )}
                {searchQuery === "" && (
                  <div className="space-y-4">
                    <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest block">Quick Channels</span>
                    <div className="grid grid-cols-2 gap-2">
                      {['Sing King', 'KaraokeOnYT', 'Karaoke Version', 'Sunfly Karaoke'].map(target => (
                        <button 
                          key={target}
                          onClick={() => { setSearchQuery(target + " "); handleSearch(); }}
                          className="p-2 bg-white/5 border border-white/10 rounded-lg text-center text-[10px] text-white/40 hover:text-brand-gold hover:border-brand-gold/40 transition-all font-mono"
                        >
                          {target}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'visual' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="input-label m-0 flex items-center gap-2 underline decoration-brand-gold/30">Shadertoy Visual Designer</h3>
              <span className="text-[10px] font-mono text-white/20">GLSL Editor</span>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-black/40 border border-white/10 rounded-xl">
                <label className="block text-[10px] font-mono text-white/60 uppercase tracking-widest mb-2">Fragment Shader Code</label>
                <textarea
                  value={fragmentShader}
                  onChange={(e) => {
                    setFragmentShader(e.target.value);
                    // Broadcast to all views
                    const bc = new BroadcastChannel('karaoke-sync');
                    bc.postMessage({ type: 'SHADER_UPDATE', payload: e.target.value });
                    bc.close();
                  }}
                  className="w-full h-64 bg-black/60 border border-white/10 rounded-lg p-3 text-[11px] font-mono text-green-400 focus:outline-none focus:border-brand-gold resize-none"
                  placeholder="Write your GLSL fragment shader here..."
                />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    localStorage.setItem('karaoke_shader', fragmentShader);
                    // Show success feedback
                  }}
                  className="px-3 py-2 bg-green-600/20 border border-green-600/40 rounded text-[10px] text-green-400 hover:bg-green-600/30 transition-all font-mono"
                >
                  Save Shader
                </button>
                <button
                  onClick={() => {
                    const saved = localStorage.getItem('karaoke_shader');
                    if (saved) {
                      setFragmentShader(saved);
                      const bc = new BroadcastChannel('karaoke-sync');
                      bc.postMessage({ type: 'SHADER_UPDATE', payload: saved });
                      bc.close();
                    }
                  }}
                  className="px-3 py-2 bg-blue-600/20 border border-blue-600/40 rounded text-[10px] text-blue-400 hover:bg-blue-600/30 transition-all font-mono"
                >
                  Load Shader
                </button>
                <button
                  onClick={() => {
                    const defaultShader = `
precision mediump float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec3 iAudioLow;
uniform vec3 iAudioMid;
uniform vec3 iAudioHigh;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  uv = uv * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  vec3 color = vec3(0.0);
  color.r = iAudioLow.x * 0.5 + sin(iTime + uv.x * 10.0) * 0.1;
  color.g = iAudioMid.y * 0.5 + cos(iTime + uv.y * 8.0) * 0.1;
  color.b = iAudioHigh.z * 0.5 + sin(iTime * 2.0 + length(uv) * 5.0) * 0.1;

  float pattern = sin(uv.x * 20.0 + iTime) * sin(uv.y * 20.0 + iTime);
  color += vec3(pattern * 0.1);

  gl_FragColor = vec4(color, 1.0);
}`;
                    setFragmentShader(defaultShader);
                    const bc = new BroadcastChannel('karaoke-sync');
                    bc.postMessage({ type: 'SHADER_UPDATE', payload: defaultShader });
                    bc.close();
                  }}
                  className="px-3 py-2 bg-red-600/20 border border-red-600/40 rounded text-[10px] text-red-400 hover:bg-red-600/30 transition-all font-mono"
                >
                  Reset
                </button>
              </div>
                <button
                  onClick={() => {
                    const defaultShader = `
precision mediump float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec3 iAudioLow;
uniform vec3 iAudioMid;
uniform vec3 iAudioHigh;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  uv = uv * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  vec3 color = vec3(0.0);
  color.r = iAudioLow.x * 0.5 + sin(iTime + uv.x * 10.0) * 0.1;
  color.g = iAudioMid.y * 0.5 + cos(iTime + uv.y * 8.0) * 0.1;
  color.b = iAudioHigh.z * 0.5 + sin(iTime * 2.0 + length(uv) * 5.0) * 0.1;

  float pattern = sin(uv.x * 20.0 + iTime) * sin(uv.y * 20.0 + iTime);
  color += vec3(pattern * 0.1);

  gl_FragColor = vec4(color, 1.0);
}`;
                    setFragmentShader(defaultShader);
                    const bc = new BroadcastChannel('karaoke-sync');
                    bc.postMessage({ type: 'SHADER_UPDATE', payload: defaultShader });
                    bc.close();
                  }}
                  className="p-3 bg-white/5 border border-white/10 rounded-lg text-center text-[10px] text-white/60 hover:text-brand-gold hover:border-brand-gold/40 transition-all font-mono"
                >
                  Audio Reactive Waves
                </button>

                <button
                  onClick={() => {
                    const tunnelShader = `
precision mediump float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec3 iAudioLow;
uniform vec3 iAudioMid;
uniform vec3 iAudioHigh;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
  
  float audio = (iAudioLow.x + iAudioMid.y + iAudioHigh.z) / 3.0;
  float radius = length(uv) + audio * 0.5;
  float angle = atan(uv.y, uv.x);
  
  vec3 color = vec3(0.0);
  color.r = sin(radius * 10.0 - iTime * 2.0 + angle * 3.0) * 0.5 + 0.5;
  color.g = sin(radius * 8.0 - iTime * 1.5 + angle * 2.0) * 0.5 + 0.5;
  color.b = sin(radius * 12.0 - iTime * 2.5 + angle * 4.0) * 0.5 + 0.5;
  
  color *= 1.0 - radius * 0.5;
  gl_FragColor = vec4(color, 1.0);
}`;
                    setFragmentShader(tunnelShader);
                    const bc = new BroadcastChannel('karaoke-sync');
                    bc.postMessage({ type: 'SHADER_UPDATE', payload: tunnelShader });
                    bc.close();
                  }}
                  className="p-3 bg-white/5 border border-white/10 rounded-lg text-center text-[10px] text-white/60 hover:text-brand-gold hover:border-brand-gold/40 transition-all font-mono"
                >
                  Audio Tunnel
                </button>

                <button
                  onClick={() => {
                    const fractalShader = `
precision mediump float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec3 iAudioLow;
uniform vec3 iAudioMid;
uniform vec3 iAudioHigh;

vec3 palette(float t) {
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.5, 0.5, 0.5);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.263, 0.416, 0.557);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;
  vec2 uv0 = uv;
  vec3 finalColor = vec3(0.0);
  
  float audio = (iAudioLow.x + iAudioMid.y + iAudioHigh.z) / 3.0;
  
  for(float i = 0.0; i < 4.0; i++) {
    uv = fract(uv * 1.5) - 0.5;
    
    float d = length(uv) * exp(-length(uv0));
    vec3 col = palette(length(uv0) + i * 0.4 + iTime * 0.4);
    
    d = sin(d * 8.0 + iTime) / 8.0;
    d = abs(d);
    d = pow(0.01 / d, 1.2);
    
    finalColor += col * d * (audio + 0.2);
  }
  
  gl_FragColor = vec4(finalColor, 1.0);
}`;
                    setFragmentShader(fractalShader);
                    const bc = new BroadcastChannel('karaoke-sync');
                    bc.postMessage({ type: 'SHADER_UPDATE', payload: fractalShader });
                    bc.close();
                  }}
                  className="p-3 bg-white/5 border border-white/10 rounded-lg text-center text-[10px] text-white/60 hover:text-brand-gold hover:border-brand-gold/40 transition-all font-mono"
                >
                  Fractal Vortex
                </button>

                <button
                  onClick={() => {
                    const particleShader = `
precision mediump float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec3 iAudioLow;
uniform vec3 iAudioMid;
uniform vec3 iAudioHigh;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  vec3 color = vec3(0.0);

  float audio = (iAudioLow.x + iAudioMid.y + iAudioHigh.z) / 3.0;
  
  for(int i = 0; i < 100; i++) {
    vec2 pos = vec2(
      random(vec2(float(i), 0.0)) + sin(iTime * 0.5 + float(i)) * 0.1,
      random(vec2(float(i), 1.0)) + cos(iTime * 0.3 + float(i)) * 0.1
    );
    float dist = distance(uv, pos);
    float size = audio * 0.05 + 0.005;
    vec3 particleColor = vec3(
      random(vec2(float(i), 2.0)),
      random(vec2(float(i), 3.0)),
      random(vec2(float(i), 4.0))
    );
    color += particleColor * (1.0 - smoothstep(0.0, size, dist));
  }

  gl_FragColor = vec4(color, 1.0);
}`;
                    setFragmentShader(particleShader);
                    const bc = new BroadcastChannel('karaoke-sync');
                    bc.postMessage({ type: 'SHADER_UPDATE', payload: particleShader });
                    bc.close();
                  }}
                  className="p-3 bg-white/5 border border-white/10 rounded-lg text-center text-[10px] text-white/60 hover:text-brand-gold hover:border-brand-gold/40 transition-all font-mono"
                >
                  Dancing Particles
                </button>
              </div>

              <div className="p-3 bg-black/40 border border-white/10 rounded-lg">
                <h4 className="text-[10px] font-mono text-white/60 uppercase tracking-widest mb-2">Available Uniforms</h4>
                <div className="text-[9px] font-mono text-white/40 space-y-1">
                  <div><span className="text-cyan-400">uniform float iTime;</span> - Time in seconds</div>
                  <div><span className="text-cyan-400">uniform vec2 iResolution;</span> - Canvas resolution</div>
                  <div><span className="text-cyan-400">uniform vec3 iAudioLow;</span> - Low frequency data (0-1)</div>
                  <div><span className="text-cyan-400">uniform vec3 iAudioMid;</span> - Mid frequency data (0-1)</div>
                  <div><span className="text-cyan-400">uniform vec3 iAudioHigh;</span> - High frequency data (0-1)</div>
                </div>
              </div>
            </div>
          </div>
        )}

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

            {/* YouTube Integration */}
            <section className="space-y-4">
               <h3 className="input-label flex items-center gap-2 m-0"><Layout size={14} className="text-brand-gold" /> YouTube Support</h3>
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   placeholder="Paste YouTube music link..." 
                   value={ytUrl}
                   onChange={(e) => setYtUrl(e.target.value)}
                   className="flex-1 h-10 bg-black/40 border border-white/10 rounded-lg text-[10px] px-3 focus:outline-none focus:border-brand-gold font-mono"
                 />
                 <button 
                   onClick={handleYtSubmit}
                   className="px-4 h-10 bg-brand-gold text-black text-[10px] font-bold rounded-lg hover:scale-105 transition-transform"
                 >
                   LOAD
                 </button>
               </div>
            </section>

            {/* Singer Monitor */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="input-label flex items-center gap-2 m-0"><Layout size={14} className="text-brand-gold" /> Singer Monitor</h3>
                 <div className="flex items-center gap-3">
                   <button 
                     onClick={handleManualSync}
                     className="text-[9px] font-mono text-brand-gold hover:text-white transition-colors bg-brand-gold/5 px-2 py-1 rounded border border-brand-gold/20"
                   >
                     RE-SYNC
                   </button>
                   <a 
                     href={`${window.location.origin}${window.location.pathname}?view=singer`} 
                     target="_blank" 
                     rel="noreferrer"
                     className="text-[9px] font-mono text-brand-gold underline"
                   >
                     OPEN VIEW
                   </a>
                 </div>
              </div>
            </section>

            {/* File Configuration */}
            <section className="space-y-4">
              <h3 className="input-label m-0 flex items-center gap-2"><Layout size={14} /> File Discovery</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-mono text-white/60">Bumper Clip</span>
                    <label className="h-12 border border-dashed border-white/20 rounded-lg flex items-center justify-center hover:border-brand-gold/50 cursor-pointer transition-colors">
                      <Video size={16} className={session.bumperUrl ? 'text-brand-gold' : 'text-white/30'} />
                      <input type="file" className="hidden" accept="video/*" onChange={handleFileUpload('bumperUrl')} />
                    </label>
                 </div>
                 <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-mono text-white/60">Local Media</span>
                    <label className="h-12 border border-dashed border-white/20 rounded-lg flex items-center justify-center hover:border-brand-gold/50 cursor-pointer transition-colors">
                      <Music size={16} className={session.mediaUrl && !session.mediaUrl?.includes('youtube') ? 'text-brand-gold' : 'text-white/30'} />
                      <input type="file" className="hidden" accept="video/*,audio/*" onChange={handleFileUpload('mediaUrl')} />
                    </label>
                 </div>
                 <div className="col-span-2 flex flex-col gap-2">
                    <label className="h-12 border border-dashed border-white/20 rounded-lg flex items-center justify-center hover:border-brand-gold/50 cursor-pointer px-4 gap-2">
                      <Type size={16} className="text-white/30" />
                      <span className="text-[10px] text-white/40">Upload Lyrics...</span>
                      <input type="file" className="hidden" accept=".txt,.lrc" onChange={handleFileUpload('lyrics' as any)} />
                    </label>
                 </div>
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
             <div className="p-4 bg-brand-gold/5 rounded-xl border border-brand-gold/10">
                <h4 className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-2">1. Paste Raw Text</h4>
                <textarea 
                   placeholder="Paste lyrics line-by-line here..."
                   className="w-full h-32 bg-black/40 border border-white/10 rounded-lg text-[10px] p-3 focus:outline-none focus:border-brand-gold font-mono leading-relaxed"
                   onChange={(e) => setMakerLines(e.target.value.split('\n').filter(l => l.trim()))}
                />
             </div>

             <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
                <h4 className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-3">2. Capture Timing</h4>
                <p className="text-[10px] text-white/40 italic mb-4">Click RECORD MARKER when each line starts.</p>
                
                <div className="bg-black/40 p-3 rounded-lg border border-white/5 mb-4 max-h-32 overflow-y-auto custom-scrollbar">
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
                    className="flex-1 py-4 bg-brand-gold text-black font-bold text-xs rounded-xl shadow-lg"
                  >
                    RECORD MARKER
                  </button>
                  <button onClick={() => { setMakerStep(0); setMakerLyrics(""); }} className="w-12 h-14 border border-white/10 flex items-center justify-center rounded-xl text-white/40">
                    <RotateCcw size={16} />
                  </button>
                </div>
             </div>

             <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-2">Preview Output</h4>
                <div className="p-3 h-24 bg-black/60 rounded-xl font-mono text-[10px] text-brand-gold/60 overflow-y-auto whitespace-pre border border-white/5">
                   {makerLyrics || "Timing markers will appear here..."}
                </div>
                <button 
                   disabled={!makerLyrics}
                   onClick={finalizeMaker}
                   className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold text-xs rounded-xl"
                >
                   LOAD INTO SESSION
                </button>
             </div>
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
