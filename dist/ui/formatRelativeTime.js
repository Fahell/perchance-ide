/**
 * Format timestamps as relative time strings (e.g., "2 minutes ago", "now").
 *
 * Uses Intl.RelativeTimeFormat for recent timestamps, falls back to
 * toLocaleDateString for older ones. Also exports formatAbsoluteTime
 * for tooltips.
 */
/**
 * Format a timestamp as a relative time string.
 *
 * - < 60s: "now" / "agora"
 * - < 60m: "X minutes ago" / "há X minutos"
 * - < 24h: "X hours ago" / "há X horas"
 * - < 7d:  "X days ago" / "há X dias"
 * - >= 7d: locale date string
 */
export function formatRelativeTime(timestamp, locale) {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const isPt = locale?.startsWith("pt");
    if (seconds < 60)
        return isPt ? "agora" : "now";
    if (minutes < 60) {
        return tryRelativeFormat(-minutes, "minute", locale) ?? fallback();
    }
    if (hours < 24) {
        return tryRelativeFormat(-hours, "hour", locale) ?? fallback();
    }
    if (days < 7) {
        return tryRelativeFormat(-days, "day", locale) ?? fallback();
    }
    return fallback();
    function fallback() {
        return new Date(timestamp).toLocaleDateString(locale || "en", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }
}
/**
 * Format a timestamp as an absolute date/time string (for tooltips).
 */
export function formatAbsoluteTime(timestamp, locale) {
    return new Date(timestamp).toLocaleString(locale || "en", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}
/**
 * Try Intl.RelativeTimeFormat; return null if unsupported.
 */
function tryRelativeFormat(value, unit, locale) {
    try {
        const rtf = new Intl.RelativeTimeFormat(locale || "en", { numeric: "auto" });
        return rtf.format(value, unit);
    }
    catch {
        return null;
    }
}
