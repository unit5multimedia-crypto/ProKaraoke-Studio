import { useEffect, useRef, useState } from 'react';
import { getAudioContext, resumeAudioContext } from '../lib/audioContext';

// Global registry to prevent double-initialization of media elements which causes freezing
// We use a Map to keep track of sources, and a Set to track elements currently being initialized
const mediaSourceRegistry = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
const pendingInitializations = new WeakSet<HTMLMediaElement>();

export function useAudioAnalyzer(isActive: boolean, settings?: { vocalCut?: boolean; mediaVolume?: number }) {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const effectsNodesRef = useRef<{splitter?: ChannelSplitterNode, merger?: ChannelMergerNode, gainL?: GainNode, gainR?: GainNode, masterGain?: GainNode, invertGain?: GainNode} | null>(null);

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
      
      // Cleanup previous effects if changing
      if (!effectsNodesRef.current) {
         effectsNodesRef.current = { masterGain: ctx.createGain() };
         effectsNodesRef.current.masterGain!.connect(ctx.destination);
         effectsNodesRef.current.masterGain!.connect(currentAnalyser);
      }
      
      // Update master gain
      if (effectsNodesRef.current.masterGain) {
         effectsNodesRef.current.masterGain.gain.value = settings?.mediaVolume !== undefined ? settings.mediaVolume : 1.0;
      }

      if (mediaSourceRegistry.has(element)) {
        const existingSource = mediaSourceRegistry.get(element);
        if (existingSource) {
           try { 
              existingSource.disconnect();
              
              if (settings?.vocalCut) {
                 if (!effectsNodesRef.current.splitter) {
                    const splitter = ctx.createChannelSplitter(2);
                    const merger = ctx.createChannelMerger(2);
                    const gainL = ctx.createGain();
                    const gainR = ctx.createGain();
                    const invertGain = ctx.createGain();
                    
                    invertGain.gain.value = -1; // Invert phase
                    
                    existingSource.connect(splitter);
                    
                    // Left channel to Left Merge
                    splitter.connect(gainL, 0);
                    gainL.connect(merger, 0, 0);
                    gainL.connect(merger, 0, 1);
                    
                    // Right channel inverted to Left Merge
                    splitter.connect(invertGain, 1);
                    invertGain.connect(merger, 0, 0);
                    invertGain.connect(merger, 0, 1);
                    
                    merger.connect(effectsNodesRef.current.masterGain!);
                    
                    effectsNodesRef.current = { ...effectsNodesRef.current, splitter, merger, gainL, gainR, invertGain };
                 } else {
                    existingSource.connect(effectsNodesRef.current.splitter!);
                 }
              } else {
                 existingSource.connect(effectsNodesRef.current.masterGain!);
              }
           } catch(e) {}
        }
      } else if (!pendingInitializations.has(element)) {
        pendingInitializations.add(element);
        try {
          const mSource = ctx.createMediaElementSource(element);
          mediaSourceRegistry.set(element, mSource);
          
          if (settings?.vocalCut) {
             const splitter = ctx.createChannelSplitter(2);
             const merger = ctx.createChannelMerger(2);
             const gainL = ctx.createGain();
             const gainR = ctx.createGain();
             const invertGain = ctx.createGain();
             
             invertGain.gain.value = -1;
             
             mSource.connect(splitter);
             splitter.connect(gainL, 0);
             gainL.connect(merger, 0, 0);
             gainL.connect(merger, 0, 1);
             
             splitter.connect(invertGain, 1);
             invertGain.connect(merger, 0, 0);
             invertGain.connect(merger, 0, 1);
             
             merger.connect(effectsNodesRef.current.masterGain!);
             
             effectsNodesRef.current = { ...effectsNodesRef.current, splitter, merger, gainL, gainR, invertGain };
          } else {
             mSource.connect(effectsNodesRef.current.masterGain!);
          }
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
