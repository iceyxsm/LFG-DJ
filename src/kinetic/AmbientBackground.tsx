import React, { useEffect, useRef } from "react";
import type { MoodPalette } from "./mood";
import { rgbCss, calculateBeatClock } from "./timing";

interface AmbientBackgroundProps {
  palette: MoodPalette | null;
  energy: number;
  bands: { bass: number; mid: number; treble: number };
  positionMs: number;
  paused: boolean;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({
  palette,
  energy,
  bands,
  positionMs,
  paused,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ palette, energy, bands, positionMs, paused });

  useEffect(() => {
    stateRef.current = { palette, energy, bands, positionMs, paused };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let rafId: number;
    let lastTime = performance.now();
    let flashIntensity = 0;
    let lastDownbeat = false;

    // Generate static 128x128 noise pattern for film grain texture
    const noiseCanvas = document.createElement("canvas");
    noiseCanvas.width = 128;
    noiseCanvas.height = 128;
    const noiseCtx = noiseCanvas.getContext("2d");
    if (noiseCtx) {
      const imgData = noiseCtx.createImageData(128, 128);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const val = Math.floor(Math.random() * 255);
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 16; // subtle 6% grain opacity
      }
      noiseCtx.putImageData(imgData, 0, 0);
    }
    const noisePattern = ctx.createPattern(noiseCanvas, "repeat");

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Peak hold array for 32 background spectrum bars
    const barCount = 36;
    const peakHold = new Float32Array(barCount).fill(0);

    const render = (now: number) => {
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;

      const { palette: pal, energy: nrg, bands: bnd, positionMs: pos, paused: isPaused } =
        stateRef.current;

      const w = canvas.width;
      const h = canvas.height;

      // 4/4 Beat Rhythm Clock
      const beat = calculateBeatClock(pos, 124);
      const synthPulse = isPaused ? 0 : beat.pulse;
      const liveBass = Math.max(bnd.bass, synthPulse);
      const liveEnergy = Math.max(nrg, synthPulse * 0.7);

      // Trigger strobe flash on downbeats or kick transients
      if (beat.isDownbeat && !lastDownbeat && liveBass > 0.5) {
        flashIntensity = 0.28;
      }
      lastDownbeat = beat.isDownbeat;
      flashIntensity = Math.max(0, flashIntensity - dt * 4.2);

      // 1. Base Tone: Deep, atmospheric tint from palette (never dead 0,0,0)
      const baseRgb = pal?.base ?? [0.03, 0.04, 0.06];
      const primaryRgb = pal?.primary ?? [0.95, 0.95, 1.0];
      const counterRgb = pal?.counter ?? [0.5, 0.5, 0.7];
      const accentRgb = pal?.accent ?? [1.0, 0.25, 0.1];

      ctx.fillStyle = rgbCss(baseRgb);
      ctx.fillRect(0, 0, w, h);

      // 2. Dynamic Volumetric Light Pools (Orbiting atmospheric glow)
      const t = pos * 0.0006;
      // Light pool 1: Accent color
      const p1X = w * (0.5 + Math.sin(t) * 0.25);
      const p1Y = h * (0.4 + Math.cos(t * 0.8) * 0.2);
      const p1Radius = Math.min(w, h) * (0.45 + liveBass * 0.25);

      const grad1 = ctx.createRadialGradient(p1X, p1Y, 10, p1X, p1Y, p1Radius);
      grad1.addColorStop(0, rgbCss(accentRgb, 0.22 + liveBass * 0.2));
      grad1.addColorStop(0.5, rgbCss(accentRgb, 0.08 + liveBass * 0.06));
      grad1.addColorStop(1, "transparent");

      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, w, h);

      // Light pool 2: Counter/Primary color
      const p2X = w * (0.5 - Math.sin(t * 0.9) * 0.28);
      const p2Y = h * (0.6 - Math.cos(t * 0.7) * 0.22);
      const p2Radius = Math.min(w, h) * (0.4 + liveEnergy * 0.2);

      const grad2 = ctx.createRadialGradient(p2X, p2Y, 10, p2X, p2Y, p2Radius);
      grad2.addColorStop(0, rgbCss(counterRgb, 0.16 + liveEnergy * 0.15));
      grad2.addColorStop(0.6, rgbCss(counterRgb, 0.05));
      grad2.addColorStop(1, "transparent");

      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      // 3. Kinetic Spectrum Equalizer Backdrop (Deep architectural columns)
      const colW = (w / barCount) * 0.75;
      const gap = (w / barCount) * 0.25;
      const maxColH = h * 0.38;

      for (let i = 0; i < barCount; i++) {
        const norm = i / (barCount - 1);
        const freqOffset = Math.sin(norm * Math.PI * 3 + t * 4) * 0.2;
        const barEnergy =
          norm < 0.35
            ? liveBass * 0.8 + freqOffset * 0.2
            : norm < 0.7
            ? liveEnergy * 0.7 + freqOffset * 0.25
            : bnd.treble * 0.8 + freqOffset * 0.2;

        const targetH = Math.max(8, Math.min(maxColH, (barEnergy + synthPulse * 0.25) * maxColH));
        peakHold[i] = Math.max(targetH, peakHold[i] - dt * 180);

        const x = i * (colW + gap) + gap * 0.5;
        const y = h - targetH;

        // Equalizer bar body
        ctx.fillStyle = rgbCss(primaryRgb, 0.07 + barEnergy * 0.12);
        ctx.fillRect(x, y, colW, targetH);

        // Peak cap
        const peakY = h - peakHold[i] - 3;
        ctx.fillStyle = rgbCss(accentRgb, 0.25 + synthPulse * 0.35);
        ctx.fillRect(x, peakY, colW, 2);
      }

      // 4. Subtle Architectural Grid / Horizon Lines
      const gridY = h * 0.72;
      ctx.beginPath();
      ctx.moveTo(0, gridY);
      ctx.lineTo(w, gridY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgbCss(primaryRgb, 0.12 + beat.pulse * 0.15);
      ctx.stroke();

      // Vertical tick markers along grid
      const tickStep = w / 16;
      for (let tx = 0; tx <= w; tx += tickStep) {
        ctx.beginPath();
        ctx.moveTo(tx, gridY - 4);
        ctx.lineTo(tx, gridY + 4);
        ctx.strokeStyle = rgbCss(accentRgb, 0.2 + beat.pulse * 0.25);
        ctx.stroke();
      }

      // 5. Downbeat Stroboscopic Flash
      if (flashIntensity > 0.01) {
        ctx.fillStyle = rgbCss(accentRgb, flashIntensity);
        ctx.fillRect(0, 0, w, h);
      }

      // 6. Deep Vignette
      const vig = ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.35,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.85
      );
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      // 7. Film Grain Noise
      if (noisePattern) {
        ctx.fillStyle = noisePattern;
        ctx.fillRect(0, 0, w, h);
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
};
