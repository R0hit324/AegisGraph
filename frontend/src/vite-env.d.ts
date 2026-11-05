/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
  /** Public backend base URL (VITE_API_BASE_URL). Never hold secrets here. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected from package.json version via vite.config.ts define. */
declare const __APP_VERSION__: string;
