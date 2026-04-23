import { useEffect, useRef, useState } from 'react';

export function useAudioAnalyzer(isActive: boolean) {
  const [data, setData] = useState<Uint8Array>(new Uint8Array(0));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const initAnalyzer = async (element: HTMLMediaElement | null, useMic: boolean = false) => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    const ctx = audioContextRef.current;

    if (!analyserRef.current) {
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 256;
    }
    const analyser = analyserRef.current;

    // Disconnect old source
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch(e) {}
    }

    if (useMic) {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const micSource = ctx.createMediaStreamSource(stream);
        micSource.connect(analyser);
        sourceRef.current = micSource;
      } catch (e) {
        console.error("Mic access denied for analyzer", e);
      }
    } else if (element && element instanceof HTMLMediaElement) {
      try {
        const mediaSource = ctx.createMediaElementSource(element);
        mediaSource.connect(analyser);
        analyser.connect(ctx.destination);
        sourceRef.current = mediaSource;
      } catch (e) {
        console.warn("CORS/Security restricted element capture, falling back to mic", e);
        initAnalyzer(null, true);
      }
    }
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
