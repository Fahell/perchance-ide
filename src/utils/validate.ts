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
export function validateShape<T extends Record<string, unknown>>(
  shape: { [K in keyof T]: (value: unknown) => value is T[K] }
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    if (typeof value !== "object" || value === null) return false;
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(shape) as (keyof T)[]) {
      const validator = shape[key];
      if (!validator(obj[key as string])) return false;
    }
    return true;
  };
}

/**
 * Validate that a value is an array where every element passes the given check.
 */
export function isArrayOf<T>(
  itemGuard: (v: unknown) => v is T
): (v: unknown) => v is T[] {
  return (v: unknown): v is T[] => {
    if (!Array.isArray(v)) return false;
    return v.every(itemGuard);
  };
}
