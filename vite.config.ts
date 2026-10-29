import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const nodeMods = ["fs","path","os","crypto","stream","util","buffer","process","url","zlib","events","assert","http","https","net","tls","querystring","child_process","worker_threads","vm","string_decoder","timers","console","module","dns","readline","perf_hooks","constants","domain","punycode","http2","dgram"];

export default defineConfig({
  base: "./",
  plugins: [react(), nodePolyfills()],
  resolve: {
    alias: [
      ...nodeMods.map(m => ({ find: new RegExp(`^node:${m}$`), replacement: m })),
      // fs-extra / graceful-fs อ่าน fs.realpath.native ตอนโหลด → ชี้ไป fs polyfill ที่เราอุดไว้
      { find: /^fs-extra$/, replacement: "fs" },
      { find: /^graceful-fs$/, replacement: "fs" },
    ],
  },
  build: { chunkSizeWarningLimit: 4000 },
});