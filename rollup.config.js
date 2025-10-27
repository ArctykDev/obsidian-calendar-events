import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "src/main.ts", // Entry point for your plugin
  output: {
    dir: ".",
    sourcemap: true,
    format: "cjs", // Obsidian requires CommonJS output
    exports: "default",
  },
  external: ["obsidian"], // Obsidian API is provided by the app itself
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
  ],
};
