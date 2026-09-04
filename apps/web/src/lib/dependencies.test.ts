import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { cn } from "./utils";

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
