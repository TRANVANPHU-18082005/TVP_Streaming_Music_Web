import { useEffect, useRef } from "react";

interface MashupWaveformBarProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  /** Number of bars to render */
  bars?: number;
  /** Color of bars */
  color?: string;
  /** Secondary color for gradient */
  accentColor?: string;
  /** Whether to render bars symmetrically (mirrored) */
  mirrorMode?: boolean;
  className?: string;
  height?: number;
}

/**
 * Realtime waveform visualizer using Web Audio API AnalyserNode.
 * Renders animated frequency bars on a canvas.
 */
export const MashupWaveformBar = ({
  analyserNode,
  isPlaying,
  bars = 32,
  color = "#6366f1",
  accentColor,
  mirrorMode = false,
  className = "",
  height = 48,
}: MashupWaveformBarProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyserNode ? analyserNode.frequencyBinCount : bars);
    let animating = true;

    const draw = () => {
      if (!animating) return;
      rafRef.current = requestAnimationFrame(draw);

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (analyserNode && isPlaying) {
        analyserNode.getByteFrequencyData(dataArray);
      }

      const barCount = bars;
      const step = Math.floor(dataArray.length / barCount);
      const barW = W / barCount;
      const gap = Math.max(1, barW * 0.2);

      for (let i = 0; i < barCount; i++) {
        const dataIdx = i * step;
        let rawValue = analyserNode && isPlaying ? dataArray[dataIdx] : 0;

        // Idle state: better random noise animation with phase offset
        if (!isPlaying) {
          rawValue = Math.sin(Date.now() / (800 + i * 20) + i * 0.5) * 20 + 20;
        }

        const ratio = Math.max(0, rawValue / 255);
        const barHeight = Math.max(3, ratio * (mirrorMode ? H / 2 : H));

        // Helper to safely apply alpha to either hex or rgba colors
        const getAlphaColor = (c: string, alphaStr: string, alphaNum: number) => {
          if (c.startsWith("#")) return `${c}${alphaStr}`;
          if (c.startsWith("rgba")) return c.replace(/[\d.]+\)$/g, `${alphaNum})`);
          if (c.startsWith("rgb")) return c.replace("rgb", "rgba").replace(")", `, ${alphaNum})`);
          return c;
        };

        const targetAccent = accentColor || color;

        if (mirrorMode) {
          // Top half
          const gradientTop = ctx.createLinearGradient(0, H / 2, 0, H / 2 - barHeight);
          gradientTop.addColorStop(0, getAlphaColor(color, "cc", 0.8));
          gradientTop.addColorStop(1, getAlphaColor(targetAccent, "44", 0.27));
          ctx.fillStyle = gradientTop;
          
          const x = i * barW + gap / 2;
          const w = barW - gap;
          const yTop = H / 2 - barHeight;
          const radius = Math.min(w / 2, 3);
          
          ctx.beginPath();
          ctx.moveTo(x + radius, yTop);
          ctx.lineTo(x + w - radius, yTop);
          ctx.quadraticCurveTo(x + w, yTop, x + w, yTop + radius);
          ctx.lineTo(x + w, H / 2);
          ctx.lineTo(x, H / 2);
          ctx.lineTo(x, yTop + radius);
          ctx.quadraticCurveTo(x, yTop, x + radius, yTop);
          ctx.closePath();
          ctx.fill();

          // Bottom half
          const gradientBot = ctx.createLinearGradient(0, H / 2, 0, H / 2 + barHeight);
          gradientBot.addColorStop(0, getAlphaColor(color, "cc", 0.8));
          gradientBot.addColorStop(1, getAlphaColor(targetAccent, "44", 0.27));
          ctx.fillStyle = gradientBot;
          
          const yBot = H / 2 + barHeight;
          ctx.beginPath();
          ctx.moveTo(x, H / 2);
          ctx.lineTo(x + w, H / 2);
          ctx.lineTo(x + w, yBot - radius);
          ctx.quadraticCurveTo(x + w, yBot, x + w - radius, yBot);
          ctx.lineTo(x + radius, yBot);
          ctx.quadraticCurveTo(x, yBot, x, yBot - radius);
          ctx.closePath();
          ctx.fill();

        } else {
          // Standard bottom-up
          const gradient = ctx.createLinearGradient(0, H, 0, H - barHeight);
          gradient.addColorStop(0, getAlphaColor(color, "44", 0.27));
          gradient.addColorStop(0.6, color);
          gradient.addColorStop(1, getAlphaColor(targetAccent, "cc", 0.8));

          ctx.fillStyle = gradient;
          const x = i * barW + gap / 2;
          const w = barW - gap;
          const y = H - barHeight;

          // Rounded tops
          const radius = Math.min(w / 2, 3);
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + w - radius, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
          ctx.lineTo(x + w, H);
          ctx.lineTo(x, H);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();
        }
      }
    };

    draw();
    return () => {
      animating = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyserNode, isPlaying, bars, color]);

  return (
    <canvas
      ref={canvasRef}
      width={bars * 8}
      height={height}
      className={`w-full ${className}`}
      style={{ height }}
    />
  );
};
