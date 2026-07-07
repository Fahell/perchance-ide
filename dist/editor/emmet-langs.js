/**
 * Emmet language detection — maps file extensions to Emmet syntax types.
 *
 * Used by CodeEditor.tsx to determine whether to load Emmet
 * and which syntax configuration to use.
 */
/**
 * Determine the Emmet syntax for a given file path.
 * Returns `null` if the file type does not support Emmet expansion.
 */
export function getEmmetSyntax(path) {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "html":
        case "htm":
            return "html";
        case "css":
            return "css";
        case "jsx":
            return "jsx";
        case "tsx":
            return "jsx";
        default:
            return null;
    }
}
