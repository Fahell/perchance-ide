/**
 * Line-level diff using Myers algorithm.
 *
 * Zero dependencies — ~80 lines core + helpers.
 * Outputs DiffLine[] for rendering unified diff views.
 *
 * Based on: https://neil.fraser.name/writing/diff/
 * Simplified for line-level only (no character/word).
 */
// ─── Myers diff (line-level) ───────────────────────────────
function myers(oldLines, newLines) {
    const N = oldLines.length;
    const M = newLines.length;
    const max = N + M;
    const V = new Map();
    V.set(1, 0);
    const Vs = [];
    // Forward pass: build trace
    for (let d = 0; d <= max; d++) {
        for (let k = -d; k <= d; k += 2) {
            const down = k === -d || (k !== d && (V.get(k - 1) ?? -Infinity) < (V.get(k + 1) ?? -Infinity));
            const kPrev = down ? k + 1 : k - 1;
            let x = V.get(kPrev) ?? 0;
            let y = x - kPrev;
            if (down) {
                x = x; // vertical (delete)
            }
            else {
                x = x + 1; // horizontal (insert)
            }
            y = x - k;
            while (x < N && y < M && oldLines[x] === newLines[y]) {
                x++;
                y++;
            }
            V.set(k, x);
            if (x >= N && y >= M) {
                // Backtrack to build edit script
                const path = [];
                let cx = N;
                let cy = M;
                let cd = d;
                const cV = [...Vs, new Map(V)];
                while (cd > 0) {
                    const vMap = cV[cd - 1];
                    const ck = cx - cy;
                    const down = ck === -cd || (ck !== cd && (vMap.get(ck - 1) ?? -Infinity) < (vMap.get(ck + 1) ?? -Infinity));
                    const kPrev2 = down ? ck + 1 : ck - 1;
                    let px = vMap.get(kPrev2) ?? 0;
                    let py = px - kPrev2;
                    if (down) {
                        py = py + 1; // py = px - (kPrev2) → py+1 = px - (kPrev2 - 1) = px - ck
                    }
                    else {
                        px = px + 1;
                    }
                    // Diagonal moves (unchanged lines)
                    while (cx > px && cy > py) {
                        cx--;
                        cy--;
                        path.unshift({ type: "unchanged", line: oldLines[cx] });
                    }
                    // Single edit operation
                    if (down) {
                        cy--;
                        path.unshift({ type: "removed", line: oldLines[cx] });
                    }
                    else {
                        cx--;
                        path.unshift({ type: "added", line: newLines[cy] });
                    }
                    cd--;
                    cx = px;
                    cy = py;
                }
                return path;
            }
        }
        Vs.push(new Map(V));
    }
    // Fallback: simple line-by-line comparison
    return simpleDiff(oldLines, newLines);
}
function simpleDiff(oldLines, newLines) {
    const result = [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
        if (i < oldLines.length) {
            if (i < newLines.length && oldLines[i] === newLines[i]) {
                result.push({ type: "unchanged", line: oldLines[i] });
            }
            else {
                result.push({ type: "removed", line: oldLines[i] });
            }
        }
        if (i < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[i])) {
            result.push({ type: "added", line: newLines[i] });
        }
    }
    return result;
}
// ─── Public API ──────────────────────────────────────────────
/**
 * Compare two strings line-by-line and return diff lines.
 * Handles empty strings: oldText="" → all lines "added".
 */
export function diffLines(oldText, newText, maxLines = 500) {
    const oldLines = oldText === "" ? [] : oldText.split("\n");
    const newLines = newText === "" ? [] : newText.split("\n");
    if (oldLines.length === 0 && newLines.length === 0)
        return [];
    const raw = myers(oldLines, newLines);
    // Truncate if too long
    const lines = raw.length > maxLines ? raw.slice(0, maxLines) : raw;
    return lines.map((l) => ({
        type: l.type,
        value: l.line,
    }));
}
