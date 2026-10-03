type AudioClockListener = (time: number) => void;

const listeners = new Set<AudioClockListener>();

export function publishAudioClock(time: number): void {
  if (!Number.isFinite(time)) return;
  listeners.forEach((listener) => listener(time));
}

export function subscribeAudioClock(listener: AudioClockListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
