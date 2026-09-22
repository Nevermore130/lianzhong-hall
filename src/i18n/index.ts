import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhCN from "./locales/zh-CN";
import yue from "./locales/yue";
import en from "./locales/en";

export type Locale = "zh-CN" | "yue" | "en";

const STORAGE_KEY = "hall:locale";

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "zh-CN" || stored === "yue" || stored === "en") {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }

  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith("yue") || browserLang === "zh-hk" || browserLang === "zh-tw") {
    return "yue";
  }
  if (browserLang.startsWith("en")) {
    return "en";
  }
  return "zh-CN";
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      "zh-CN": { translation: zhCN },
      yue: { translation: yue },
      en: { translation: en },
    },
    lng: getInitialLocale(),
    fallbackLng: "zh-CN",
    interpolation: {
      escapeValue: false,
    },
  })
  .catch((err) => {
    console.error("i18n initialization failed:", err);
  });

export function saveLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore storage errors
  }
}

export function getCurrentLocale(): Locale {
  const lng = i18n.language;
  if (lng === "zh-CN" || lng === "yue" || lng === "en") {
    return lng;
  }
  return "zh-CN";
}

export default i18n;
