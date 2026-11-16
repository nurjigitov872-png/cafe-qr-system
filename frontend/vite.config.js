import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { resolveConnections } from "./src/config/connectionPolicy.mjs";
const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, root, "VITE_"), ...process.env };
  resolveConnections(env, { development: command === "serve" && !process.argv.includes("preview") });
  return { plugins: [react()] };
});
