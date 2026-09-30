import { resolve } from "node:path";

const headers = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export default {
  root: "examples/browser",
  base: "./",
  resolve: {
    alias: {
      "@matteogiaquinto/speech-to-text": resolve("src/index.ts"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve("examples/browser/index.html"),
        docs: resolve("examples/browser/docs/index.html"),
      },
    },
  },
  server: { headers },
  preview: { headers },
};
