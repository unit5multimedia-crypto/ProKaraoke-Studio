import { useEffect, useRef, useState } from 'react';

export function useAudioAnalyzer(isActive: boolean) {
  const [data, setData] = useState<Uint8Array>(new Uint8Array(0));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const initAnalyzer = (element: HTMLMediaElement | null) => {
    if (!element) return;
    // If already connected to THIS element, skip
    if (sourceRef.current && (sourceRef.current as any).mediaElement === element) return;
    
    // Safety check for valid media element
    if (!(element instanceof HTMLMediaElement)) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = audioContextRef.current || new AudioContextClass();
    
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch(e) {}
    }

    const analyser = analyserRef.current || ctx.createAnalyser();
    analyser.fftSize = 256;
    
    const source = ctx.createMediaElementSource(element);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;
  };

  useEffect(() => {
    if (!isActive || !analyserRef.current) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const update = () => {
      if (analyserRef.current) {
        const buffer = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buffer);
        setData(buffer);
      }
      animationRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive]);

  return { data, initAnalyzer };
}
