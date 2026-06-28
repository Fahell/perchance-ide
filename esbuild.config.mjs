import { context, build } from "esbuild";
import { readFileSync } from "fs";

const isWatch = process.argv.includes("--watch");

// Read version from package.json
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// Get commit hash from env or git
const commit = process.env.COMMIT || "dev";
const buildTime = new Date().toISOString().slice(0, 19).replace("T", " ");

const config = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/agent.js",
  format: "esm",
  target: "es2022",
  platform: "browser",
  jsxImportSource: "preact",
  minify: !isWatch,
  sourcemap: isWatch,
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  logLevel: "info",
};

if (isWatch) {
  const ctx = await context(config);
  await ctx.watch();
  console.log("👀 Watching for changes...");
} else {
  await build(config);
  console.log("✅ Build complete → dist/agent.js");
}
