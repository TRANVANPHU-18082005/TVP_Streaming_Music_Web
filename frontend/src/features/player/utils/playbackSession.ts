export type PlaybackOwner = "catalog" | "room" | "short" | "mashup" | "karaoke";

type Suspend = () => void;

const handlers = new Map<PlaybackOwner, Set<Suspend>>();
let activeOwner: PlaybackOwner | null = null;
let activeSuspend: Suspend | null = null;

export function bindPlaybackOwner(owner: PlaybackOwner, suspend: Suspend): () => void {
  let set = handlers.get(owner);
  if (!set) {
    set = new Set();
    handlers.set(owner, set);
  }
  set.add(suspend);
  return () => {
    set.delete(suspend);
    if (set.size === 0) handlers.delete(owner);
    if (activeSuspend === suspend) {
      activeSuspend = null;
      activeOwner = null;
    }
  };
}

/**
 * Pause every other playback surface. `self` is the suspend callback registered
 * for this caller, so a second instance of the same owner (two shorts, studio
 * and karaoke modal) is paused too.
 */
export function acquirePlayback(owner: PlaybackOwner, self?: Suspend): void {
  if (activeOwner === owner && activeSuspend === (self ?? null)) return;
  activeOwner = owner;
  activeSuspend = self ?? null;
  handlers.forEach((set) => {
    set.forEach((suspend) => {
      if (suspend !== self) suspend();
    });
  });
}

export function releasePlayback(owner: PlaybackOwner, self?: Suspend): void {
  if (activeOwner !== owner) return;
  if (self && activeSuspend && activeSuspend !== self) return;
  activeOwner = null;
  activeSuspend = null;
}

export function getActivePlayback(): PlaybackOwner | null {
  return activeOwner;
}
