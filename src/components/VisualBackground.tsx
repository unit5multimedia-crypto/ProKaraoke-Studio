import React, { useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface VisualBackgroundProps {
  fftData: Uint8Array;
  theme: string;
  sensitivity: number;
}

export const VisualBackground: React.FC<VisualBackgroundProps> = ({ fftData, theme, sensitivity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simple reactive visualizer 
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Average frequency for global pulsation
      const avg = fftData.reduce((acc, val) => acc + val, 0) / (fftData.length || 1);
      const pulse = (avg / 255) * sensitivity;

      // Draw background glow
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, width * (0.5 + pulse)
      );
      grad.addColorStop(0, `rgba(255, 215, 0, ${0.2 + pulse * 2})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Bars visualization
      const barWidth = width / fftData.length;
      fftData.forEach((val, i) => {
        const barHeight = (val / 255) * height * 0.5 * sensitivity;
        ctx.fillStyle = `rgba(255, 215, 0, ${0.1 + (val / 255) * 0.5})`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      });

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [fftData, sensitivity]);

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
