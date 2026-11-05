import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import packageJson from "./package.json";

// Public build-time constants. NOTE (SECURITY): only non-secret values may be
// defined here — Vite compounds these strings into browser-loadable JS.
const exportedVersion: string =
  typeof packageJson === "object" &&
  packageJson !== null &&
  typeof (packageJson as { version?: unknown }).version === "string"
    ? (packageJson as { version: string }).version
    : "0.0.0+unknown";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(exportedVersion),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  // Keep the emitted JS readable for future source maps on the server.
  build: {
    sourcemap: false,
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    css: false,
    restoreMocks: true,
  },
});
