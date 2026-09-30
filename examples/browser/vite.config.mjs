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
  server: { headers },
  preview: { headers },
};
