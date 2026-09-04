import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const resolvePath = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

const backend = process.env.BACKEND_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolvePath("./src"),
      "@structsmith/contracts": resolvePath("../../packages/contracts/src/index.ts"),
      "@structsmith/domain": resolvePath("../../packages/domain/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      "/mcp": { target: backend, changeOrigin: true },
      "/health": { target: backend, changeOrigin: true },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
