// src/hooks/use-theme.ts
import { createContext, useContext } from "react";

export type Theme = "dark" | "light" | "system";
export type Skin =
  | "obsidian" // Mặc định
  | "tokyo" // Neon Cyberpunk
  | "sahara" // Luxury Gold
  | "nordic" // Arctic Blue
  | "amazon" // Forest Zen
  | "crimson" // Passion Red
  | "vapor" // 80s Dream
  | "slate" // Midnight Slate
  | "ocean" // Deep Ocean (New)
  | "rose" // Rose Gold (New)
  | "lime" // Neon Lime (New)
  | "mono" // Obsidian Mono (New)
  | "arctic"
  | "aurora"
  | "ember"
  | "galaxy"
  | "matcha"
  | "dusk"; // Arctic Light (New)
export type ThemeProviderState = {
  theme: Theme;
  skin: Skin;
  setTheme: (theme: Theme) => void;
  setSkin: (skin: Skin) => void; // Thêm dòng này
};

export const initialState: ThemeProviderState = {
  theme: "system",
  skin: "obsidian",
  setTheme: () => null,
  setSkin: () => null,
};

export const ThemeProviderContext =
  createContext<ThemeProviderState>(initialState);

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
