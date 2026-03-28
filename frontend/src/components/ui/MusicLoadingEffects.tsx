import React, { memo } from "react";
import { Music } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Style injection — module scope, once only (FIX 1) ──────────────────────

const LOADER_STYLE_ID = "__soundwave-loader-styles__";

const LOADER_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  @keyframes liquid-bar-clean {
    0%, 100% { height: 30%; opacity: 0.4; }
    50%       { height: 90%; opacity: 1;   }
  }
  @keyframes vinyl-spin-smooth {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(0.9); box-shadow: 0 0 0 0   rgba(0,0,0,0.1); }
    70%  { transform: scale(1);   box-shadow: 0 0 0 10px rgba(0,0,0,0);  }
    100% { transform: scale(0.9); box-shadow: 0 0 0 0   rgba(0,0,0,0);   }
  }
  @keyframes float-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0);    }
  }

  .font-music-hub   { font-family: 'Inter', sans-serif; }
  .hub-card         { background: white; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border-radius: 12px; }
  .hub-btn-primary  { background-color: #0f172a; color: white; transition: all 0.2s; }
  .hub-btn-primary:hover  { background-color: #1e293b; transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  .hub-btn-secondary { background-color: white; border: 1px solid #e2e8f0; color: #1e293b; transition: all 0.2s; }
  .hub-btn-secondary:hover { border-color: #cbd5e1; background-color: #f8fafc; }

  .custom-scrollbar::-webkit-scrollbar       { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 20px; }

  .animate-liquid-clean  { animation: liquid-bar-clean 1s ease-in-out infinite; }
  .animate-vinyl-smooth  { animation: vinyl-spin-smooth 4s linear infinite; }
  .animate-pulse-clean   { animation: pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite; }
  .animate-float         { animation: float-in 0.5s ease-out forwards; }
`;

// Inject once at module load time (FIX 1)
if (
  typeof document !== "undefined" &&
  !document.getElementById(LOADER_STYLE_ID)
) {
  const s = document.createElement("style");
  s.id = s.textContent = LOADER_STYLES;
  s.id = LOADER_STYLE_ID;
  document.head.appendChild(s);
}

// ── Equalizer durations — module scope, never recreated (FIX 2) ────────────
// Deterministic values that look random but are stable across renders.
const EQUALIZER_DURATIONS = [0.82, 0.95, 0.78, 1.08, 0.88] as const;

// ── Shared props interface ──────────────────────────────────────────────────

interface LoaderProps {
  fullscreen?: boolean;
  className?: string;
  text?: React.ReactNode;
}

// ── MusicContainer — no longer injects styles (FIX 1) ──────────────────────

const MusicContainer = memo<LoaderProps & { children: React.ReactNode }>(
  ({ fullscreen, children, className }) => (
    <div
      className={cn(
        "flex flex-col items-center justify-center font-music-hub",
        fullscreen
          ? "fixed inset-0 z-[9999] bg-[#fafafa]"
          : "relative w-full h-full bg-[#f8fafc] overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 bg-white opacity-50" />
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  ),
);
MusicContainer.displayName = "MusicContainer";

// ── EqualizerLoader (FIX 2, 4) ───────────────────────────────────────────────

export const EqualizerLoader = memo<LoaderProps>(
  ({ fullscreen, text = "Loading..." }) => (
    <MusicContainer fullscreen={fullscreen}>
      <div
        className={cn(
          "flex flex-col items-center gap-6",
          fullscreen && "scale-125",
        )}
      >
        <div className="flex items-end justify-center gap-1.5 h-16">
          {EQUALIZER_DURATIONS.map((dur, i) => (
            <div
              key={i}
              className="w-2 bg-slate-900 rounded-full animate-liquid-clean"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: `${dur}s`, // FIX 2: stable, not Math.random()
              }}
            />
          ))}
        </div>
        <p className="text-slate-500 text-xs font-semibold tracking-wider uppercase">
          {text}
        </p>
      </div>
    </MusicContainer>
  ),
);
EqualizerLoader.displayName = "EqualizerLoader";

// ── VinylLoader (FIX 4) ──────────────────────────────────────────────────────

export const VinylLoader = memo<LoaderProps>(
  ({ fullscreen, text = "Loading..." }) => (
    <MusicContainer fullscreen={fullscreen}>
      <div
        className={cn(
          "flex flex-col items-center gap-6",
          fullscreen && "scale-125",
        )}
      >
        <div className="relative w-28 h-28 rounded-full bg-slate-900 shadow-xl flex items-center justify-center animate-vinyl-smooth">
          <div className="absolute inset-0 rounded-full border-[8px] border-slate-800 opacity-50" />
          <div className="absolute inset-6 rounded-full border border-white/10" />
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center relative z-10 shadow-sm">
            <div className="w-1.5 h-1.5 bg-black rounded-full" />
          </div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
        </div>
        <p className="text-slate-500 text-xs font-semibold tracking-wider uppercase">
          {text}
        </p>
      </div>
    </MusicContainer>
  ),
);
VinylLoader.displayName = "VinylLoader";

// ── PulseLoader (FIX 4) ──────────────────────────────────────────────────────

export const PulseLoader = memo<LoaderProps>(
  ({ fullscreen, text = "Please wait..." }) => (
    <MusicContainer fullscreen={fullscreen}>
      <div
        className={cn(
          "flex flex-col items-center gap-6",
          fullscreen && "scale-125",
        )}
      >
        <div className="relative flex items-center justify-center w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-slate-200 animate-pulse-clean" />
          <div
            className="absolute inset-4 rounded-full bg-slate-300 animate-pulse-clean"
            style={{ animationDelay: "0.5s" }}
          />
          <div className="relative z-10 w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center shadow-lg text-white">
            <Music size={20} fill="currentColor" />
          </div>
        </div>
        <p className="text-slate-500 text-xs font-semibold tracking-wider uppercase">
          {text}
        </p>
      </div>
    </MusicContainer>
  ),
);
PulseLoader.displayName = "PulseLoader";
