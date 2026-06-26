import { context, build } from "esbuild";

const isWatch = process.argv.includes("--watch");

const config = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/agent.js",
  format: "esm",
  target: "es2022",
  platform: "browser",
  minify: !isWatch,
  sourcemap: isWatch,
  define: {
    "process.env.NODE_ENV": isWatch ? '"development"' : '"production"',
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
