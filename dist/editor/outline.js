/**
 * Outline symbol extraction from CM6's Lezer syntax tree.
 *
 * Uses `syntaxTree()` from `@codemirror/language` to walk the tree
 * and collect declarations, rules, and elements for the Outline panel.
 */
import { syntaxTree } from "@codemirror/language";
// ─── Helpers ────────────────────────────────────────────────
function findChild(nodeRef, name) {
    const cursor = nodeRef.node.cursor();
    if (cursor.firstChild()) {
        do {
            if (cursor.name === name)
                return cursor;
        } while (cursor.nextSibling());
    }
    return null;
}
// ─── JS/TS extractor ────────────────────────────────────────
function extractJSSymbols(view) {
    const symbols = [];
    syntaxTree(view.state).iterate({
        enter: (nodeRef) => {
            const { name: nodeName, from, to } = nodeRef;
            switch (nodeName) {
                case "FunctionDeclaration":
                case "FunctionExpression":
                case "ArrowFunction": {
                    const id = findChild(nodeRef, "Identifier");
                    if (id)
                        symbols.push({
                            name: view.state.doc.sliceString(id.from, id.to),
                            type: "function",
                            from,
                            to,
                        });
                    return false;
                }
                case "ClassDeclaration":
                case "ClassExpression": {
                    const id = findChild(nodeRef, "Identifier");
                    if (id)
                        symbols.push({
                            name: view.state.doc.sliceString(id.from, id.to),
                            type: "class",
                            from,
                            to,
                        });
                    return false;
                }
                case "VariableDefinition": {
                    const id = findChild(nodeRef, "Identifier");
                    if (id)
                        symbols.push({
                            name: view.state.doc.sliceString(id.from, id.to),
                            type: "variable",
                            from,
                            to,
                        });
                    return false;
                }
                case "InterfaceDeclaration":
                case "TypeAliasDeclaration":
                case "EnumDeclaration": {
                    const id = findChild(nodeRef, "Identifier");
                    if (id) {
                        const t = nodeName === "InterfaceDeclaration"
                            ? "interface"
                            : nodeName === "TypeAliasDeclaration"
                                ? "type"
                                : "enum";
                        symbols.push({ name: view.state.doc.sliceString(id.from, id.to), type: t, from, to });
                    }
                    return false;
                }
                case "MethodDeclaration":
                case "GetterDeclaration":
                case "SetterDeclaration": {
                    const pn = findChild(nodeRef, "PropertyName");
                    if (pn)
                        symbols.push({
                            name: view.state.doc.sliceString(pn.from, pn.to),
                            type: "method",
                            from,
                            to,
                        });
                    return false;
                }
            }
        },
    });
    return symbols;
}
// ─── CSS extractor ──────────────────────────────────────────
function extractCSSSymbols(view) {
    const symbols = [];
    syntaxTree(view.state).iterate({
        enter: (nodeRef) => {
            const { name: nodeName, from, to } = nodeRef;
            if (nodeName === "RuleSet") {
                const sel = findChild(nodeRef, "Selector");
                if (sel)
                    symbols.push({
                        name: view.state.doc.sliceString(sel.from, sel.to).trim(),
                        type: "rule",
                        from,
                        to,
                    });
                return false;
            }
            if (nodeName === "Keyframes") {
                const id = findChild(nodeRef, "Identifier");
                if (id)
                    symbols.push({
                        name: view.state.doc.sliceString(id.from, id.to),
                        type: "keyframes",
                        from,
                        to,
                    });
                return false;
            }
            if (nodeName === "AtRule") {
                const text = view.state.doc
                    .sliceString(from, to)
                    .split(/\s/)
                    .slice(0, 2)
                    .join(" ");
                symbols.push({ name: text, type: "atRule", from, to });
                return false;
            }
        },
    });
    return symbols;
}
// ─── HTML extractor ─────────────────────────────────────────
function extractHTMLSymbols(view) {
    const symbols = [];
    const seen = new Set();
    syntaxTree(view.state).iterate({
        enter: (nodeRef) => {
            const { name: nodeName, from, to } = nodeRef;
            if (nodeName === "OpenTag" || nodeName === "SelfClosingTag") {
                const tagNode = findChild(nodeRef, "TagName");
                const tagName = tagNode
                    ? view.state.doc.sliceString(tagNode.from, tagNode.to)
                    : "?";
                let label = tagName;
                // Walk attributes for id/class
                const cursor = nodeRef.node.cursor();
                if (cursor.firstChild()) {
                    do {
                        if (cursor.name === "AttributeName") {
                            const attr = view.state.doc.sliceString(cursor.from, cursor.to);
                            const valCursor = cursor.node?.nextSibling;
                            if (valCursor && valCursor.name === "AttributeValue") {
                                const val = view.state.doc
                                    .sliceString(valCursor.from, valCursor.to)
                                    .replace(/["']/g, "");
                                if (attr === "id") {
                                    label = `${tagName}#${val}`;
                                    break;
                                }
                                if (attr === "class") {
                                    label = `${tagName}.${val.split(/\s+/)[0]}`;
                                }
                            }
                        }
                    } while (cursor.nextSibling());
                }
                if (!seen.has(label)) {
                    seen.add(label);
                    symbols.push({ name: label, type: "element", from, to });
                }
                return false;
            }
        },
    });
    return symbols;
}
// ─── Main entry ─────────────────────────────────────────────
export function extractSymbols(view) {
    if (!view)
        return [];
    const topType = syntaxTree(view.state).topNode.name;
    if (topType === "Script" || topType === "Program" || topType === "Module") {
        return extractJSSymbols(view);
    }
    if (topType === "Stylesheet") {
        return extractCSSSymbols(view);
    }
    if (topType === "Document") {
        return extractHTMLSymbols(view);
    }
    // Fallback
    return extractJSSymbols(view);
}
