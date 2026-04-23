import { useEffect, useRef, useState } from 'react';
import { getAudioContext, resumeAudioContext } from '../lib/audioContext';

// Global registry to prevent double-initialization of media elements which causes freezing
const mediaSourceRegistry = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

export function useAudioAnalyzer(isActive: boolean) {
  const [data, setData] = useState<Uint8Array>(new Uint8Array(0));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const initAnalyzer = async (element: HTMLMediaElement | null, enableMic: boolean = true) => {
    const ctx = getAudioContext();
    await resumeAudioContext();

    if (!analyserRef.current) {
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
    }
    const analyser = analyserRef.current;

    // 1. Handle Media Element (Music)
    if (element && element instanceof HTMLMediaElement) {
      if (!mediaSourceRegistry.has(element)) {
        try {
          const mSource = ctx.createMediaElementSource(element);
          mSource.connect(analyser);
          mSource.connect(ctx.destination);
          mediaSourceRegistry.set(element, mSource);
        } catch (e) {
          console.warn("Media capture blocked or already initialized in registry:", e);
        }
      } else {
        const existingSource = mediaSourceRegistry.get(element);
        if (existingSource) {
           try { existingSource.connect(analyser); } catch(e) {}
        }
      }
    }

    // 2. Handle Microphone (Vocals) - Additive
    if (enableMic && !micSourceRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mSource = ctx.createMediaStreamSource(stream);
        mSource.connect(analyser);
        micSourceRef.current = mSource;
      } catch (e) {
        console.error("Mic access denied for visuals", e);
      }
    }
  };

  useEffect(() => {
    const update = () => {
      if (isActive && analyserRef.current) {
        const buffer = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buffer);
        setData(new Uint8Array(buffer));
      }
      animationId = requestAnimationFrame(update);
    };

    let animationId = requestAnimationFrame(update);
    animationRef.current = animationId;

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive]);

  return { data, initAnalyzer };
}
