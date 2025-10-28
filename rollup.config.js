import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";

export default {
  input: "src/main.ts", // Entry point for your plugin
  output: {
    dir: ".", // Output to the plugin root so Obsidian can load it directly
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
    copy({
      targets: [
        // Copy the stylesheet to the same folder as main.js
        { src: "src/styles.css", dest: "." },
      ],
    }),
  ],
};
