/// <reference types="vite/client" />

// Google Analytics gtag types
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export {};
