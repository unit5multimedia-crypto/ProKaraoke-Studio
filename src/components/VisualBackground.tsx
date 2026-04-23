import React, { useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface VisualBackgroundProps {
  analyser: AnalyserNode | null;
  theme: string;
  sensitivity: number;
}

export const VisualBackground: React.FC<VisualBackgroundProps> = ({ analyser, theme, sensitivity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const fftData = new Uint8Array(analyser ? analyser.frequencyBinCount : 128);

    const render = () => {
      const { offsetWidth: width, offsetHeight: height } = canvas;
      if (canvas.width !== width || canvas.height !== height) {
         canvas.width = width;
         canvas.height = height;
      }

      if (analyser) {
        analyser.getByteFrequencyData(fftData);
      } else {
        fftData.fill(0);
      }
      
      ctx.fillStyle = '#010101';
      ctx.fillRect(0, 0, width, height);

      // Average frequency for global pulsation
      const sum = fftData.reduce((acc, val) => acc + val, 0);
      const avg = sum / (fftData.length || 1);
      const pulse = (avg / 255) * sensitivity;

      // Draw background nebula glow
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, width * (0.6 + pulse)
      );
      grad.addColorStop(0, `rgba(255, 215, 0, ${0.15 + pulse * 0.5})`); // Brand Gold
      grad.addColorStop(0.5, `rgba(184, 134, 11, ${0.05 + pulse * 0.2})`); // Darker gold
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Multi-layered reactive circles
      const circleCount = 3;
      for (let j = 0; j < circleCount; j++) {
        const radius = (Math.min(width, height) * 0.2) + (avg * (j + 1) * sensitivity * 0.8);
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 - j * 0.08 + pulse})`;
        ctx.lineWidth = 1 + pulse * 15;
        ctx.stroke();
      }

      // Dynamic Bottom Bars
      const barCount = 64;
      const barWidth = width / barCount;
      const step = Math.floor(fftData.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const val = fftData[i * step] || 0;
        const normalizedVal = val / 255;
        const barHeight = normalizedVal * height * 0.5 * sensitivity;
        
        const barGrad = ctx.createLinearGradient(0, height, 0, height - barHeight);
        barGrad.addColorStop(0, `rgba(255, 215, 0, ${0.4 + normalizedVal * 0.6})`);
        barGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = barGrad;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [analyser, sensitivity]);

  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full"
        width={window.innerWidth}
        height={window.innerHeight}
      />
      {/* Mesh Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] opacity-60" />
    </div>
  );
};
