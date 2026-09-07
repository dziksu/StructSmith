import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defineConfig, type Plugin } from "vite";
import { App } from "./src/App.tsx";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const baseUrl = process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : "/";
const stylesheet = readFileSync(new URL("./src/styles.css", import.meta.url), "utf8");

const staticPrerender = (): Plugin => ({
  name: "structsmith-static-prerender",
  enforce: "pre",
  transformIndexHtml(html) {
    const markup = renderToStaticMarkup(createElement(App, { baseUrl }));

    return html
      .replace("<!--STRUCTSMITH_STATIC_HTML-->", markup)
      .replace("<style data-structsmith-static></style>", `<style>${stylesheet}</style>`);
  },
});

export default defineConfig({
  base: baseUrl,
  plugins: [staticPrerender()],
  publicDir: "../../public",
  server: { port: 4174, strictPort: false },
  build: { outDir: "dist", sourcemap: false },
});
