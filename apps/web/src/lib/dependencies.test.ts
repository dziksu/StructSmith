import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslation } from "react-i18next";
import { KIND_ICONS, ROLE_ICONS } from "../features/icons";
import i18n from "../i18n";
import { cn } from "./utils";

test("all architecture icons render as SVG with the requested size and class", () => {
  const icons = new Set([...Object.values(KIND_ICONS), ...Object.values(ROLE_ICONS)]);
  for (const icon of icons) {
    const markup = renderToStaticMarkup(createElement(icon, { size: 18, className: "test-icon" }));
    expect(markup).toContain("<svg");
    expect(markup).toContain('width="18"');
    expect(markup).toContain("test-icon");
  }
});

test("React translations render in English and Polish", async () => {
  const originalLanguage = i18n.language;
  const Label = () => {
    const { t } = useTranslation();
    return createElement("span", null, t("common.save"));
  };
  try {
    await i18n.changeLanguage("en");
    expect(renderToStaticMarkup(createElement(Label))).toBe("<span>Save</span>");
    await i18n.changeLanguage("pl");
    expect(renderToStaticMarkup(createElement(Label))).toBe("<span>Zapisz</span>");
  } finally {
    await i18n.changeLanguage(originalLanguage);
  }
});

test("Tailwind 4 utilities merge without removing independent styles", () => {
  expect(cn("shadow-sm", "shadow-lg")).toBe("shadow-lg");
  expect(cn("size-8", "size-10")).toBe("size-10");
  expect(cn("hover:bg-red-500", "hover:bg-blue-500", "text-white")).toBe(
    "hover:bg-blue-500 text-white",
  );
});
