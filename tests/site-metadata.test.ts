import { describe, expect, test } from "bun:test";

const projectFile = (path: string): string => new URL(`../${path}`, import.meta.url).pathname;
const readProjectFile = async (path: string): Promise<string> => Bun.file(projectFile(path)).text();

describe("marketing site discovery metadata", () => {
  test("publishes canonical, social and machine-readable metadata", async () => {
    const html = await readProjectFile("apps/site/index.html");

    expect(html).toContain('rel="canonical" href="https://dziksu.github.io/StructSmith/"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain(
      'rel="describedby" href="https://dziksu.github.io/StructSmith/llms.txt"',
    );
    expect(html).toContain('type="text/markdown"');

    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    expect(jsonLd).toBeDefined();

    const graph = JSON.parse(jsonLd ?? "{}") as { "@graph"?: Array<{ "@type"?: string }> };
    const types = graph["@graph"]?.map((entry) => entry["@type"]);
    expect(types).toContain("WebSite");
    expect(types).toContain("SoftwareApplication");
    expect(types).toContain("SoftwareSourceCode");
  });

  test("publishes crawler and LLM discovery files", async () => {
    const [robots, sitemap, llms, markdownOverview] = await Promise.all([
      readProjectFile("public/robots.txt"),
      readProjectFile("public/sitemap.xml"),
      readProjectFile("public/llms.txt"),
      readProjectFile("public/index.md"),
    ]);

    expect(robots).toContain("User-agent: OAI-SearchBot");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("https://dziksu.github.io/StructSmith/sitemap.xml");
    expect(sitemap).toContain("https://dziksu.github.io/StructSmith/");
    expect(llms).toStartWith("# StructSmith\n\n>");
    expect(llms).toContain("AI client installation guide");
    expect(markdownOverview).toContain("self-hosted alternative to paid software architecture");
  });

  test("prerenders the page without a client-side React entrypoint", async () => {
    const [html, viteConfig, packageJson] = await Promise.all([
      readProjectFile("apps/site/index.html"),
      readProjectFile("apps/site/vite.config.ts"),
      readProjectFile("apps/site/package.json"),
    ]);

    expect(html).toContain("<!--STRUCTSMITH_STATIC_HTML-->");
    expect(html).not.toMatch(/<script\b[^>]*\bsrc=/i);
    expect(viteConfig).toContain("renderToStaticMarkup");
    expect(viteConfig).toContain("structsmith-static-prerender");
    expect(packageJson).toContain("verify:static");
    expect(await Bun.file(projectFile("apps/site/src/main.tsx")).exists()).toBeFalse();
  });
});
