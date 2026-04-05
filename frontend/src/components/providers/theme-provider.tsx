"use client";

import { ThemeProviderContext, type Theme, type Skin } from "@/hooks/useTheme";
import { useEffect, useState, useMemo } from "react";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultSkin?: Skin;
  storageKey?: string;
  skinStorageKey?: string;
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultSkin = "obsidian",
  storageKey = "soundwave-ui-mode",
  skinStorageKey = "soundwave-ui-skin",
  ...props
}: ThemeProviderProps) {
  // 1. Khởi tạo state an toàn cho SSR (Tránh lỗi Hydration)
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [skin, setSkin] = useState<Skin>(defaultSkin);
  const [isMounted, setIsMounted] = useState(false);

  // 2. Load dữ liệu từ localStorage sau khi Component đã mount (Client-side)
  useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey) as Theme;
    const savedSkin = localStorage.getItem(skinStorageKey) as Skin;

    if (savedTheme) setTheme(savedTheme);
    if (savedSkin) setSkin(savedSkin);

    setIsMounted(true);
  }, [storageKey, skinStorageKey]);

  // 3. Effect xử lý DOM — Tối ưu hóa việc cập nhật Class & Attribute
  useEffect(() => {
    if (!isMounted) return;

    const root = window.document.documentElement;

    // --- Xử lý Mode (Light/Dark) ---
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    // --- Xử lý Skin (Appearance) ---
    // Gán trực tiếp vào data-theme để kích hoạt bộ Skin Engine V4 trong index.css
    root.setAttribute("data-theme", skin);

    // Hint: Thêm color-scheme cho trình duyệt để đồng bộ scrollbar và form elements
    root.style.colorScheme = theme === "system" ? "light dark" : theme;
  }, [theme, skin, isMounted]);

  // 4. Memoize value để tránh re-render Provider vô ích
  const value = useMemo(
    () => ({
      theme,
      skin,
      setTheme: (t: Theme) => {
        localStorage.setItem(storageKey, t);
        setTheme(t);
      },
      setSkin: (s: Skin) => {
        localStorage.setItem(skinStorageKey, s);
        setSkin(s);
      },
    }),
    [theme, skin, storageKey, skinStorageKey],
  );

  // 5. Ngăn chặn Flash bằng cách return null hoặc một Fragment trong lúc chờ mount
  // (Nếu bạn dùng Next.js, điều này cực kỳ quan trọng)
  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
