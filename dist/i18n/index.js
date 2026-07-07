/**
 * i18n — Translation engine for Agent Panel
 *
 * Usage: import { t, getLocale } from "./i18n/index.js";
 *        const label = t("settings.title");
 *
 * Persistence: oc.thread.customData via storage module
 * Fallback: current locale → en → raw key
 */
import { dict, LOCALES, LOCALE_LABELS } from "./dict.js";
import { storageGet, storageSet } from "../storage.js";
const STORAGE_KEY = "agent:locale";
/**
 * Get the stored locale, falling back to browser detection → en
 */
export function getLocale() {
    const stored = storageGet(STORAGE_KEY);
    if (stored && LOCALES.includes(stored)) {
        return stored;
    }
    return detectBrowserLocale();
}
/**
 * Set the active locale and persist it
 */
export function setLocale(locale) {
    storageSet(STORAGE_KEY, locale);
}
/**
 * Detect locale from browser navigator.language
 */
function detectBrowserLocale() {
    const lang = navigator.language || "";
    // Check exact match first (e.g., "pt-BR")
    if (LOCALES.includes(lang))
        return lang;
    // Check prefix (e.g., "pt" → "pt-BR", "zh" → "zh")
    const prefix = lang.split("-")[0];
    if (prefix === "pt")
        return "pt-BR";
    if (LOCALES.includes(prefix))
        return prefix;
    return "en";
}
/**
 * Translate a key to the current (or specified) locale.
 *
 * Fallback chain: locale dict → en dict → raw key
 *
 * @param key - Dot-notation key (e.g., "settings.title")
 * @param locale - Override locale (optional, uses stored locale if omitted)
 * @returns Translated string
 */
export function t(key, locale) {
    const lang = locale ?? getLocale();
    return dict[lang]?.[key] ?? dict.en[key] ?? key;
}
export { LOCALE_LABELS, LOCALES };
