import { useState, useEffect, useRef } from 'react';
import { detectPitch } from '../lib/pitchDetection';

export function useVocalEngine(
  isActive: boolean,
  deviceId?: string,
  outputId?: string,
  volume: number = 0.8,
  echo: number = 0.3
) {
  const [pitch, setPitch] = useState<number | null>(null);
  const engineRef = useRef<any>(null);

  useEffect(() => {
    if (!isActive) {
       if (engineRef.current && engineRef.current.stream) {
         engineRef.current.stream.getTracks().forEach((t: any) => t.stop());
       }
       if (engineRef.current && engineRef.current.actx) {
         if (engineRef.current.actx.state !== 'closed') engineRef.current.actx.close();
       }
       engineRef.current = null;
       (window as any).karaokeMicAnalyser = null;
       return;
    }

    let isMounted = true;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const actx = new AudioContextClass();

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true
        });

        if (outputId && typeof (actx as any).setSinkId === 'function') {
          try { await (actx as any).setSinkId(outputId); } catch(e) { console.error("Sink ID error", e); }
        }

        const source = actx.createMediaStreamSource(stream);

        const analyser = actx.createAnalyser();
        analyser.fftSize = 2048;
        (window as any).karaokeMicAnalyser = analyser;

        const micGain = actx.createGain();
        micGain.gain.value = volume;

        // Classic Videoke Echo Loop
        const delay = actx.createDelay(2.0); // max delay 2s
        delay.delayTime.value = 0.25; // 250ms karaoke ping-pong
        const delayFeedback = actx.createGain();
        delayFeedback.gain.value = 0.4;
        const echoGain = actx.createGain();
        echoGain.gain.value = echo;

        // Route audio graph
        source.connect(analyser); 
        
        source.connect(micGain);
        micGain.connect(actx.destination);

        source.connect(delay);
        delay.connect(delayFeedback);
        delayFeedback.connect(delay);
        delay.connect(echoGain);
        echoGain.connect(actx.destination);

        const timeData = new Float32Array(analyser.fftSize);
        const loop = () => {
          if (!isMounted) return;
          analyser.getFloatTimeDomainData(timeData);
          const p = detectPitch(timeData, actx.sampleRate);
          setPitch(p);
          requestAnimationFrame(loop);
        };
        loop();

        engineRef.current = { actx, stream, micGain, echoGain };
      } catch (e) {
        console.error("Vocal engine setup failed. Check mic permissions.", e);
      }
    };

    setup();

    return () => {
      isMounted = false;
      (window as any).karaokeMicAnalyser = null;
      if (engineRef.current) {
        engineRef.current.stream.getTracks().forEach((t: any) => t.stop());
        if (engineRef.current.actx.state !== 'closed') {
           engineRef.current.actx.close();
        }
      }
    };
  }, [isActive, deviceId, outputId]); // effect manages lifecycle based on devices, volume/echo are real-time updated below

  useEffect(() => {
     if (engineRef.current) {
        const { micGain, echoGain, actx } = engineRef.current;
        if (micGain) micGain.gain.setTargetAtTime(volume, actx.currentTime, 0.05);
        if (echoGain) echoGain.gain.setTargetAtTime(echo, actx.currentTime, 0.05);
     }
  }, [volume, echo]);

  return { pitch };
}
