/**
 * Breadcrumb symbol extraction from CM6's Lezer syntax tree.
 *
 * For a given cursor position, walks UP the syntax tree to build
 * an ancestor chain showing where the cursor is in the file's
 * structure hierarchy (e.g. ClassName > methodName).
 *
 * Reuses patterns from outline.ts but goes upward instead of listing all symbols.
 */
import { syntaxTree } from "@codemirror/language";
// ─── Color map for UI consumption ───────────────────────────
export const BREADCRUMB_COLORS = {
    function: "#61afef",
    class: "#e5c07b",
    variable: "#e06c75",
    interface: "#e5c07b",
    type: "#e5c07b",
    enum: "#c678dd",
    method: "#61afef",
    rule: "#98c379",
    keyframes: "#c678dd",
    atRule: "#d19a66",
    element: "#c678dd",
};
// ─── Helper ─────────────────────────────────────────────────
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
// ─── JS/TS ancestor extraction ──────────────────────────────
/**
 * For a cursor position, walk up the syntax tree and collect
 * named ancestor nodes (function, class, method, etc.).
 * Returns the chain from outermost to innermost.
 */
function getJSAncestors(view, pos) {
    const crumbs = [];
    const tree = syntaxTree(view.state);
    const cursor = tree.cursor();
    // Move cursor to the deepest node at position
    if (!cursor.moveTo(pos))
        return crumbs;
    // Walk up to root collecting named ancestors
    const seen = new Set();
    do {
        const { name: nodeName, from, to } = cursor;
        if (from === to)
            continue;
        if (seen.has(from))
            continue;
        seen.add(from);
        let label = "";
        let type = null;
        switch (nodeName) {
            case "FunctionDeclaration":
            case "FunctionExpression":
            case "ArrowFunction": {
                const id = findChild(cursor, "Identifier");
                if (id) {
                    label = view.state.doc.sliceString(id.from, id.to);
                    type = "function";
                }
                break;
            }
            case "ClassDeclaration":
            case "ClassExpression": {
                const id = findChild(cursor, "Identifier");
                if (id) {
                    label = view.state.doc.sliceString(id.from, id.to);
                    type = "class";
                }
                break;
            }
            case "MethodDeclaration":
            case "GetterDeclaration":
            case "SetterDeclaration": {
                const pn = findChild(cursor, "PropertyName");
                if (pn) {
                    label = view.state.doc.sliceString(pn.from, pn.to);
                    type = "method";
                }
                break;
            }
            case "InterfaceDeclaration":
            case "TypeAliasDeclaration":
            case "EnumDeclaration": {
                const id = findChild(cursor, "Identifier");
                if (id) {
                    label = view.state.doc.sliceString(id.from, id.to);
                    type = nodeName === "InterfaceDeclaration"
                        ? "interface"
                        : nodeName === "TypeAliasDeclaration"
                            ? "type"
                            : "enum";
                }
                break;
            }
            case "VariableDefinition": {
                const id = findChild(cursor, "Identifier");
                if (id) {
                    label = view.state.doc.sliceString(id.from, id.to);
                    type = "variable";
                }
                break;
            }
        }
        if (label && type) {
            crumbs.unshift({ name: label, type, from, to });
        }
    } while (cursor.parent());
    return crumbs;
}
// ─── CSS ancestor extraction ────────────────────────────────
function getCSSAncestors(view, pos) {
    const crumbs = [];
    const tree = syntaxTree(view.state);
    const cursor = tree.cursor();
    if (!cursor.moveTo(pos))
        return crumbs;
    const seen = new Set();
    do {
        const { name: nodeName, from, to } = cursor;
        if (from === to)
            continue;
        if (seen.has(from))
            continue;
        seen.add(from);
        if (nodeName === "RuleSet") {
            const sel = findChild(cursor, "Selector");
            if (sel) {
                const name = view.state.doc.sliceString(sel.from, sel.to).trim();
                crumbs.unshift({ name, type: "rule", from, to });
            }
        }
        else if (nodeName === "Keyframes") {
            const id = findChild(cursor, "Identifier");
            if (id) {
                const name = view.state.doc.sliceString(id.from, id.to);
                crumbs.unshift({ name, type: "keyframes", from, to });
            }
        }
        else if (nodeName === "AtRule") {
            const text = view.state.doc.sliceString(from, to).split(/\s/).slice(0, 2).join(" ");
            crumbs.unshift({ name: text, type: "atRule", from, to });
        }
    } while (cursor.parent());
    return crumbs;
}
// ─── HTML ancestor extraction ───────────────────────────────
function getHTMLAncestors(view, pos) {
    const crumbs = [];
    const tree = syntaxTree(view.state);
    const cursor = tree.cursor();
    if (!cursor.moveTo(pos))
        return crumbs;
    const seen = new Set();
    do {
        const { name: nodeName, from, to } = cursor;
        if (from === to)
            continue;
        if (seen.has(from))
            continue;
        seen.add(from);
        if (nodeName === "OpenTag" || nodeName === "SelfClosingTag") {
            const tagNode = findChild(cursor, "TagName");
            const tagName = tagNode
                ? view.state.doc.sliceString(tagNode.from, tagNode.to)
                : "?";
            let label = tagName;
            // Check for id/class attributes
            const attrCursor = cursor.node.cursor();
            if (attrCursor.firstChild()) {
                do {
                    if (attrCursor.name === "AttributeName") {
                        const attr = view.state.doc.sliceString(attrCursor.from, attrCursor.to);
                        const valCursor = attrCursor.node?.nextSibling;
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
                } while (attrCursor.nextSibling());
            }
            crumbs.unshift({ name: label, type: "element", from, to });
        }
    } while (cursor.parent());
    return crumbs;
}
// ─── Main entry ─────────────────────────────────────────────
/**
 * Get breadcrumb hierarchy for a cursor position.
 * Returns the ancestor chain from outermost (e.g. class) to innermost (e.g. method).
 */
export function getBreadcrumbs(view, pos) {
    if (!view)
        return [];
    const topType = syntaxTree(view.state).topNode.name;
    if (topType === "Script" || topType === "Program" || topType === "Module") {
        return getJSAncestors(view, pos);
    }
    if (topType === "Stylesheet") {
        return getCSSAncestors(view, pos);
    }
    if (topType === "Document") {
        return getHTMLAncestors(view, pos);
    }
    return getJSAncestors(view, pos);
}
