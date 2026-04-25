import { useState, useEffect, useRef } from 'react';
import { detectPitch } from '../lib/pitchDetection';
import { getAudioContext, resumeAudioContext } from '../lib/audioContext';

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
       // Note: We don't close the shared context here
       engineRef.current = null;
       (window as any).karaokeMicAnalyser = null;
       return;
    }

    let isMounted = true;
    const ctx = getAudioContext();
    resumeAudioContext();

    const setup = async () => {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: (deviceId && deviceId !== "default") ? { deviceId: { exact: deviceId } } : true
          });
        } catch (e: any) {
          if (e.name === 'OverconstrainedError' || e.name === 'NotFoundError') {
            console.warn("Requested mic not found, falling back to default");
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } else {
            throw e;
          }
        }

        if (outputId && typeof (ctx as any).setSinkId === 'function') {
          try { await (ctx as any).setSinkId(outputId); } catch(e) { console.error("Sink ID error", e); }
        }

        const source = ctx.createMediaStreamSource(stream);

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        (window as any).karaokeMicAnalyser = analyser;

        const micGain = ctx.createGain();
        micGain.gain.value = volume;

        const delay = ctx.createDelay(2.0);
        delay.delayTime.value = 0.25;
        const delayFeedback = ctx.createGain();
        delayFeedback.gain.value = 0.4;
        const echoGain = ctx.createGain();
        echoGain.gain.value = echo;

        source.connect(analyser); 
        source.connect(micGain);
        micGain.connect(ctx.destination);

        source.connect(delay);
        delay.connect(delayFeedback);
        delayFeedback.connect(delay);
        delay.connect(echoGain);
        echoGain.connect(ctx.destination);

        let lastUpdate = 0;
        const timeData = new Float32Array(analyser.fftSize);
        const loop = (timestamp: number) => {
          if (!isMounted) return;
          
          if (timestamp - lastUpdate > 100) {
            analyser.getFloatTimeDomainData(timeData);
            const p = detectPitch(timeData, ctx.sampleRate);
            if (p !== null) { // only update state if valid pitch or throttling
               setPitch(p);
            }
            lastUpdate = timestamp;
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);

        engineRef.current = { ctx, stream, micGain, echoGain };
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
      }
    };
  }, [isActive, deviceId, outputId]);

  useEffect(() => {
     if (engineRef.current) {
        const { micGain, echoGain, ctx } = engineRef.current;
        if (micGain) micGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
        if (echoGain) echoGain.gain.setTargetAtTime(echo, ctx.currentTime, 0.05);
     }
  }, [volume, echo]);

  return { pitch };
}
