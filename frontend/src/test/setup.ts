// src/test/setup.ts
// Global test setup for Vitest + @testing-library/react

import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock window.matchMedia (not implemented in jsdom)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
globalThis.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  root = null;
  rootMargin = "";
  thresholds = [];
};

// Mock HTMLMediaElement methods (jsdom doesn't support audio playback)
window.HTMLMediaElement.prototype.load = vi.fn();
window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
window.HTMLMediaElement.prototype.pause = vi.fn();
Object.defineProperty(window.HTMLMediaElement.prototype, "readyState", {
  get: vi.fn().mockReturnValue(4),
  configurable: true,
});
