import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KaraokeSettings, KaraokeSession } from '../types';
import VideoOutput from './VideoOutput';

interface VisualStageProps {
  session: KaraokeSession;
  settings: KaraokeSettings;
  playbackState: { currentTime: number; phase: any; isPlaying: boolean; duration: number };
}

export default function VisualStage({ session, settings, playbackState }: VisualStageProps) {
  const [isVirtualCameraMode, setIsVirtualCameraMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const [shaderError, setShaderError] = useState<string | null>(null);

  // Default Shadertoy-style fragment shader
  const [fragmentShader, setFragmentShader] = useState<string>(`
    precision mediump float;
    uniform float iTime;
    uniform vec2 iResolution;
    uniform vec3 iAudioLow;
    uniform vec3 iAudioMid;
    uniform vec3 iAudioHigh;

    void main() {
      vec2 uv = gl_FragCoord.xy / iResolution.xy;
      uv = uv * 2.0 - 1.0;
      uv.x *= iResolution.x / iResolution.y;

      // Audio-reactive colors
      vec3 color = vec3(0.0);
      color.r = iAudioLow.x * 0.5 + sin(iTime + uv.x * 10.0) * 0.1;
      color.g = iAudioMid.y * 0.5 + cos(iTime + uv.y * 8.0) * 0.1;
      color.b = iAudioHigh.z * 0.5 + sin(iTime * 2.0 + length(uv) * 5.0) * 0.1;

      // Add some geometric patterns
      float pattern = sin(uv.x * 20.0 + iTime) * sin(uv.y * 20.0 + iTime);
      color += vec3(pattern * 0.1);

      gl_FragColor = vec4(color, 1.0);
    }
  `);

  const vertexShaderSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const initWebGL = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    glRef.current = gl;

    // Create shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) return;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShaderObj = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShaderObj) return;
    gl.shaderSource(fragmentShaderObj, fragmentShader);
    gl.compileShader(fragmentShaderObj);

    // Check for compilation errors
    if (!gl.getShaderParameter(fragmentShaderObj, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(fragmentShaderObj);
      console.error('Fragment shader compilation error:', error);
      setShaderError(error || 'Unknown shader compilation error');
      return;
    } else {
      setShaderError(null);
    }

    // Create program
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShaderObj);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      return;
    }

    programRef.current = program;
    gl.useProgram(program);

    // Create quad
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const timeLocation = gl.getUniformLocation(program, 'iTime');
    const resolutionLocation = gl.getUniformLocation(program, 'iResolution');
    const audioLowLocation = gl.getUniformLocation(program, 'iAudioLow');
    const audioMidLocation = gl.getUniformLocation(program, 'iAudioMid');
    const audioHighLocation = gl.getUniformLocation(program, 'iAudioHigh');

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

    // Animation loop
    const animate = () => {
      if (!gl || !program) return;

      const currentTime = (Date.now() - startTimeRef.current) / 1000;
      gl.uniform1f(timeLocation, currentTime);

      // Audio data
      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);

        const low = dataArrayRef.current.slice(0, 10).reduce((a, b) => a + b) / 10 / 255;
        const mid = dataArrayRef.current.slice(10, 50).reduce((a, b) => a + b) / 40 / 255;
        const high = dataArrayRef.current.slice(50, 128).reduce((a, b) => a + b) / 78 / 255;

        gl.uniform3f(audioLowLocation, low, low * 0.8, low * 0.6);
        gl.uniform3f(audioMidLocation, mid, mid * 0.8, mid * 0.6);
        gl.uniform3f(audioHighLocation, high, high * 0.8, high * 0.6);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [fragmentShader]);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      // Try to connect to audio element if available
      // For now, we'll generate some test audio data
      // In production, this would connect to the actual audio source
    }
  }, []);

  useEffect(() => {
    initWebGL();
    initAudio();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [initWebGL, initAudio]);

  // Listen for shader updates from BroadcastChannel
  useEffect(() => {
    const bc = new BroadcastChannel('karaoke-sync');
    bc.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'SHADER_UPDATE') {
        setFragmentShader(payload);
      }
    };
    return () => bc.close();
  }, []);

  // Listen for Electron IPC messages
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onEnableVideoOutput(() => {
        setIsVirtualCameraMode(true);
      });
    }
  }, []);

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      {isVirtualCameraMode ? (
        <VideoOutput
          session={session}
          settings={settings}
          playbackState={playbackState}
          canvasRef={canvasRef}
          onBackToVisual={() => setIsVirtualCameraMode(false)}
        />
      ) : (
        <>
          {/* WebGL Canvas */}
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            width={1280}
            height={720}
          />

          {/* Shader Info Overlay */}
          <div className="absolute top-4 left-4 text-white/70 font-mono text-xs space-y-1">
            <div>Shadertoy Visual</div>
            <div>Audio Reactive: {analyserRef.current ? 'Active' : 'Inactive'}</div>
            <div>FPS: {animationRef.current ? '60' : '0'}</div>
            {shaderError && (
              <div className="text-red-400 max-w-xs">
                Shader Error: {shaderError}
              </div>
            )}
          </div>

          {/* Virtual Camera Toggle */}
          <button
            onClick={() => setIsVirtualCameraMode(true)}
            className="absolute top-4 right-4 px-3 py-2 bg-purple-600/20 border border-purple-600/40 rounded text-xs text-purple-400 hover:bg-purple-600/30 transition-all font-mono"
          >
            Video Output Modes
          </button>

          {/* Playback indicator */}
          {playbackState.isPlaying && (
            <motion.div
              className="absolute bottom-4 right-4 w-3 h-3 bg-cyan-400 rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </>
      )}
    </div>
  );
}
