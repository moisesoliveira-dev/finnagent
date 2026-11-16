import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Em desenvolvimento no navegador, /api vai para o frontend local (o BFF, porta 3000). No aparelho, o app usa
// VITE_API_URL, lida do .env da raiz na hora do build. Só variável com o prefixo VITE_ entra no código do app.
export default defineConfig({
  plugins: [react()],
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: false } },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "ionic",
              test: /node_modules[\\/](@ionic|@stencil|ionicons)[\\/]/,
              maxSize: 400 * 1024,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              maxSize: 400 * 1024,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: { environment: "node" },
});
