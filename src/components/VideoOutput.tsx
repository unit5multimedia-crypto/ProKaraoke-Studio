import React, { useState, useRef, useEffect } from 'react';
import { Monitor, Maximize, Camera, Settings, ArrowLeft, Play, Square } from 'lucide-react';

interface VideoOutputProps {
  session: any;
  settings: any;
  playbackState: any;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  onBackToVisual?: () => void;
}

export default function VideoOutput({ session, settings, playbackState, canvasRef, onBackToVisual }: VideoOutputProps) {
  const [outputMode, setOutputMode] = useState<'window' | 'projection' | 'stream'>('window');
  const [isStreaming, setIsStreaming] = useState(false);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Copy the WebGL canvas content to our output canvas
    if (!canvasRef?.current || !outputCanvasRef.current) return;

    const sourceCanvas = canvasRef.current;
    const outputCanvas = outputCanvasRef.current;
    const ctx = outputCanvas.getContext('2d');

    if (!ctx) return;

    const copyFrame = () => {
      ctx.drawImage(sourceCanvas, 0, 0, outputCanvas.width, outputCanvas.height);
      requestAnimationFrame(copyFrame);
    };

    copyFrame();
  }, [canvasRef]);

  const startStreaming = async () => {
    try {
      if (!outputCanvasRef.current) return;

      const canvas = outputCanvasRef.current;
      const stream = canvas.captureStream(30); // 30 FPS stream
      streamRef.current = stream;

      // In a real implementation, this stream would be made available to other applications
      // For now, we'll just mark it as streaming
      setIsStreaming(true);

      console.log('Video output stream started:', stream);
    } catch (error) {
      console.error('Failed to start video output stream:', error);
    }
  };

  const stopStreaming = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  };

  const enterProjectionMode = () => {
    setOutputMode('projection');
    // In Electron, this would make the window fullscreen
    if (window.electronAPI) {
      // Send IPC to make window fullscreen
    }
  };

  const enterWindowMode = () => {
    setOutputMode('window');
    // Reset window to normal size
  };

  const enterStreamMode = () => {
    setOutputMode('stream');
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Output Canvas */}
      <canvas
        ref={outputCanvasRef}
        className="flex-1 w-full h-full"
        width={1920}
        height={1080}
      />

      {/* Output Mode Selector */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-brand-gold" />
            <span className="text-sm font-mono text-white/80">ProKaraoke Video Output</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" />
            <span className="text-xs font-mono text-white/60">
              Stream: {isStreaming ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="text-xs font-mono text-white/40">
            Mode: {outputMode === 'window' ? 'Window' : outputMode === 'projection' ? 'Projection' : 'Stream Output'}
          </div>
        </div>

        <div className="glass-panel p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={enterWindowMode}
              className="flex items-center gap-2 px-3 py-2 border rounded text-xs font-mono transition-all"
            >
              <Monitor className="w-4 h-4" />
              Window
            </button>

            <button
              onClick={enterProjectionMode}
              className="flex items-center gap-2 px-3 py-2 border rounded text-xs font-mono transition-all"
            >
              <Maximize className="w-4 h-4" />
              Project
            </button>

            <button
              onClick={enterStreamMode}
              className="flex items-center gap-2 px-3 py-2 border rounded text-xs font-mono transition-all"
            >
              <Camera className="w-4 h-4" />
              Stream
            </button>

            <button
              onClick={onBackToVisual}
              className="flex items-center gap-2 px-3 py-2 bg-gray-600/20 border border-gray-600/40 rounded text-xs text-gray-400 hover:bg-gray-600/30 transition-all font-mono"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>

          {outputMode === 'stream' && (
            <div className="border-t border-white/10 pt-3">
              <button
                onClick={isStreaming ? stopStreaming : startStreaming}
                className="flex items-center gap-2 px-3 py-2 w-full border rounded text-xs font-mono transition-all"
              >
                {isStreaming ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isStreaming ? 'Stop Stream' : 'Start Stream'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-4 left-4 right-4 glass-panel p-3">
        <div className="flex items-center justify-between text-xs font-mono text-white/60">
          <div className="flex items-center gap-4">
            <span>Resolution: 1920x1080</span>
            <span>FPS: 30</span>
            <span>Format: Direct Stream</span>
            <span>Output: {outputMode}</span>
          </div>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span>Professional Video Output</span>
          </div>
        </div>
      </div>

      {/* Mode-specific overlays */}
      {outputMode === 'projection' && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 glass-panel px-4 py-2">
            <span className="text-sm font-mono text-white/80">Projection Mode Active</span>
          </div>
        </div>
      )}

      {outputMode === 'stream' && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 glass-panel px-4 py-2">
            <span className="text-sm font-mono text-green-400">
              Stream Output Active - Connect in Streaming Software
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
