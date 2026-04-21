import { useState, useEffect, useRef } from 'react';
import { detectPitch } from '../lib/pitchDetection';

export function usePitchDetection(isActive: boolean) {
  const [pitch, setPitch] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      return;
    }

    async function setupAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const buffer = new Float32Array(analyser.fftSize);

        const updatePitch = () => {
          analyser.getFloatTimeDomainData(buffer);
          const p = detectPitch(buffer, audioContext.sampleRate);
          setPitch(p);
          requestRef.current = requestAnimationFrame(updatePitch);
        };

        updatePitch();
      } catch (err) {
        console.error('Microphone access denied or error:', err);
      }
    }

    setupAudio();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isActive]);

  return pitch;
}
