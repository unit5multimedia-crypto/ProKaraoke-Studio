import { useEffect, useRef, useState } from 'react';
import { getAudioContext, resumeAudioContext } from '../lib/audioContext';

// Global registry to prevent double-initialization of media elements which causes freezing
const mediaSourceRegistry = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

export function useAudioAnalyzer(isActive: boolean) {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const initAnalyzer = async (element: HTMLMediaElement | null, enableMic: boolean = true) => {
    const ctx = getAudioContext();
    await resumeAudioContext();

    let currentAnalyser = analyser;
    if (!currentAnalyser) {
      currentAnalyser = ctx.createAnalyser();
      currentAnalyser.fftSize = 256;
      currentAnalyser.smoothingTimeConstant = 0.8;
      setAnalyser(currentAnalyser);
    }

    // 1. Handle Media Element (Music)
    if (element && element instanceof HTMLMediaElement) {
      if (!mediaSourceRegistry.has(element)) {
        try {
          const mSource = ctx.createMediaElementSource(element);
          // Route: Source -> Analyser -> Destination
          mSource.connect(analyser);
          mSource.connect(ctx.destination);
          mediaSourceRegistry.set(element, mSource);
          console.log("AudioAnalyzer: Connected new media element to destination");
        } catch (e) {
          console.warn("Media capture blocked or already initialized in registry:", e);
        }
      } else {
        const existingSource = mediaSourceRegistry.get(element);
        if (existingSource) {
           try { 
             existingSource.connect(analyser); 
             // Ensure it's still connected to destination too
             existingSource.connect(ctx.destination);
           } catch(e) {}
        }
      }
    }

    // 2. Handle Microphone (Vocals) - Additive to visuals only
    if (enableMic && !micSourceRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mSource = ctx.createMediaStreamSource(stream);
        mSource.connect(analyser);
        // Note: Mic is NOT connected to destination here (it's handled by useVocalEngine)
        micSourceRef.current = mSource;
      } catch (e) {
        console.error("Mic access denied for visuals", e);
      }
    }
  };

  return { analyser, initAnalyzer };
}
