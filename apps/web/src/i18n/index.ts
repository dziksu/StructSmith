import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import pl from "./locales/pl.json";

/**
 * Adding a language: drop a JSON file next to `en.json`, register it here and
 * add it to `supportedLanguages`. Nothing else in the app hard-codes copy.
 */
export const resources = {
  en: { translation: en },
  pl: { translation: pl },
} as const;

export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polski" },
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]["code"];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: supportedLanguages.map((language) => language.code),
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "structsmith.language",
      caches: ["localStorage"],
    },
  });

export default i18n;
