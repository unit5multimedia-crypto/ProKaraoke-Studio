import { useEffect, useRef, useState } from 'react';
import { getAudioContext, resumeAudioContext } from '../lib/audioContext';

// Global registry to prevent double-initialization of media elements which causes freezing
// We use a Map to keep track of sources, and a Set to track elements currently being initialized
const mediaSourceRegistry = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
const pendingInitializations = new WeakSet<HTMLMediaElement>();

export function useAudioAnalyzer(isActive: boolean) {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!isActive) {
       // Optionally stop mic here if needed, but we keep it for now
    }
  }, [isActive]);

  const initAnalyzer = async (element: HTMLMediaElement | null, enableMic: boolean = true) => {
    if (!element && !enableMic) return;
    
    const ctx = getAudioContext();
    await resumeAudioContext();

    let currentAnalyser = analyser;
    if (!currentAnalyser) {
      currentAnalyser = ctx.createAnalyser();
      currentAnalyser.fftSize = 256;
      currentAnalyser.smoothingTimeConstant = 0.8;
      setAnalyser(currentAnalyser);
    }

    if (!currentAnalyser) return; 

    // Handle Media Element (Music)
    if (element && element instanceof HTMLMediaElement) {
      if (mediaSourceRegistry.has(element)) {
        const existingSource = mediaSourceRegistry.get(element);
        if (existingSource) {
           try { 
             existingSource.connect(currentAnalyser); 
             existingSource.connect(ctx.destination);
           } catch(e) {}
        }
      } else if (!pendingInitializations.has(element)) {
        pendingInitializations.add(element);
        try {
          const mSource = ctx.createMediaElementSource(element);
          mSource.connect(currentAnalyser);
          mSource.connect(ctx.destination);
          mediaSourceRegistry.set(element, mSource);
          console.log("AudioAnalyzer: Connected new media element to destination");
        } catch (e) {
          console.warn("Media capture blocked or already initialized in registry:", e);
        } finally {
          pendingInitializations.delete(element);
        }
      }
    }

    // 2. Handle Microphone (Vocals) - Additive to visuals
    if (enableMic && !micSourceRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mSource = ctx.createMediaStreamSource(stream);
        mSource.connect(currentAnalyser);
        // Note: Mic is NOT connected to destination here (it's handled by useVocalEngine)
        micSourceRef.current = mSource;
      } catch (e) {
        console.error("Mic access denied for visuals", e);
      }
    }
  };

  return { analyser, initAnalyzer };
}
