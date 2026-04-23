import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LyricLine, KaraokeSettings, SongQueueItem, ViewType } from '../types';
import { useVocalEngine } from '../hooks/usePitchDetection';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer';
import { VisualBackground } from './VisualBackground';
import { Mic, Music, Play, Pause, RotateCcw, Award, Trophy, ListMusic } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface KaraokeStageProps {
  bumperUrl: string | null;
  mediaUrl: string | null;
  backgroundUrl: string | null;
  isAudioOnly: boolean;
  lyrics: LyricLine[];
  settings: KaraokeSettings;
  bpm: number | null;
  musicalKey: string | null;
  onStateUpdate?: (state: { currentTime: number; phase: any; isPlaying: boolean; duration: number }) => void;
  onMediaUpload?: (type: string, file: File, url: string) => void;
}

export default function KaraokeStage({
  bumperUrl,
  mediaUrl,
  backgroundUrl,
  isAudioOnly,
  lyrics,
  settings,
  bpm,
  musicalKey,
  onStateUpdate,
  onMediaUpload,
}: KaraokeStageProps) {
  const [phase, setPhase] = useState<'idle' | 'bumper' | 'main' | 'finished'>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [currentAccuracy, setCurrentAccuracy] = useState(0); // 0 to 100 for the bar
  const [pitchFeedback, setPitchFeedback] = useState<string | null>(null);
  const [timingFeedback, setTimingFeedback] = useState<string | null>(null);
  const [feedbackTimeout, setFeedbackTimeout] = useState<NodeJS.Timeout | null>(null);
  const [queue, setQueue] = useState<SongQueueItem[]>([]);

  const showFeedback = (p: string, t: string) => {
    setPitchFeedback(p);
    setTimingFeedback(t);
    if (feedbackTimeout) clearTimeout(feedbackTimeout);
    const timeout = setTimeout(() => {
      setPitchFeedback(null);
      setTimingFeedback(null);
    }, 2000);
    setFeedbackTimeout(timeout);
  };

  const bumperRef = useRef<HTMLVideoElement>(null);
  const mainRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const [ytReady, setYtReady] = useState(false);
  const isOperator = settings.viewType === 'operator';
  
  const { pitch } = useVocalEngine(
    isOperator && phase === 'main' && isPlaying, 
    settings.audioDeviceId, 
    settings.micOutputId || settings.audioOutputId,
    settings.micVolume ?? 0.8,
    settings.micEcho ?? 0.3
  );
  
  const { data: fftData, initAnalyzer } = useAudioAnalyzer(isPlaying && phase === 'main');

  // Handle setting audio output device
  useEffect(() => {
    if (settings.audioOutputId && mainRef.current && typeof (mainRef.current as any).setSinkId === 'function') {
      (mainRef.current as any).setSinkId(settings.audioOutputId).catch((e: any) => {
        console.error("Failed to set audio output device:", e);
      });
    }
  }, [settings.audioOutputId, phase]);

  // Connect analyzer when media ready
  useEffect(() => {
    if (mainRef.current) {
      initAnalyzer(mainRef.current);
    }
  }, [mainRef.current, mediaUrl]);

  // Sound FX System (No assets needed, using Oscillator)
  const playSFX = (type: 'win' | 'score' | 'start') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'start') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'score') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'win') {
        // Classic 8-bit Arcade Victory Fanfare
        const melody = [
          { freq: 392.00, time: 0, dur: 0.15 },    // G4
          { freq: 523.25, time: 0.15, dur: 0.15 }, // C5
          { freq: 659.25, time: 0.30, dur: 0.15 }, // E5
          { freq: 783.99, time: 0.45, dur: 0.40 }, // G5 (longer)
          { freq: 659.25, time: 0.85, dur: 0.15 }, // E5
          { freq: 783.99, time: 1.00, dur: 0.80 }  // G5 (held)
        ];
        
        melody.forEach(note => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          
          o.type = 'square'; // 8-bit chip tune style
          o.frequency.setValueAtTime(note.freq, ctx.currentTime + note.time);
          
          // Classic chip envelope (sharp attack, exponential decay)
          g.gain.setValueAtTime(0, ctx.currentTime + note.time);
          g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + note.time + 0.02);
          if (note.dur > 0.2) {
             g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + note.time + note.dur - 0.1);
             g.gain.linearRampToValueAtTime(0.001, ctx.currentTime + note.time + note.dur);
          } else {
             g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.time + note.dur);
          }
          
          o.start(ctx.currentTime + note.time);
          o.stop(ctx.currentTime + note.time + note.dur);
        });
      }
    } catch (e) {
      console.error('AudioContext Error', e);
    }
  };

  const youtubeId = useMemo(() => {
    if (!mediaUrl) return null;
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = mediaUrl.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }, [mediaUrl]);
  
  const isYouTube = !!youtubeId;

  // Sync playback state with refs
  useEffect(() => {
    if (isPlaying) {
      if (phase === 'bumper') {
        bumperRef.current?.play().catch(() => {});
      } else if (phase === 'main') {
        if (isYouTube) {
          if (ytReady && ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
            try { ytPlayerRef.current.playVideo(); } catch (e) {}
          }
        } else {
          mainRef.current?.play().catch(() => {});
        }
      }
    } else {
      bumperRef.current?.pause();
      if (isYouTube) {
        if (ytReady && ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
          try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
        }
      } else {
        mainRef.current?.pause();
      }
    }
  }, [isPlaying, phase,  ytReady, isYouTube]);

  // Handle media volume
  useEffect(() => {
     let vol = settings.mediaVolume ?? 1.0;
     // Force mute on helper windows
     if (!isOperator) vol = 0;
     
     if (mainRef.current) {
        mainRef.current.volume = vol;
     }
     if (isYouTube && ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
        try { ytPlayerRef.current.setVolume(vol * 100); } catch(e) {}
     }
  }, [settings.mediaVolume, isOperator, isYouTube, ytReady, isPlaying]);

  // YouTube Time Update Polyfill
  useEffect(() => {
    let interval: any;
    if (isYouTube && isPlaying && phase === 'main') {
      interval = setInterval(() => {
        try {
          if (ytReady && ytPlayerRef.current?.getCurrentTime) {
            const time = ytPlayerRef.current.getCurrentTime();
            if (time !== undefined && typeof time === 'number') {
              setCurrentTime(time);
            }
          }
        } catch (e) {
          // Silently handle if player is not fully ready or destroyed
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [ isPlaying, phase, ytReady]);

  useEffect(() => {
    if (pitch && phase === 'main' && isPlaying) {
      const currentActive = lyrics.find(l => currentTime >= l.startTime && currentTime <= l.endTime);
      
      // Look for upcoming line for "Early" check
      const upcoming = lyrics.find(l => currentTime < l.startTime && currentTime > l.startTime - 1.0);

      if (currentActive) {
        // Scoring Logic with Nuance
        let points = 2;
        let pFeedback = "Great Tone";
        let tFeedback = "On Time";

        // Timing analysis
        const lineProgress = (currentTime - currentActive.startTime) / (currentActive.endTime - currentActive.startTime);
        if (lineProgress < 0.15) tFeedback = "Perfect Sync";
        else if (lineProgress > 0.85) tFeedback = "Solid Hold";

        // Pitch analysis (if target exists)
        if (currentActive.targetFrequency) {
          const ratio = pitch / currentActive.targetFrequency;
          if (ratio > 1.06) {
            pFeedback = "Too High";
            points = 1;
          } else if (ratio < 0.94) {
            pFeedback = "Too Low";
            points = 1;
          } else if (ratio > 0.98 && ratio < 1.02) {
            pFeedback = "Perfect Pitch";
            points = 10;
          } else {
            pFeedback = "In Key";
            points = 5;
          }
        } else {
           points = 5;
        }

        setScore(s => s + points);
        setCurrentAccuracy(Math.min(100, (currentAccuracy || 0) + 0.6));
        
        if (Math.random() > 0.95) {
          showFeedback(pFeedback, tFeedback);
        }
        
        if (Math.random() > 0.8) playSFX('score');
      } else if (upcoming) {
         // User is singing too early
         if (Math.random() > 0.9) showFeedback("Vocal Prep", "Too Early");
      } else {
         // FREE SCORER MODE
         // If we are in a gap or no lyrics are loaded, reward active singing
         if (pitch > 50 && pitch < 1200) {
            setScore(s => s + 1);
            setCurrentAccuracy(prev => Math.min(100, (prev || 0) + 0.4));
         } else {
            setCurrentAccuracy(prev => Math.max(0, (prev || 0) - 0.2));
         }
      }
    } else if (phase === 'main' && isPlaying) {
      // Natural decay when not singing
      setCurrentAccuracy(prev => Math.max(0, (prev || 0) - 0.5));
    }
  }, [pitch, currentTime, phase, isPlaying, lyrics]);

  useEffect(() => {
    const roundedTime = Math.floor(currentTime);
    let duration = 0;
    
    if (false) {
      if (ytReady && ytPlayerRef.current?.getDuration) {
        try {
          duration = ytPlayerRef.current.getDuration();
        } catch (e) {
          duration = 0;
        }
      }
    } else {
      duration = mainRef.current?.duration || 0;
    }
    
    onStateUpdate?.({
      currentTime: roundedTime,
      phase,
      isPlaying,
      duration: duration || 0
    });
  }, [Math.floor(currentTime), phase, isPlaying,  onStateUpdate, ytReady]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 1.1;
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleStart = () => {
    console.log('Starting show...', { bumperUrl, mediaUrl });
    playSFX('start');
    if (bumperUrl) {
      setPhase('bumper');
    } else if (mediaUrl) {
      setPhase('main');
    } else {
      console.warn('No media loaded to start show');
      return;
    }
    setIsPlaying(true);
    setScore(0);

    // Broadcast if operator
    if (settings.viewType === 'operator') {
      const bc = new BroadcastChannel('karaoke-sync');
      bc.postMessage({ type: 'COMMAND', payload: { action: 'START', phase: bumperUrl ? 'bumper' : 'main' } });
      bc.close();
    }
  };

  const handleBumperEnd = () => {
    setPhase('main');
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  };

  const handleMediaEnd = () => {
    setPhase('finished');
    setIsPlaying(false);
    playSFX('win');
    const finalScore = score.toLocaleString();
    setTimeout(() => {
      speak(`Beautiful praise! Your final score is ${finalScore}. To God be the glory!`);
    }, 1000);

    // Auto-advance queue if not operator (operator handles it via tab sync)
    if (settings.viewType !== 'operator' && queue.length > 0) {
      // Logic for auto-next can be handled by operator resending media sync
      // But for now we show the 'Win' screen. 
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setIsPlaying(false);
    setCurrentTime(0);
    setScore(0);

    // Broadcast if operator
    if (settings.viewType === 'operator') {
      const bc = new BroadcastChannel('karaoke-sync');
      bc.postMessage({ type: 'COMMAND', payload: { action: 'RESET' } });
      bc.close();
    }
  };

  useEffect(() => {
    // Session State Sync logic
    const bc = new BroadcastChannel('karaoke-sync');
    bc.onmessage = (event) => {
      if (settings.viewType === 'operator') return;
      const { type, payload } = event.data;
      
      if (type === 'COMMAND') {
        switch (payload.action) {
          case 'START':
            setPhase(payload.phase);
            setIsPlaying(true);
            setScore(0);
            break;
          case 'PAUSE':
            setIsPlaying(payload.state);
            break;
          case 'RESET':
            setPhase('idle');
            setIsPlaying(false);
            setCurrentTime(0);
            setScore(0);
            break;
          case 'QUEUE_SYNC':
            setQueue(payload);
            break;
        }
      }
    };

    return () => {
      bc.close();
    };
  }, [settings.viewType, bumperUrl, mediaUrl]);

  // YouTube iframe initialization logic
  useEffect(() => {
    if (!isYouTube || !youtubeId || phase !== 'main') {
      setYtReady(false);
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); ytPlayerRef.current = null; } catch(e) {}
      }
      return;
    }

    setYtReady(false);
    let initAttempts = 0;
    const maxAttempts = 20;

    const tryInit = () => {
      const container = ytContainerRef.current;
      if (!container) return false;

      // Ensure global YouTube API is loaded
      if (!window.YT) {
        if (!document.getElementById('youtube-iframe-api')) {
          const script = document.createElement('script');
          script.id = 'youtube-iframe-api';
          script.src = 'https://www.youtube.com/iframe_api';
          document.body.appendChild(script);
        }
        return false;
      }

      if (window.YT && window.YT.Player) {
        if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
          try { ytPlayerRef.current.destroy(); } catch(e) {}
        }
        
        ytPlayerRef.current = new window.YT.Player(container, {
          videoId: youtubeId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            enablejsapi: 1,
            autohide: 1,
            playsinline: 1,
            vq: 'hd1080', // Force HD1080 immediately
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              try {
                console.log('YouTube Player Ready');
                setYtReady(true);
                if (event.target.setPlaybackQuality) event.target.setPlaybackQuality('hd1080');
                
                let vol = settings.mediaVolume ?? 1.0;
                if (!isOperator) vol = 0;
                event.target.setVolume(vol * 100);
                
                if (event.target.playVideo) event.target.playVideo();
                if (event.target.unMute) event.target.unMute();
                showFeedback("Vocal Engine", "Ready");
              } catch (e) {
                console.error("YouTube onReady error:", e);
              }
            },
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                if (event.target.setPlaybackQuality) event.target.setPlaybackQuality('hd1080'); // Re-assert if quality drops
                setIsPlaying(true);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              } else if (event.data === window.YT.PlayerState.ENDED) {
                handleMediaEnd();
              }
            },
            onError: (event: any) => {
              console.error('YouTube Player Error:', event.data);
              let msg = "Video Error";
              if (event.data === 101 || event.data === 150) msg = "Embed Restricted";
              if (event.data === 100) msg = "Video Not Found";
              showFeedback("Error", msg);
            }
          }
        });
        return true;
      }
      return false;
    };

    const interval = setInterval(() => {
      if (tryInit() || initAttempts >= maxAttempts) {
        clearInterval(interval);
      }
      initAttempts++;
    }, 500);

    return () => {
      clearInterval(interval);
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        try { ytPlayerRef.current.destroy(); ytPlayerRef.current = null; } catch(e) {}
      }
    };
  }, [youtubeId, phase]);

  const togglePlayback = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    if (settings.viewType === 'operator') {
      const bc = new BroadcastChannel('karaoke-sync');
      bc.postMessage({ type: 'COMMAND', payload: { action: 'PAUSE', state: newState } });
      bc.close();
    }
  };

  const activeLyric = useMemo(() => {
    return lyrics.find(l => currentTime >= l.startTime - 2 && currentTime <= l.endTime + 0.5);
  }, [lyrics, currentTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && settings.viewType !== 'operator') {
        // Redirect to operator view
        window.location.href = window.location.origin + window.location.pathname + '?view=operator';
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.viewType]);

  return (
    <div 
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden transition-colors duration-1000"
      style={{ backgroundColor: settings.viewType === 'prompter' ? settings.prompterBgColor : '#000000' }}
    >
      {/* Rescue Link for Operators stuck in Singer View */}
      {settings.viewType === 'operator' && phase === 'idle' && (
        <div className="absolute bottom-6 right-6 opacity-0 hover:opacity-100 transition-opacity z-[100]">
           <a 
             href="?view=operator" 
             className="text-[9px] font-mono text-white/20 hover:text-brand-gold uppercase tracking-widest border border-white/5 bg-black/40 px-3 py-1.5 rounded-full"
           >
             Operator console loaded
           </a>
        </div>
      )}
      <AnimatePresence>
        {phase === 'idle' && settings.viewType === 'operator' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="z-50 text-center px-12"
          >
            <h1 className="text-6xl font-display font-bold mb-4 tracking-tighter text-brand-gold">
              Start Praising to God!
            </h1>
            <div className="max-w-2xl mx-auto mb-8 bg-black/40 border border-white/5 p-4 rounded-xl backdrop-blur-md">
              <p className="text-brand-gold/80 italic font-serif text-lg leading-relaxed">
                "Praise the Lord. How good it is to sing praises to our God, how pleasant and fitting to praise him!"
              </p>
              <p className="text-brand-gold/50 text-sm mt-2 font-mono uppercase tracking-widest">- Psalm 147:1</p>
            </div>
            
            <div className="flex flex-col gap-6 items-center">
              <button
                onClick={handleStart}
                disabled={!mediaUrl && !bumperUrl}
                className={`px-12 py-4 bg-brand-gold text-black font-bold rounded-full transition-all flex items-center gap-3 mx-auto ${(!mediaUrl && !bumperUrl) ? 'opacity-30 cursor-not-allowed scale-95' : 'hover:scale-105 shadow-[0_0_30px_rgba(255,215,0,0.3)]'}`}
              >
                <Play size={24} fill="currentColor" /> START SHOW
              </button>

              <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 max-w-xl mx-auto">
                <div className="flex flex-col gap-1 items-center">
                   <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono">Lyrics</span>
                   <span className={`text-[11px] font-bold ${lyrics.length > 0 ? 'text-green-400' : 'text-white/20'}`}>
                      {lyrics.length > 0 ? `${lyrics.length} CUES LOADED` : 'NOT LOADED'}
                   </span>
                </div>
                <div className="flex flex-col gap-1 items-center">
                   <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono">Media</span>
                   <span className={`text-[11px] font-bold ${mediaUrl ? 'text-green-400' : 'text-white/20'}`}>
                      {mediaUrl ? 'CONTENT READY' : 'NO SOURCE'}
                   </span>
                </div>
                {bpm && (
                  <div className="flex flex-col gap-1 items-center">
                     <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono">BPM</span>
                     <span className="text-[11px] font-bold text-brand-gold">{bpm}</span>
                  </div>
                )}
                {musicalKey && (
                  <div className="flex flex-col gap-1 items-center">
                     <span className="text-[9px] uppercase tracking-widest text-white/30 font-mono">Key</span>
                     <span className="text-[11px] font-bold text-brand-gold">{musicalKey}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {phase === 'bumper' && bumperUrl && (
          <motion.div
            key="bumper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: settings.bumperFadeDuration }}
            className="absolute inset-0 z-40 bg-black"
          >
            <video
              ref={bumperRef}
              src={bumperUrl}
              autoPlay
              playsInline
              crossOrigin="anonymous"
              onEnded={handleBumperEnd}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-8 left-8 flex items-center gap-2 bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-widest">Pre-Show Active</span>
            </div>
          </motion.div>
        )}

        {phase === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30"
          >
            {/* Background Layer (Visualizer or Image) */}
            <div className="absolute inset-0 z-10 bg-black">
              {backgroundUrl ? (
                <img src={backgroundUrl} className="w-full h-full object-cover opacity-60 blur-sm" referrerPolicy="no-referrer" />
              ) : (
                <VisualBackground 
                  fftData={fftData} 
                  theme={settings.visualTheme} 
                  sensitivity={settings.audioReactivity} 
                />
              )}
            </div>

            {/* Media Player Layer */}
            {isYouTube ? (
              <div className={`absolute inset-0 z-20 bg-black pointer-events-none ${settings.viewType === 'stage' ? 'opacity-0' : 'opacity-100'}`}>
                <div 
                  ref={ytContainerRef}
                  className="w-full h-full object-cover transition-all duration-1000 pointer-events-auto"
                />
                
                {/* Interaction Shield - Transparent overlay for Videoke look */}
                <div className="absolute inset-0 z-[25] bg-transparent" />
              </div>
            ) : mediaUrl ? (
              isAudioOnly ? (
                <audio
                  ref={mainRef as any}
                  src={mediaUrl}
                  autoPlay
                  playsInline
                  muted={!isOperator}
                  crossOrigin="anonymous"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleMediaEnd}
                  className="hidden"
                />
              ) : (
                <video
                  ref={mainRef as any}
                  src={mediaUrl}
                  autoPlay
                  playsInline
                  muted={!isOperator}
                  crossOrigin="anonymous"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleMediaEnd}
                  className={`absolute inset-0 z-20 w-full h-full object-cover pointer-events-none ${settings.viewType === 'stage' ? 'opacity-0' : 'opacity-100'}`}
                />
              )
            ) : null}

            {/* UI Overlays */}
            {settings.viewType === 'operator' && (
              <div className="absolute top-8 left-8 right-8 flex justify-between items-start pointer-events-none z-50">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-widest text-white/50 font-mono">Accuracy Score</span>
                      <span className="text-2xl font-display font-bold text-brand-gold">{score.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 pointer-events-auto">
                  <button
                    onClick={togglePlayback}
                    className="w-12 h-12 glass-panel flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button
                    onClick={handleReset}
                    className="w-12 h-12 glass-panel flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <RotateCcw size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* Singer-focused Scoring UI (Center focus in Presentation Mode) */}
            {settings.viewType === 'operator' && (
              <div className={`absolute top-12 left-1/2 -translate-x-1/2 w-full max-w-xl px-12 transition-all duration-500 z-50 ${settings.viewType !== 'operator' ? 'scale-110 top-16' : 'opacity-60'}`}>
              <div className="flex flex-col items-center gap-3">
                {/* Nuanced Feedback Labels */}
                <AnimatePresence>
                  {(pitchFeedback || timingFeedback) && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="flex gap-4 mb-2"
                    >
                      {pitchFeedback && (
                        <motion.div 
                          initial={{ scale: 0.8, filter: 'blur(4px)' }}
                          animate={{ scale: pitchFeedback.includes('Perfect') ? 1.1 : 1, filter: 'blur(0px)' }}
                          transition={{ type: 'spring', stiffness: 300 }}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-lg ${
                            pitchFeedback === 'Too High' ? 'bg-orange-500 text-black shadow-[0_0_15px_rgba(249,115,22,0.6)]' :
                            pitchFeedback === 'Too Low' ? 'bg-blue-500 text-black shadow-[0_0_15px_rgba(59,130,246,0.6)]' :
                            pitchFeedback === 'Perfect Pitch' ? 'bg-green-400 text-black shadow-[0_0_20px_rgba(74,222,128,0.8)] animate-pulse' :
                            'bg-brand-gold text-black shadow-[0_0_10px_rgba(255,215,0,0.5)]'
                          }`}
                        >
                          {pitchFeedback === 'Too High' && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>}
                          {pitchFeedback === 'Too Low' && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
                          {pitchFeedback === 'Perfect Pitch' && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                          {pitchFeedback}
                        </motion.div>
                      )}
                      {timingFeedback && (
                        <div className="px-3 py-1 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-widest">
                          {timingFeedback}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden border border-white/10 relative">
                   <motion.div 
                     className="h-full bg-brand-gold shadow-[0_0_20px_rgba(255,215,0,0.6)] rounded-full"
                     animate={{ width: `${currentAccuracy}%` }}
                     transition={{ duration: 0.1 }}
                   />
                   {/* Ghost Bar for precision feel */}
                   <div className="absolute inset-0 bg-brand-gold/10 mix-blend-overlay" />
                </div>
                <div className="flex justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Mic size={10} className="text-brand-gold" />
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-tighter">Live Vocal Match</span>
                  </div>
                   {settings.viewType === 'operator' && (
                    <motion.span 
                      key={score}
                      initial={{ scale: 1.2, color: '#fff' }}
                      animate={{ scale: 1, color: '#FFD700' }}
                      className="text-lg font-display font-black text-brand-gold"
                    >
                      {score.toLocaleString()}
                    </motion.span>
                  )}
          <span className="text-[10px] font-mono text-brand-gold uppercase tracking-[0.2em] font-bold">{currentAccuracy}%</span>
        </div>
      </div>
    </div>
  )}

            {/* Lyrics Layer (Software Lyrics) */}
            {settings.viewType !== 'stage' && (isAudioOnly || settings.viewType !== 'prompter') && (
              <div className={`absolute left-0 right-0 px-16 pointer-events-none z-40 transition-all duration-1000 ${settings.lyricsPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-32'}`}>
              <div className="max-w-5xl mx-auto text-center">
                <AnimatePresence mode="wait">
                  {activeLyric ? (
                    <motion.div
                      key={activeLyric.startTime}
                      initial={{ opacity: 0, y: 30, scale: 0.95, filter: 'blur(10px)' }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 1.05, filter: 'blur(5px)' }}
                      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                      className="flex flex-col items-center gap-6"
                    >
                      <div
                        className="font-black leading-[1.1] drop-shadow-[0_8px_32px_rgba(0,0,0,0.9)] tracking-tighter"
                        style={{
                          fontSize: `${settings.viewType === 'prompter' ? settings.fontSize * 1.8 : settings.fontSize}px`,
                          fontFamily: settings.fontFamily,
                          transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      >
                        {activeLyric.text.split('').map((char, i) => {
                           const progress = (currentTime - activeLyric.startTime) / (activeLyric.endTime - activeLyric.startTime);
                           const charProgress = i / activeLyric.text.length;
                           const isFinished = progress > charProgress;
                           const isActive = !isFinished && progress > charProgress - 0.15;

                           return (
                             <motion.span
                               key={i}
                               style={{
                                 color: isFinished ? settings.finishedColor : (isActive ? settings.activeColor : settings.idleColor),
                                 textShadow: isFinished ? `0 0 15px ${settings.finishedColor}44` : 'none'
                               }}
                             >
                               {char}
                             </motion.span>
                           );
                        })}
                      </div>
                      
                      {/* Progress Line below active lyric */}
                      <div className="w-48 h-[1px] bg-white/10 rounded-full mt-4 overflow-hidden">
                        <motion.div 
                           className="h-full bg-brand-gold"
                           initial={{ width: '0%' }}
                           animate={{ width: '100%' }}
                           transition={{ duration: activeLyric.endTime - activeLyric.startTime, ease: 'linear' }}
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-24 flex items-center justify-center"
                    >
                      <div className="w-1 h-8 bg-brand-gold/20 rounded-full animate-pulse" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
           )}
          </motion.div>
        )}

        {phase === 'finished' && settings.viewType !== 'stage' && (
          <motion.div
            key="finished"
            initial={{ scale: 0.8, opacity: 0, filter: 'blur(20px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            className="z-50 text-center"
          >
            <div className="glass-panel p-16 flex flex-col items-center gap-8 border-brand-gold/30 shadow-[0_0_100px_rgba(255,215,0,0.2)] bg-black/80 backdrop-blur-xl">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center"
              >
                <Trophy size={80} className="text-brand-gold mb-4 animate-bounce" />
                <h2 className="text-5xl font-display font-black text-brand-gold uppercase tracking-tighter mb-1">PRO PERFORMANCE</h2>
                <p className="text-[10px] text-white/40 font-mono uppercase tracking-[0.4em]">Evaluation Complete</p>
              </motion.div>

              <div className="relative">
                <motion.div 
                   initial={{ scale: 0.5, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   transition={{ type: 'spring', damping: 10, delay: 0.5 }}
                   className="text-9xl font-display font-black text-white tracking-tighter drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                >
                  {lyrics.length > 0 
                    ? Math.min(100, Math.floor((score / Math.max(1, (lyrics.length * 50))) * 100))
                    : Math.min(100, Math.floor((score / 1000) * 100)) // Fallback for video matches
                  }%
                </motion.div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-brand-gold font-mono font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                   {score.toLocaleString()} POINTS
                </div>
              </div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="flex flex-col gap-4"
              >
                <p className="text-brand-gold/60 italic font-serif max-w-sm">"Great is our Lord and abundant in strength; His understanding is infinite." - Psalm 147:5</p>
                
                {settings.viewType === 'operator' && (
                  <button
                    onClick={handleReset}
                    className="px-12 py-4 bg-brand-gold text-black font-black rounded-full hover:scale-110 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,215,0,0.3)] mt-4"
                  >
                    <RotateCcw size={20} /> CLEAR STAGE
                  </button>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
