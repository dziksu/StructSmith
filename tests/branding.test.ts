import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("the repository and web app use the same StructSmith logo", async () => {
  const [repositoryLogo, webLogo, readme, html, logoComponent] = await Promise.all([
    readFile("public/logo.png"),
    readFile("apps/web/public/logo.png"),
    readFile("README.md", "utf8"),
    readFile("apps/web/index.html", "utf8"),
    readFile("apps/web/src/components/Logo.tsx", "utf8"),
  ]);

  expect(webLogo.equals(repositoryLogo)).toBe(true);
  expect(readme).toContain('src="public/logo.png"');
  expect(html).toContain('type="image/png" href="/logo.png"');
  expect(logoComponent).toContain('src="/logo.png"');
});
