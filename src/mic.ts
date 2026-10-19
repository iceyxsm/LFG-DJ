import { setState } from "./state";

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let freqData: Uint8Array<ArrayBuffer> | null = null;
let enabled = false;

const FFT_SIZE = 2048;
const SPECTRUM_BINS = 128;

export async function enableMic(): Promise<void> {
  if (enabled) return;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  audioCtx = new AudioContext();
  const src = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.75;
  src.connect(analyser);
  freqData = new Uint8Array(analyser.frequencyBinCount);
  enabled = true;
  setState({ statusMessage: "Mic boost on" });
}

export function disableMic(): void {
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
  }
  if (audioCtx) audioCtx.close().catch(() => {});
  stream = null;
  audioCtx = null;
  analyser = null;
  freqData = null;
  enabled = false;
  setState({ energy: 0, bands: { bass: 0, mid: 0, treble: 0 }, spectrum: [] });
}

export function micEnabled(): boolean {
  return enabled;
}

function bandEnergy(
  data: Uint8Array,
  sampleRate: number,
  fftSize: number,
  loHz: number,
  hiHz: number
): number {
  const binHz = sampleRate / fftSize;
  const lo = Math.max(0, Math.floor(loHz / binHz));
  const hi = Math.min(data.length - 1, Math.ceil(hiHz / binHz));
  if (hi <= lo) return 0;
  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += data[i];
  return sum / ((hi - lo + 1) * 255);
}

function foldSpectrum(data: Uint8Array, bins: number): number[] {
  const n = data.length;
  const out = new Array<number>(bins);
  for (let b = 0; b < bins; b++) {
    const i0 = Math.floor((b * n) / bins);
    const i1 = Math.max(i0 + 1, Math.floor(((b + 1) * n) / bins));
    let sum = 0;
    let c = 0;
    for (let i = i0; i < i1 && i < n; i++) {
      sum += data[i];
      c++;
    }
    out[b] = c ? sum / (c * 255) : 0;
  }
  return out;
}

export function sampleMic(): void {
  if (!enabled || !analyser || !freqData || !audioCtx) return;
  analyser.getByteFrequencyData(freqData);
  const sr = audioCtx.sampleRate;
  const bass = bandEnergy(freqData, sr, FFT_SIZE, 20, 160);
  const mid = bandEnergy(freqData, sr, FFT_SIZE, 160, 2000);
  const treble = bandEnergy(freqData, sr, FFT_SIZE, 2000, 12000);
  const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;
  setState({
    energy: Math.min(1, energy),
    bands: {
      bass: Math.min(1, bass),
      mid: Math.min(1, mid),
      treble: Math.min(1, treble),
    },
    spectrum: foldSpectrum(freqData, SPECTRUM_BINS),
  });
}
