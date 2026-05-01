// ─────────────────────────────────────────────────────────────────────────────
// useOnlineStatus — reactive online/offline detection
// FIX P4: navigator.onLine alone is SSR-unsafe and not reactive.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

export function useOnlineStatus(): boolean {
    const [online, setOnline] = useState(() =>
        typeof navigator !== "undefined" ? navigator.onLine : true,
    );
    useEffect(() => {
        const goOnline = () => setOnline(true);
        const goOffline = () => setOnline(false);
        window.addEventListener("online", goOnline);
        window.addEventListener("offline", goOffline);
        return () => {
            window.removeEventListener("online", goOnline);
            window.removeEventListener("offline", goOffline);
        };
    }, []);
    return online;
}