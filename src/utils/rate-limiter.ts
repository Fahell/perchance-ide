/**
 * Sliding Window Rate Limiter for tool calls
 *
 * Prevents abuse (accidental or intentional) by limiting the number of
 * calls to a specific tool within a configurable time window.
 *
 * Algorithm: Sliding Window Log
 * - Stores timestamps of each allowed call in a sorted array.
 * - On each check, evicts entries older than the window before evaluating.
 * - Returns retryAfterMs when denied so callers can inform the agent.
 *
 * Complexity: O(n) per check where n = maxCalls (negligible for small limits).
 */

// ─── Types ──────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum number of calls allowed within the window. */
  maxCalls: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the call is allowed. */
  allowed: boolean;
  /** When denied, the number of ms until the next slot opens. Undefined when allowed. */
  retryAfterMs?: number;
}

// ─── Implementation ─────────────────────────────────────────

export class SlidingWindowRateLimiter {
  private timestamps: number[] = [];
  private readonly maxCalls: number;
  private readonly windowMs: number;

  constructor(config: RateLimitConfig) {
    if (config.maxCalls < 1) {
      throw new RangeError("RateLimitConfig.maxCalls must be >= 1");
    }
    if (config.windowMs < 1) {
      throw new RangeError("RateLimitConfig.windowMs must be >= 1");
    }
    this.maxCalls = config.maxCalls;
    this.windowMs = config.windowMs;
  }

  /**
   * Check whether a call is allowed under the current rate limit.
   * If allowed, records the timestamp internally.
   * If denied, returns retryAfterMs indicating how long to wait.
   */
  check(): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Evict expired entries from the front of the array
    while (this.timestamps.length > 0 && this.timestamps[0]! <= windowStart) {
      this.timestamps.shift();
    }

    if (this.timestamps.length < this.maxCalls) {
      this.timestamps.push(now);
      return { allowed: true };
    }

    // Denied — calculate when the oldest entry will expire
    const oldestInWindow = this.timestamps[0]!;
    const retryAfterMs = oldestInWindow + this.windowMs - now + 1;

    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1) };
  }

  /** Clear all recorded timestamps. Useful for testing or session reset. */
  reset(): void {
    this.timestamps = [];
  }
}
