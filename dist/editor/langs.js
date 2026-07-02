/**
 * Language detection and CM6 language support loader.
 */
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
/**
 * Map of file extensions to factory functions.
 * Factories are used so language modules are only instantiated when needed.
 */
const LANG_MAP = {
    js: () => javascript(),
    mjs: () => javascript(),
    cjs: () => javascript(),
    jsx: () => javascript({ jsx: true }),
    ts: () => javascript({ typescript: true }),
    mts: () => javascript({ typescript: true }),
    cts: () => javascript({ typescript: true }),
    tsx: () => javascript({ jsx: true, typescript: true }),
    json: () => json(),
    html: () => html(),
    htm: () => html(),
    css: () => css(),
    md: () => markdown(),
    markdown: () => markdown(),
};
/**
 * Get the CM6 LanguageSupport extension for a given filename.
 * Returns null if the file extension is not recognized.
 */
export function getLanguageSupport(filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext)
        return null;
    const factory = LANG_MAP[ext];
    return factory ? factory() : null;
}
/**
 * Infer a simple display label from the extension.
 */
export function getLanguageLabel(ext) {
    const labels = {
        js: "JavaScript",
        mjs: "JavaScript",
        cjs: "JavaScript",
        jsx: "JSX",
        ts: "TypeScript",
        mts: "TypeScript",
        cts: "TypeScript",
        tsx: "TSX",
        json: "JSON",
        html: "HTML",
        htm: "HTML",
        css: "CSS",
        md: "Markdown",
        markdown: "Markdown",
    };
    return labels[ext] ?? "Text";
}
