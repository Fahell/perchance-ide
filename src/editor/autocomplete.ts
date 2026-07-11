/**
 * Code snippets and contextual autocomplete for CodeMirror 6.
 *
 * Provides:
 * - Expandable snippets with Tab-stop navigation (for, if, function, etc.)
 * - Language-aware keyword completion (JS/TS, CSS, HTML)
 * - Snippet keymap for Tab/Shift-Tab placeholder navigation
 *
 * Snippets are registered via each language's `.data()` facet so they
 * integrate seamlessly with the autocompletion already provided by
 * basicSetup (word-based completions, language completions).
 */

import { snippetCompletion, snippetKeymap } from "@codemirror/autocomplete";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { javascriptLanguage, typescriptLanguage, jsxLanguage, tsxLanguage } from "@codemirror/lang-javascript";
import { cssLanguage } from "@codemirror/lang-css";
import { htmlLanguage } from "@codemirror/lang-html";
import { pythonLanguage } from "@codemirror/lang-python";

// ─── Re-export snippetKeymap for use in editor factory ──────
export { snippetKeymap };

// ═══════════════════════════════════════════════════════════════
// JS/TS SNIPPETS
// ═══════════════════════════════════════════════════════════════

const jsSnippets: Completion[] = [
  snippetCompletion(
    "for (let ${1:i} = 0; ${1} < ${2:length}; ${1}++) {\n  ${3}\n}",
    { label: "for", detail: "for loop", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "for (const ${1:item} of ${2:array}) {\n  ${3}\n}",
    { label: "forof", detail: "for...of loop", type: "keyword", boost: 90 }
  ),
  snippetCompletion(
    "for (const ${1:key} in ${2:obj}) {\n  ${3}\n}",
    { label: "forin", detail: "for...in loop", type: "keyword", boost: 90 }
  ),
  snippetCompletion(
    "if (${1:condition}) {\n  ${2}\n}",
    { label: "if", detail: "if statement", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "if (${1:condition}) {\n  ${2}\n} else {\n  ${3}\n}",
    { label: "ifelse", detail: "if...else", type: "keyword", boost: 85 }
  ),
  snippetCompletion(
    "function ${1:name}(${2:args}) {\n  ${3}\n}",
    { label: "fun", detail: "function declaration", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "(${1:args}) => {\n  ${2}\n}",
    { label: "arr", detail: "arrow function", type: "keyword", boost: 85 }
  ),
  snippetCompletion(
    "console.log(${1})",
    { label: "log", detail: "console.log", type: "function", boost: 95 }
  ),
  snippetCompletion(
    "try {\n  ${1}\n} catch (${2:err}) {\n  ${3}\n}",
    { label: "try", detail: "try/catch", type: "keyword", boost: 90 }
  ),
  snippetCompletion(
    "import { ${1} } from \"${2}\";",
    { label: "import", detail: "import statement", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "class ${1:Name} {\n  constructor(${2:args}) {\n    ${3}\n  }\n}",
    { label: "class", detail: "class declaration", type: "keyword", boost: 90 }
  ),
  snippetCompletion(
    "switch (${1:expr}) {\n  case ${2:value}:\n    ${3}\n    break;\n  default:\n    ${4}\n}",
    { label: "switch", detail: "switch statement", type: "keyword", boost: 85 }
  ),
  snippetCompletion(
    "${1:const} ${2:name} = await ${3:promise};",
    { label: "await", detail: "await expression", type: "keyword", boost: 80 }
  ),
];

// ═══════════════════════════════════════════════════════════════
// REACT SNIPPETS
// ═══════════════════════════════════════════════════════════════

const reactSnippets: Completion[] = [
  snippetCompletion(
    "const [${1:state}, set${1:State}] = useState(${2:initial});",
    { label: "usestate", detail: "useState hook", type: "function", boost: 100 }
  ),
  snippetCompletion(
    "useEffect(() => {\n  ${1}\n}, [${2}]);",
    { label: "useeffect", detail: "useEffect hook", type: "function", boost: 100 }
  ),
  snippetCompletion(
    "const ${1:value} = useContext(${2:Context});",
    { label: "usecontext", detail: "useContext hook", type: "function", boost: 95 }
  ),
  snippetCompletion(
    "const ${1:ref} = useRef(${2:null});",
    { label: "useref", detail: "useRef hook", type: "function", boost: 95 }
  ),
  snippetCompletion(
    "const ${1:Comp} = React.memo(({ ${2} }) => {\n  return ${3};\n});",
    { label: "memo", detail: "React.memo", type: "function", boost: 85 }
  ),
  snippetCompletion(
    "const ${1:comp} = useMemo(() => ${2}, [${3}]);",
    { label: "usememo", detail: "useMemo hook", type: "function", boost: 90 }
  ),
  snippetCompletion(
    "const ${1:fn} = useCallback(() => {\n  ${2}\n}, [${3}]);",
    { label: "usecallback", detail: "useCallback hook", type: "function", boost: 90 }
  ),
];

// ═══════════════════════════════════════════════════════════════
// CSS SNIPPETS
// ═══════════════════════════════════════════════════════════════

const cssSnippets: Completion[] = [
  snippetCompletion(
    "display: flex;\njustify-content: ${1:center};\nalign-items: ${2:center};",
    { label: "flex", detail: "display: flex", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "display: grid;\ngrid-template-columns: ${1:1fr};",
    { label: "grid", detail: "display: grid", type: "keyword", boost: 90 }
  ),
  snippetCompletion(
    "@media (${1:max-width}: ${2:768px}) {\n  ${3}\n}",
    { label: "media", detail: "@media query", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "@keyframes ${1:name} {\n  0% { ${2} }\n  100% { ${3} }\n}",
    { label: "anim", detail: "@keyframes", type: "keyword", boost: 85 }
  ),
];

// ═══════════════════════════════════════════════════════════════
// HTML SNIPPETS
// ═══════════════════════════════════════════════════════════════

const htmlSnippets: Completion[] = [
  snippetCompletion(
    "<!DOCTYPE html>\n<html lang=\"${1:en}\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>${2:Document}</title>\n</head>\n<body>\n  ${3}\n</body>\n</html>",
    { label: "!", detail: "HTML5 boilerplate", type: "keyword", boost: 100 }
  ),
  snippetCompletion("<div>${1}</div>", {
    label: "div", detail: "<div>", type: "keyword", boost: 95,
  }),
  snippetCompletion("<a href=\"${1}\">${2}</a>", {
    label: "a", detail: "<a>", type: "keyword", boost: 90,
  }),
  snippetCompletion("<img src=\"${1}\" alt=\"${2}\" />", {
    label: "img", detail: "<img>", type: "keyword", boost: 90,
  }),
  snippetCompletion("<input type=\"${1:text}\" ${2} />", {
    label: "input", detail: "<input>", type: "keyword", boost: 85,
  }),
  snippetCompletion("<button ${1:onClick=\"${2}\"}>${3}</button>", {
    label: "button", detail: "<button>", type: "keyword", boost: 85,
  }),
  snippetCompletion("<section>\n  ${1}\n</section>", {
    label: "section", detail: "<section>", type: "keyword", boost: 80,
  }),
  snippetCompletion("<ul>\n  ${1}\n</ul>", {
    label: "ul", detail: "<ul>", type: "keyword", boost: 80,
  }),
  snippetCompletion("<ol>\n  ${1}\n</ol>", {
    label: "ol", detail: "<ol>", type: "keyword", boost: 80,
  }),
  snippetCompletion("<li>${1}</li>", {
    label: "li", detail: "<li>", type: "keyword", boost: 80,
  }),
];

// ═══════════════════════════════════════════════════════════════
// JS/TS KEYWORDS & GLOBALS
// ═══════════════════════════════════════════════════════════════

const jsKeywords: Completion[] = [
  { label: "const", type: "keyword", boost: 100, detail: "keyword" },
  { label: "let", type: "keyword", boost: 100, detail: "keyword" },
  { label: "var", type: "keyword", boost: 80, detail: "keyword" },
  { label: "function", type: "keyword", boost: 100, detail: "keyword" },
  { label: "return", type: "keyword", boost: 100, detail: "keyword" },
  { label: "if", type: "keyword", boost: 100, detail: "keyword" },
  { label: "else", type: "keyword", boost: 100, detail: "keyword" },
  { label: "for", type: "keyword", boost: 100, detail: "keyword" },
  { label: "while", type: "keyword", boost: 95, detail: "keyword" },
  { label: "do", type: "keyword", boost: 90, detail: "keyword" },
  { label: "switch", type: "keyword", boost: 90, detail: "keyword" },
  { label: "case", type: "keyword", boost: 90, detail: "keyword" },
  { label: "break", type: "keyword", boost: 95, detail: "keyword" },
  { label: "continue", type: "keyword", boost: 95, detail: "keyword" },
  { label: "new", type: "keyword", boost: 95, detail: "keyword" },
  { label: "this", type: "keyword", boost: 100, detail: "keyword" },
  { label: "super", type: "keyword", boost: 90, detail: "keyword" },
  { label: "typeof", type: "keyword", boost: 85, detail: "keyword" },
  { label: "instanceof", type: "keyword", boost: 85, detail: "keyword" },
  { label: "delete", type: "keyword", boost: 80, detail: "keyword" },
  { label: "void", type: "keyword", boost: 70, detail: "keyword" },
  { label: "throw", type: "keyword", boost: 80, detail: "keyword" },
  { label: "try", type: "keyword", boost: 95, detail: "keyword" },
  { label: "catch", type: "keyword", boost: 95, detail: "keyword" },
  { label: "finally", type: "keyword", boost: 80, detail: "keyword" },
  { label: "async", type: "keyword", boost: 95, detail: "keyword" },
  { label: "await", type: "keyword", boost: 95, detail: "keyword" },
  { label: "yield", type: "keyword", boost: 70, detail: "keyword" },
  { label: "import", type: "keyword", boost: 100, detail: "keyword" },
  { label: "export", type: "keyword", boost: 100, detail: "keyword" },
  { label: "default", type: "keyword", boost: 95, detail: "keyword" },
  { label: "from", type: "keyword", boost: 95, detail: "keyword" },
  { label: "of", type: "keyword", boost: 95, detail: "keyword" },
  { label: "class", type: "keyword", boost: 100, detail: "keyword" },
  { label: "extends", type: "keyword", boost: 90, detail: "keyword" },
  { label: "implements", type: "keyword", boost: 85, detail: "keyword" },
  { label: "interface", type: "keyword", boost: 95, detail: "keyword" },
  { label: "type", type: "keyword", boost: 95, detail: "keyword" },
  { label: "enum", type: "keyword", boost: 85, detail: "keyword" },
  { label: "namespace", type: "keyword", boost: 80, detail: "keyword" },
  { label: "static", type: "keyword", boost: 90, detail: "keyword" },
  { label: "private", type: "keyword", boost: 90, detail: "keyword" },
  { label: "public", type: "keyword", boost: 90, detail: "keyword" },
  { label: "protected", type: "keyword", boost: 90, detail: "keyword" },
  { label: "readonly", type: "keyword", boost: 85, detail: "keyword" },
  { label: "abstract", type: "keyword", boost: 85, detail: "keyword" },
];

const tsKeywords: Completion[] = [
  { label: "interface", type: "keyword", boost: 100, detail: "keyword" },
  { label: "type", type: "keyword", boost: 100, detail: "keyword" },
  { label: "enum", type: "keyword", boost: 95, detail: "keyword" },
  { label: "as", type: "keyword", boost: 90, detail: "keyword" },
  { label: "is", type: "keyword", boost: 85, detail: "keyword" },
  { label: "keyof", type: "keyword", boost: 80, detail: "keyword" },
  { label: "typeof", type: "keyword", boost: 85, detail: "keyword" },
  { label: "infer", type: "keyword", boost: 75, detail: "keyword" },
  { label: "any", type: "keyword", boost: 95, detail: "keyword" },
  { label: "never", type: "keyword", boost: 90, detail: "keyword" },
  { label: "unknown", type: "keyword", boost: 95, detail: "keyword" },
  { label: "void", type: "keyword", boost: 90, detail: "keyword" },
  { label: "null", type: "keyword", boost: 95, detail: "keyword" },
  { label: "undefined", type: "keyword", boost: 95, detail: "keyword" },
  { label: "string", type: "keyword", boost: 95, detail: "keyword" },
  { label: "number", type: "keyword", boost: 95, detail: "keyword" },
  { label: "boolean", type: "keyword", boost: 95, detail: "keyword" },
  { label: "symbol", type: "keyword", boost: 85, detail: "keyword" },
  { label: "bigint", type: "keyword", boost: 80, detail: "keyword" },
  { label: "true", type: "keyword", boost: 95, detail: "keyword" },
  { label: "false", type: "keyword", boost: 95, detail: "keyword" },
  { label: "readonly", type: "keyword", boost: 85, detail: "keyword" },
  { label: "abstract", type: "keyword", boost: 80, detail: "keyword" },
  { label: "declare", type: "keyword", boost: 80, detail: "keyword" },
  { label: "module", type: "keyword", boost: 75, detail: "keyword" },
  { label: "namespace", type: "keyword", boost: 75, detail: "keyword" },
];

const jsGlobals: Completion[] = [
  { label: "console", type: "class", boost: 95, detail: "Web API" },
  { label: "document", type: "class", boost: 95, detail: "DOM API" },
  { label: "window", type: "class", boost: 95, detail: "DOM API" },
  { label: "fetch", type: "function", boost: 95, detail: "Web API" },
  { label: "localStorage", type: "class", boost: 80, detail: "Web API" },
  { label: "sessionStorage", type: "class", boost: 75, detail: "Web API" },
  { label: "setTimeout", type: "function", boost: 95, detail: "Web API" },
  { label: "setInterval", type: "function", boost: 85, detail: "Web API" },
  { label: "clearTimeout", type: "function", boost: 80, detail: "Web API" },
  { label: "clearInterval", type: "function", boost: 75, detail: "Web API" },
  { label: "JSON", type: "class", boost: 95, detail: "built-in" },
  { label: "Math", type: "class", boost: 95, detail: "built-in" },
  { label: "Array", type: "class", boost: 95, detail: "built-in" },
  { label: "Object", type: "class", boost: 95, detail: "built-in" },
  { label: "String", type: "class", boost: 90, detail: "built-in" },
  { label: "Number", type: "class", boost: 90, detail: "built-in" },
  { label: "Boolean", type: "class", boost: 85, detail: "built-in" },
  { label: "Promise", type: "class", boost: 95, detail: "built-in" },
  { label: "Map", type: "class", boost: 90, detail: "ES6" },
  { label: "Set", type: "class", boost: 90, detail: "ES6" },
  { label: "WeakMap", type: "class", boost: 75, detail: "ES6" },
  { label: "WeakSet", type: "class", boost: 70, detail: "ES6" },
  { label: "Symbol", type: "class", boost: 85, detail: "built-in" },
  { label: "RegExp", type: "class", boost: 85, detail: "built-in" },
  { label: "Error", type: "class", boost: 90, detail: "built-in" },
  { label: "Date", type: "class", boost: 90, detail: "built-in" },
  { label: "parseInt", type: "function", boost: 90, detail: "global" },
  { label: "parseFloat", type: "function", boost: 85, detail: "global" },
  { label: "isNaN", type: "function", boost: 85, detail: "global" },
  { label: "isFinite", type: "function", boost: 75, detail: "global" },
  { label: "NaN", type: "keyword", boost: 90, detail: "global" },
  { label: "Infinity", type: "keyword", boost: 80, detail: "global" },
];

// ═══════════════════════════════════════════════════════════════
// CSS COMPLETIONS
// ═══════════════════════════════════════════════════════════════

const cssProps: Completion[] = [
  { label: "display", type: "property", boost: 100, detail: "CSS" },
  { label: "position", type: "property", boost: 95, detail: "CSS" },
  { label: "margin", type: "property", boost: 100, detail: "CSS" },
  { label: "padding", type: "property", boost: 100, detail: "CSS" },
  { label: "color", type: "property", boost: 100, detail: "CSS" },
  { label: "background", type: "property", boost: 100, detail: "CSS" },
  { label: "background-color", type: "property", boost: 90, detail: "CSS" },
  { label: "font-size", type: "property", boost: 100, detail: "CSS" },
  { label: "font-weight", type: "property", boost: 95, detail: "CSS" },
  { label: "font-family", type: "property", boost: 90, detail: "CSS" },
  { label: "width", type: "property", boost: 100, detail: "CSS" },
  { label: "height", type: "property", boost: 100, detail: "CSS" },
  { label: "min-width", type: "property", boost: 85, detail: "CSS" },
  { label: "max-width", type: "property", boost: 90, detail: "CSS" },
  { label: "min-height", type: "property", boost: 85, detail: "CSS" },
  { label: "max-height", type: "property", boost: 85, detail: "CSS" },
  { label: "border", type: "property", boost: 100, detail: "CSS" },
  { label: "border-radius", type: "property", boost: 95, detail: "CSS" },
  { label: "outline", type: "property", boost: 80, detail: "CSS" },
  { label: "box-shadow", type: "property", boost: 95, detail: "CSS" },
  { label: "text-shadow", type: "property", boost: 80, detail: "CSS" },
  { label: "opacity", type: "property", boost: 95, detail: "CSS" },
  { label: "overflow", type: "property", boost: 90, detail: "CSS" },
  { label: "cursor", type: "property", boost: 85, detail: "CSS" },
  { label: "z-index", type: "property", boost: 90, detail: "CSS" },
  { label: "transform", type: "property", boost: 90, detail: "CSS" },
  { label: "transition", type: "property", boost: 90, detail: "CSS" },
  { label: "animation", type: "property", boost: 85, detail: "CSS" },
  { label: "flex", type: "property", boost: 100, detail: "CSS" },
  { label: "flex-direction", type: "property", boost: 95, detail: "CSS" },
  { label: "flex-wrap", type: "property", boost: 85, detail: "CSS" },
  { label: "justify-content", type: "property", boost: 100, detail: "CSS" },
  { label: "align-items", type: "property", boost: 100, detail: "CSS" },
  { label: "align-content", type: "property", boost: 80, detail: "CSS" },
  { label: "gap", type: "property", boost: 95, detail: "CSS" },
  { label: "grid", type: "property", boost: 95, detail: "CSS" },
  { label: "grid-template", type: "property", boost: 90, detail: "CSS" },
  { label: "grid-column", type: "property", boost: 80, detail: "CSS" },
  { label: "grid-row", type: "property", boost: 80, detail: "CSS" },
  { label: "list-style", type: "property", boost: 75, detail: "CSS" },
  { label: "text-align", type: "property", boost: 95, detail: "CSS" },
  { label: "text-decoration", type: "property", boost: 85, detail: "CSS" },
  { label: "text-transform", type: "property", boost: 80, detail: "CSS" },
  { label: "white-space", type: "property", boost: 75, detail: "CSS" },
  { label: "word-break", type: "property", boost: 75, detail: "CSS" },
  { label: "line-height", type: "property", boost: 90, detail: "CSS" },
  { label: "letter-spacing", type: "property", boost: 80, detail: "CSS" },
  { label: "vertical-align", type: "property", boost: 80, detail: "CSS" },
  { label: "visibility", type: "property", boost: 85, detail: "CSS" },
  { label: "float", type: "property", boost: 80, detail: "CSS" },
  { label: "clear", type: "property", boost: 75, detail: "CSS" },
  { label: "content", type: "property", boost: 80, detail: "CSS" },
];

const cssValues: Completion[] = [
  { label: "flex", type: "keyword", boost: 100, detail: "display" },
  { label: "block", type: "keyword", boost: 100, detail: "display" },
  { label: "inline", type: "keyword", boost: 95, detail: "display" },
  { label: "inline-block", type: "keyword", boost: 95, detail: "display" },
  { label: "none", type: "keyword", boost: 100, detail: "value" },
  { label: "relative", type: "keyword", boost: 95, detail: "position" },
  { label: "absolute", type: "keyword", boost: 95, detail: "position" },
  { label: "fixed", type: "keyword", boost: 90, detail: "position" },
  { label: "sticky", type: "keyword", boost: 85, detail: "position" },
  { label: "hidden", type: "keyword", boost: 90, detail: "overflow" },
  { label: "auto", type: "keyword", boost: 95, detail: "value" },
  { label: "scroll", type: "keyword", boost: 80, detail: "overflow" },
  { label: "center", type: "keyword", boost: 100, detail: "value" },
  { label: "space-between", type: "keyword", boost: 90, detail: "justify-content" },
  { label: "space-around", type: "keyword", boost: 85, detail: "justify-content" },
  { label: "space-evenly", type: "keyword", boost: 80, detail: "justify-content" },
  { label: "stretch", type: "keyword", boost: 85, detail: "align-items" },
  { label: "wrap", type: "keyword", boost: 85, detail: "flex-wrap" },
  { label: "nowrap", type: "keyword", boost: 85, detail: "flex-wrap" },
  { label: "column", type: "keyword", boost: 85, detail: "flex-direction" },
  { label: "row", type: "keyword", boost: 85, detail: "flex-direction" },
  { label: "1fr", type: "keyword", boost: 85, detail: "grid" },
  { label: "repeat", type: "function", boost: 80, detail: "grid" },
  { label: "bold", type: "keyword", boost: 90, detail: "font-weight" },
  { label: "italic", type: "keyword", boost: 85, detail: "font-style" },
  { label: "underline", type: "keyword", boost: 85, detail: "text-decoration" },
  { label: "transparent", type: "keyword", boost: 85, detail: "color" },
  { label: "inherit", type: "keyword", boost: 80, detail: "value" },
  { label: "initial", type: "keyword", boost: 80, detail: "value" },
  { label: "unset", type: "keyword", boost: 75, detail: "value" },
];

// ═══════════════════════════════════════════════════════════════
// PYTHON SNIPPETS & KEYWORDS
// ═══════════════════════════════════════════════════════════════

const pySnippets: Completion[] = [
  snippetCompletion(
    "def ${1:name}(${2:args}):\n    ${3:pass}",
    { label: "def", detail: "function definition", type: "keyword", boost: 100 }
  ),
  snippetCompletion(
    "class ${1:Name}:\n    def __init__(self${2:, args}):\n        ${3:pass}",
    { label: "class", detail: "class definition", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "if ${1:condition}:\n    ${2:pass}",
    { label: "if", detail: "if statement", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "if ${1:condition}:\n    ${2:pass}\nelse:\n    ${3:pass}",
    { label: "ifelse", detail: "if...else", type: "keyword", boost: 85 }
  ),
  snippetCompletion(
    "for ${1:item} in ${2:iterable}:\n    ${3:pass}",
    { label: "for", detail: "for loop", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "while ${1:condition}:\n    ${2:pass}",
    { label: "while", detail: "while loop", type: "keyword", boost: 90 }
  ),
  snippetCompletion(
    "try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}",
    { label: "try", detail: "try/except", type: "keyword", boost: 90 }
  ),
  snippetCompletion(
    "with ${1:expr} as ${2:var}:\n    ${3:pass}",
    { label: "with", detail: "with statement", type: "keyword", boost: 85 }
  ),
  snippetCompletion(
    "def __init__(self${2:, args}):\n    ${3:pass}",
    { label: "init", detail: "constructor", type: "function", boost: 95 }
  ),
  snippetCompletion(
    "if __name__ == \"__main__\":\n    ${1:main()}",
    { label: "main", detail: "if __name__ guard", type: "keyword", boost: 90 }
  ),
  snippetCompletion(
    "print(${1})",
    { label: "print", detail: "print()", type: "function", boost: 100 }
  ),
  snippetCompletion(
    "import ${1:module}",
    { label: "import", detail: "import statement", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "from ${1:module} import ${2:name}",
    { label: "from", detail: "from...import", type: "keyword", boost: 95 }
  ),
  snippetCompletion(
    "lambda ${1:args}: ${2:expr}",
    { label: "lambda", detail: "lambda expression", type: "keyword", boost: 85 }
  ),
  snippetCompletion(
    "async def ${1:name}(${2:args}):\n    ${3:pass}",
    { label: "async", detail: "async function", type: "keyword", boost: 80 }
  ),
  snippetCompletion(
    "@${1:decorator}\ndef ${2:name}(${3:args}):\n    ${4:pass}",
    { label: "decorator", detail: "decorator", type: "keyword", boost: 80 }
  ),
];

const pyKeywords: Completion[] = [
  { label: "None", type: "keyword", boost: 100, detail: "Python" },
  { label: "True", type: "keyword", boost: 100, detail: "Python" },
  { label: "False", type: "keyword", boost: 100, detail: "Python" },
  { label: "self", type: "keyword", boost: 100, detail: "Python" },
  { label: "cls", type: "keyword", boost: 90, detail: "Python" },
  { label: "return", type: "keyword", boost: 100, detail: "Python" },
  { label: "yield", type: "keyword", boost: 85, detail: "Python" },
  { label: "def", type: "keyword", boost: 100, detail: "Python" },
  { label: "class", type: "keyword", boost: 100, detail: "Python" },
  { label: "if", type: "keyword", boost: 100, detail: "Python" },
  { label: "elif", type: "keyword", boost: 95, detail: "Python" },
  { label: "else", type: "keyword", boost: 95, detail: "Python" },
  { label: "for", type: "keyword", boost: 100, detail: "Python" },
  { label: "while", type: "keyword", boost: 95, detail: "Python" },
  { label: "break", type: "keyword", boost: 95, detail: "Python" },
  { label: "continue", type: "keyword", boost: 95, detail: "Python" },
  { label: "pass", type: "keyword", boost: 100, detail: "Python" },
  { label: "import", type: "keyword", boost: 100, detail: "Python" },
  { label: "from", type: "keyword", boost: 100, detail: "Python" },
  { label: "as", type: "keyword", boost: 95, detail: "Python" },
  { label: "try", type: "keyword", boost: 100, detail: "Python" },
  { label: "except", type: "keyword", boost: 100, detail: "Python" },
  { label: "finally", type: "keyword", boost: 85, detail: "Python" },
  { label: "raise", type: "keyword", boost: 90, detail: "Python" },
  { label: "with", type: "keyword", boost: 95, detail: "Python" },
  { label: "lambda", type: "keyword", boost: 90, detail: "Python" },
  { label: "global", type: "keyword", boost: 80, detail: "Python" },
  { label: "nonlocal", type: "keyword", boost: 75, detail: "Python" },
  { label: "del", type: "keyword", boost: 80, detail: "Python" },
  { label: "assert", type: "keyword", boost: 80, detail: "Python" },
  { label: "in", type: "keyword", boost: 95, detail: "Python" },
  { label: "is", type: "keyword", boost: 90, detail: "Python" },
  { label: "not", type: "keyword", boost: 95, detail: "Python" },
  { label: "and", type: "keyword", boost: 95, detail: "Python" },
  { label: "or", type: "keyword", boost: 95, detail: "Python" },
  { label: "async", type: "keyword", boost: 90, detail: "Python" },
  { label: "await", type: "keyword", boost: 85, detail: "Python" },
  { label: "match", type: "keyword", boost: 80, detail: "Python 3.10" },
  { label: "case", type: "keyword", boost: 80, detail: "Python 3.10" },
  { label: "print", type: "function", boost: 100, detail: "built-in" },
  { label: "len", type: "function", boost: 95, detail: "built-in" },
  { label: "range", type: "function", boost: 95, detail: "built-in" },
  { label: "int", type: "function", boost: 90, detail: "built-in" },
  { label: "float", type: "function", boost: 85, detail: "built-in" },
  { label: "str", type: "function", boost: 90, detail: "built-in" },
  { label: "list", type: "function", boost: 90, detail: "built-in" },
  { label: "dict", type: "function", boost: 90, detail: "built-in" },
  { label: "set", type: "function", boost: 85, detail: "built-in" },
  { label: "tuple", type: "function", boost: 85, detail: "built-in" },
  { label: "bool", type: "function", boost: 85, detail: "built-in" },
  { label: "type", type: "function", boost: 85, detail: "built-in" },
  { label: "isinstance", type: "function", boost: 80, detail: "built-in" },
  { label: "enumerate", type: "function", boost: 85, detail: "built-in" },
  { label: "zip", type: "function", boost: 85, detail: "built-in" },
  { label: "map", type: "function", boost: 80, detail: "built-in" },
  { label: "filter", type: "function", boost: 80, detail: "built-in" },
  { label: "sorted", type: "function", boost: 85, detail: "built-in" },
  { label: "open", type: "function", boost: 90, detail: "built-in" },
  { label: "super", type: "function", boost: 85, detail: "built-in" },
  { label: "property", type: "function", boost: 80, detail: "built-in" },
  { label: "staticmethod", type: "function", boost: 80, detail: "built-in" },
  { label: "classmethod", type: "function", boost: 80, detail: "built-in" },
  { label: "__init__", type: "function", boost: 90, detail: "Python" },
  { label: "__str__", type: "function", boost: 85, detail: "Python" },
  { label: "__repr__", type: "function", boost: 80, detail: "Python" },
  { label: "__call__", type: "function", boost: 75, detail: "Python" },
];

// ═══════════════════════════════════════════════════════════════
// HTML COMPLETIONS
// ═══════════════════════════════════════════════════════════════

const htmlTags: Completion[] = [
  { label: "div", type: "keyword", boost: 100, detail: "HTML" },
  { label: "span", type: "keyword", boost: 95, detail: "HTML" },
  { label: "p", type: "keyword", boost: 95, detail: "HTML" },
  { label: "a", type: "keyword", boost: 95, detail: "HTML" },
  { label: "img", type: "keyword", boost: 95, detail: "HTML" },
  { label: "input", type: "keyword", boost: 95, detail: "HTML" },
  { label: "button", type: "keyword", boost: 95, detail: "HTML" },
  { label: "form", type: "keyword", boost: 90, detail: "HTML" },
  { label: "section", type: "keyword", boost: 90, detail: "HTML" },
  { label: "article", type: "keyword", boost: 85, detail: "HTML" },
  { label: "header", type: "keyword", boost: 90, detail: "HTML" },
  { label: "footer", type: "keyword", boost: 90, detail: "HTML" },
  { label: "nav", type: "keyword", boost: 85, detail: "HTML" },
  { label: "main", type: "keyword", boost: 85, detail: "HTML" },
  { label: "aside", type: "keyword", boost: 80, detail: "HTML" },
  { label: "ul", type: "keyword", boost: 90, detail: "HTML" },
  { label: "ol", type: "keyword", boost: 85, detail: "HTML" },
  { label: "li", type: "keyword", boost: 95, detail: "HTML" },
  { label: "table", type: "keyword", boost: 85, detail: "HTML" },
  { label: "tr", type: "keyword", boost: 80, detail: "HTML" },
  { label: "td", type: "keyword", boost: 80, detail: "HTML" },
  { label: "th", type: "keyword", boost: 80, detail: "HTML" },
  { label: "h1", type: "keyword", boost: 90, detail: "HTML" },
  { label: "h2", type: "keyword", boost: 90, detail: "HTML" },
  { label: "h3", type: "keyword", boost: 90, detail: "HTML" },
  { label: "h4", type: "keyword", boost: 85, detail: "HTML" },
  { label: "h5", type: "keyword", boost: 85, detail: "HTML" },
  { label: "h6", type: "keyword", boost: 85, detail: "HTML" },
  { label: "label", type: "keyword", boost: 85, detail: "HTML" },
  { label: "select", type: "keyword", boost: 85, detail: "HTML" },
  { label: "textarea", type: "keyword", boost: 85, detail: "HTML" },
  { label: "option", type: "keyword", boost: 80, detail: "HTML" },
  { label: "meta", type: "keyword", boost: 85, detail: "HTML" },
  { label: "link", type: "keyword", boost: 85, detail: "HTML" },
  { label: "script", type: "keyword", boost: 95, detail: "HTML" },
  { label: "style", type: "keyword", boost: 90, detail: "HTML" },
  { label: "svg", type: "keyword", boost: 80, detail: "HTML" },
  { label: "canvas", type: "keyword", boost: 75, detail: "HTML" },
  { label: "code", type: "keyword", boost: 80, detail: "HTML" },
  { label: "pre", type: "keyword", boost: 80, detail: "HTML" },
  { label: "br", type: "keyword", boost: 85, detail: "HTML" },
  { label: "hr", type: "keyword", boost: 80, detail: "HTML" },
  { label: "strong", type: "keyword", boost: 80, detail: "HTML" },
  { label: "em", type: "keyword", boost: 80, detail: "HTML" },
];

const htmlAttrs: Completion[] = [
  { label: "class", type: "attribute", boost: 100, detail: "HTML attr" },
  { label: "id", type: "attribute", boost: 100, detail: "HTML attr" },
  { label: "style", type: "attribute", boost: 90, detail: "HTML attr" },
  { label: "href", type: "attribute", boost: 95, detail: "HTML attr" },
  { label: "src", type: "attribute", boost: 95, detail: "HTML attr" },
  { label: "alt", type: "attribute", boost: 90, detail: "HTML attr" },
  { label: "title", type: "attribute", boost: 85, detail: "HTML attr" },
  { label: "type", type: "attribute", boost: 90, detail: "HTML attr" },
  { label: "name", type: "attribute", boost: 90, detail: "HTML attr" },
  { label: "value", type: "attribute", boost: 90, detail: "HTML attr" },
  { label: "placeholder", type: "attribute", boost: 85, detail: "HTML attr" },
  { label: "disabled", type: "attribute", boost: 80, detail: "HTML attr" },
  { label: "readonly", type: "attribute", boost: 80, detail: "HTML attr" },
  { label: "required", type: "attribute", boost: 80, detail: "HTML attr" },
  { label: "checked", type: "attribute", boost: 80, detail: "HTML attr" },
  { label: "selected", type: "attribute", boost: 80, detail: "HTML attr" },
  { label: "autofocus", type: "attribute", boost: 75, detail: "HTML attr" },
  { label: "target", type: "attribute", boost: 85, detail: "HTML attr" },
  { label: "rel", type: "attribute", boost: 80, detail: "HTML attr" },
  { label: "data", type: "attribute", boost: 85, detail: "HTML attr" },
  { label: "onclick", type: "attribute", boost: 85, detail: "HTML attr" },
  { label: "onchange", type: "attribute", boost: 80, detail: "HTML attr" },
  { label: "onsubmit", type: "attribute", boost: 75, detail: "HTML attr" },
  { label: "onload", type: "attribute", boost: 75, detail: "HTML attr" },
  { label: "lang", type: "attribute", boost: 80, detail: "HTML attr" },
  { label: "dir", type: "attribute", boost: 75, detail: "HTML attr" },
  { label: "hidden", type: "attribute", boost: 80, detail: "HTML attr" },
  { label: "role", type: "attribute", boost: 80, detail: "HTML attr" },
];

// ═══════════════════════════════════════════════════════════════
// COMPLETION SOURCES
// ═══════════════════════════════════════════════════════════════

/**
 * Match the word before cursor. Returns null if no word or if we're
 * in the middle of typing and it's not explicit (user pressed Ctrl+Space).
 */
function matchWord(context: CompletionContext): { from: number; to: number } | null {
  const word = context.matchBefore(/[\w$]*/);
  // Show completions when there's at least 1 character typed or explicit trigger
  if (!word || (word.from === word.to && !context.explicit)) return null;
  // Don't show for empty prefix (unless explicit)
  if (word.from === word.to) return null;
  return word;
}

function jsCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = matchWord(context);
  if (!word) return null;

  const prefix = context.state.sliceDoc(word.from, word.to).toLowerCase();
  const all = [...jsSnippets, ...jsKeywords, ...jsGlobals, ...reactSnippets];
  const options = all.filter((c) => c.label.toLowerCase().startsWith(prefix));

  return { from: word.from, options, validFor: /^[\w$]*$/ };
}

function tsCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = matchWord(context);
  if (!word) return null;

  const prefix = context.state.sliceDoc(word.from, word.to).toLowerCase();
  const all = [...jsSnippets, ...jsKeywords, ...tsKeywords, ...jsGlobals, ...reactSnippets];
  const options = all.filter((c) => c.label.toLowerCase().startsWith(prefix));

  return { from: word.from, options, validFor: /^[\w$]*$/ };
}

function jsxCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = matchWord(context);
  if (!word) return null;

  const prefix = context.state.sliceDoc(word.from, word.to).toLowerCase();
  const all = [...jsSnippets, ...jsKeywords, ...jsGlobals, ...reactSnippets];
  const options = all.filter((c) => c.label.toLowerCase().startsWith(prefix));

  return { from: word.from, options, validFor: /^[\w$]*$/ };
}

function cssCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = matchWord(context);
  if (!word) return null;

  const prefix = context.state.sliceDoc(word.from, word.to).toLowerCase();
  const all = [...cssSnippets, ...cssProps, ...cssValues];
  const options = all.filter((c) => c.label.toLowerCase().startsWith(prefix));

  return { from: word.from, options, validFor: /^[\w$-]*$/ };
}

function htmlCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = matchWord(context);
  if (!word) return null;

  const prefix = context.state.sliceDoc(word.from, word.to).toLowerCase();
  const all = [...htmlSnippets, ...htmlTags, ...htmlAttrs];
  const options = all.filter((c) => c.label.toLowerCase().startsWith(prefix));

  return { from: word.from, options, validFor: /^[\w$-]*$/ };
}

function pyCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = matchWord(context);
  if (!word) return null;

  const prefix = context.state.sliceDoc(word.from, word.to).toLowerCase();
  const all = [...pySnippets, ...pyKeywords];
  const options = all.filter((c) => c.label.toLowerCase().startsWith(prefix));

  return { from: word.from, options, validFor: /^[\w$]*$/ };
}

// ═══════════════════════════════════════════════════════════════
// LANGUAGE-REGISTERED EXTENSIONS
// ═══════════════════════════════════════════════════════════════
// These attach completion sources to each language via `.data()`.
// The autocompletion from basicSetup automatically picks them up.

export const jsAutoComplete = javascriptLanguage.data.of({
  autocomplete: jsCompletionSource,
});

export const tsAutoComplete = typescriptLanguage.data.of({
  autocomplete: tsCompletionSource,
});

export const jsxAutoComplete = jsxLanguage.data.of({
  autocomplete: jsxCompletionSource,
});

export const tsxAutoComplete = tsxLanguage.data.of({
  autocomplete: jsxCompletionSource,
});

export const cssAutoComplete = cssLanguage.data.of({
  autocomplete: cssCompletionSource,
});

export const htmlAutoComplete = htmlLanguage.data.of({
  autocomplete: htmlCompletionSource,
});

export const pyAutoComplete = pythonLanguage.data.of({
  autocomplete: pyCompletionSource,
});
