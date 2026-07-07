/**
 * Runtime validation utilities — zero-dependency type guards.
 *
 * Provides `validateShape<T>` for validating unknown values against
 * a shape definition at runtime. Used by db.ts for safe KV deserialization.
 */
/**
 * Type guard factory — validates that an unknown value matches the given shape.
 *
 * @example
 * ```ts
 * const isChunkSummary = validateShape<ChunkSummary>({
 *   from: v => typeof v === "number",
 *   to: v => typeof v === "number",
 *   summary: v => typeof v === "string",
 *   tokenCount: v => typeof v === "number",
 * });
 *
 * const data: unknown = await dbKvGet("key");
 * if (isChunkSummary(data)) {
 *   data.from; // typed as number
 * }
 * ```
 */
export function validateShape(shape) {
    return (value) => {
        if (typeof value !== "object" || value === null)
            return false;
        const obj = value;
        for (const key of Object.keys(shape)) {
            const validator = shape[key];
            if (!validator(obj[key]))
                return false;
        }
        return true;
    };
}
/**
 * Validate that a value is an array where every element passes the given check.
 */
export function isArrayOf(itemGuard) {
    return (v) => {
        if (!Array.isArray(v))
            return false;
        return v.every(itemGuard);
    };
}
