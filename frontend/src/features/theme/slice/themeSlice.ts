import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ThemeId =
  | "obsidian"
  | "tokyo"
  | "sahara"
  | "nordic"
  | "amazon"
  | "crimson"
  | "vapor"
  | "slate"
  | "arctic";

interface ThemeState {
  currentTheme: ThemeId;
}

// Lấy theme từ localStorage nếu có, nếu không mặc định là obsidian
const getInitialTheme = (): ThemeId => {
  if (typeof window === "undefined") return "obsidian";
  return (localStorage.getItem("soundwave-theme") as ThemeId) || "obsidian";
};

const initialState: ThemeState = {
  currentTheme: getInitialTheme(),
};

export const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<ThemeId>) => {
      const newTheme = action.payload;
      state.currentTheme = newTheme;

      // ── CẬP NHẬT DOM (Side Effect) ──────────────────────────────────
      if (typeof document !== "undefined") {
        const root = document.documentElement;

        // 1. Áp dụng data-theme để kích hoạt CSS Variables trong index.css
        root.setAttribute("data-theme", newTheme);

        // 2. Xử lý class .dark cho Dark Mode / Light Mode
        if (newTheme === "arctic") {
          root.classList.remove("dark");
        } else {
          root.classList.add("dark");
        }

        // 3. Lưu vào LocalStorage để ghi nhớ
        localStorage.setItem("soundwave-theme", newTheme);
      }
    },
  },
});

export const { setTheme } = themeSlice.actions;
export default themeSlice.reducer;
