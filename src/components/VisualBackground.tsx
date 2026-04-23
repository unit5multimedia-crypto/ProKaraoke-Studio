import React, { useRef, useEffect } from 'react';
import { PRESET_SHADERS, SHADER_BOILERPLATE } from '../lib/shaders';

interface VisualBackgroundProps {
  analyser: AnalyserNode | null;
  theme: string;
  sensitivity: number;
  customGLSL?: string;
}

const vertexShaderSource = `#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}
`;

export const VisualBackground: React.FC<VisualBackgroundProps> = ({ analyser, theme, sensitivity, customGLSL }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Fallback if theme not found
    const activeTheme = theme === 'custom' && customGLSL 
      ? { glsl: customGLSL }
      : PRESET_SHADERS[theme] || PRESET_SHADERS['nebula'];
      
    const currentGLSL = SHADER_BOILERPLATE.replace('${USER_GLSL}', activeTheme.glsl);

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error("WebGL2 not supported");
      return;
    }

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader Compile Error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    // Fragment Shader Version Prep
    const fSource = `#version 300 es\n${currentGLSL}`;
    let fShader = compileShader(gl.FRAGMENT_SHADER, fSource);

    if (!fShader) {
       console.warn("Falling back to default shader due to compilation error.");
       const fallbackSource = `#version 300 es\n${SHADER_BOILERPLATE.replace('${USER_GLSL}', PRESET_SHADERS['nebula'].glsl)}`;
       fShader = compileShader(gl.FRAGMENT_SHADER, fallbackSource);
    }

    if (!vShader || !fShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
       console.error("Program Link Error:", gl.getProgramInfoLog(program));
       return;
    }

    gl.useProgram(program);

    // Setup fullscreen quad
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const iTimeLoc = gl.getUniformLocation(program, "iTime");
    const iResLoc = gl.getUniformLocation(program, "iResolution");
    const sensitivityLoc = gl.getUniformLocation(program, "u_sensitivity");
    const channel0Loc = gl.getUniformLocation(program, "iChannel0");

    // Audio Texture Setup
    const audioTexture = gl.createTexture();
    const fftSize = analyser ? analyser.frequencyBinCount : 256;
    const fftData = new Uint8Array(fftSize);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, audioTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    let animationId: number;
    let startTime = performance.now();

    const render = (time: number) => {
      const { offsetWidth: width, offsetHeight: height } = canvas;
      if (canvas.width !== width || canvas.height !== height) {
         canvas.width = width;
         canvas.height = height;
         gl.viewport(0, 0, width, height);
      }

      if (analyser) {
        analyser.getByteFrequencyData(fftData);
      } else {
        fftData.fill(0);
      }

      // Update Audio Texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, audioTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, fftData.length, 1, 0, gl.RED, gl.UNSIGNED_BYTE, fftData);

      gl.useProgram(program);
      gl.uniform1f(iTimeLoc, (time - startTime) / 1000.0);
      gl.uniform2f(iResLoc, canvas.width, canvas.height);
      gl.uniform1f(sensitivityLoc, sensitivity);
      gl.uniform1i(channel0Loc, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    
    return () => cancelAnimationFrame(animationId);
  }, [analyser, theme, sensitivity, customGLSL]);

  return (
    <div className="absolute inset-0 bg-black overflow-hidden pointer-events-none">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full object-cover"
        width={window.innerWidth}
        height={window.innerHeight}
      />
      {/* Mesh Overlay for CRT/Arena aesthetics */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] opacity-40 pointer-events-none" />
    </div>
  );
};
