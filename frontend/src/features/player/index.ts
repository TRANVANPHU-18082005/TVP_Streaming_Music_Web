export { default as FullPlayer } from "./components/FullPlayer";
export { default as MiniPlayer } from "./components/MiniPlayer";
export { default as MusicPlayer } from "./components/MusicPlayer";
export { default as PlayerControls } from "./components/PlayerControls";
export { default as ProgressBar } from "./components/ProgressBar";

export { default as VolumeControl } from "./components/VolumeControl";

export * from "./hooks/useAudioPlayer";
export * from "./hooks/useCrossTabSync";
export * from "./hooks/useKeyboardControls";

export * from "./slice/playerSlice";

// 🪄 Xuất services / slice nếu cần dùng global
export * from "./slice/playerSlice";

// 🧩 Xuất types (nếu có dùng bên ngoài feature khác)
