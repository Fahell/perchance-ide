/**
 * Truncation utilities — smart truncation of large text outputs
 * for tool results in the agent loop.
 */
export function truncateOutput(text, max, metric) {
    if (metric === 'lines') {
        const lines = text.split('\n');
        if (lines.length <= max)
            return text;
        return (lines.slice(0, max).join('\n') +
            `\n... (${lines.length - max} more lines omitted)`);
    }
    if (text.length <= max)
        return text;
    const truncated = text.slice(0, max);
    const lastNewline = truncated.lastIndexOf('\n');
    // Only cut at newline if we found one within the last 20% of the limit
    const cutPoint = lastNewline > max * 0.8 ? lastNewline : max;
    const omitted = text.length - cutPoint;
    const omittedLines = text.slice(cutPoint).split('\n').length - 1;
    return (text.slice(0, cutPoint) +
        `\n... (${omitted} more characters, ${omittedLines} lines omitted)`);
}
