import { useState, useEffect, useRef, useCallback } from 'react';

export interface VoiceEffectsSettings {
  reverb: number; // 0-1
  echo: number; // 0-1
  volume: number; // 0-1
}

export function useVoiceEffects(isActive: boolean, settings: VoiceEffectsSettings) {
  const [isInitialized, setIsInitialized] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Create reverb impulse response
  const createReverbImpulse = useCallback((context: AudioContext, duration: number = 2, decay: number = 2) => {
    const sampleRate = context.sampleRate;
    const length = sampleRate * duration;
    const impulse = context.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      left[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
      right[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
    }

    return impulse;
  }, []);

  // Initialize audio processing chain
  const initializeAudio = useCallback(async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      streamRef.current = stream;

      // Create audio context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // Create audio source from microphone
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Create gain node for input volume
      const inputGain = audioContext.createGain();
      gainNodeRef.current = inputGain;

      // Create reverb node
      const reverbNode = audioContext.createConvolver();
      const reverbBuffer = createReverbImpulse(audioContext, 2, 2);
      reverbNode.buffer = reverbBuffer;
      reverbNodeRef.current = reverbNode;

      // Create delay node for echo
      const delayNode = audioContext.createDelay(1); // Max 1 second delay
      delayNode.delayTime.value = 0.3; // 300ms delay
      delayNodeRef.current = delayNode;

      // Create delay feedback gain
      const delayGain = audioContext.createGain();
      delayGain.gain.value = 0.4; // Feedback amount

      // Create output gain node
      const outputGain = audioContext.createGain();
      outputGainRef.current = outputGain;

      // Connect the audio processing chain:
      // Source -> Input Gain -> Reverb -> Delay -> Output Gain -> Destination
      source.connect(inputGain);

      // Reverb path
      inputGain.connect(reverbNode);
      reverbNode.connect(outputGain);

      // Direct path (dry signal)
      inputGain.connect(outputGain);

      // Echo path
      inputGain.connect(delayNode);
      delayNode.connect(delayGain);
      delayGain.connect(delayNode); // Feedback loop
      delayNode.connect(outputGain);

      // Connect to speakers
      outputGain.connect(audioContext.destination);

      setIsInitialized(true);
    } catch (err) {
      console.error('Failed to initialize voice effects:', err);
    }
  }, [createReverbImpulse]);

  // Update effect parameters
  useEffect(() => {
    if (!isInitialized) return;

    const reverbNode = reverbNodeRef.current;
    const delayNode = delayNodeRef.current;
    const outputGain = outputGainRef.current;
    const gainNode = gainNodeRef.current;

    if (reverbNode && delayNode && outputGain && gainNode) {
      // Update reverb mix (wet/dry)
      // We can't directly control reverb amount, so we'll use gain to mix
      const reverbGain = settings.reverb;
      const dryGain = 1 - settings.reverb * 0.7; // Keep some dry signal

      // For simplicity, we'll adjust the overall output gain based on reverb
      outputGain.gain.value = settings.volume;

      // Update echo amount
      if (delayNode.delayTime) {
        delayNode.delayTime.value = 0.2 + settings.echo * 0.3; // 200-500ms delay
      }
    }
  }, [settings, isInitialized]);

  // Initialize/cleanup
  useEffect(() => {
    if (isActive && !isInitialized) {
      initializeAudio();
    } else if (!isActive && isInitialized) {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      setIsInitialized(false);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [isActive, isInitialized, initializeAudio]);

  return {
    isInitialized,
    isActive
  };
}