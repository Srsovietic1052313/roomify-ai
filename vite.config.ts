import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, Vite reenvía estas rutas al servidor Express.
    // changeOrigin: false conserva el Host original, que el servidor compara con Origin.
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: false },
      "/imagenes": { target: "http://127.0.0.1:3001", changeOrigin: false },
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
