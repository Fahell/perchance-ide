/**
 * Retry with exponential backoff — zero-dependency utility
 *
 * Uses full jitter (AWS-recommended) and AbortSignal integration
 * for user cancellation support.
 */

// ─── Types ──────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms between retries (default: 10000) */
  maxDelay?: number;
  /** Optional AbortSignal for user cancellation */
  signal?: AbortSignal;
  /** Called before each retry attempt (for logging) */
  onRetry?: (error: Error, attempt: number) => void;
}

// ─── Types ──────────────────────────────────────────────────

/** An error object that may have an HTTP response attached. */
interface ErrorWithResponse {
  response?: { status: number };
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Determine if an error should trigger a retry.
 *
 * Retry on:
 * - Network errors (TypeError from fetch)
 * - HTTP 429 (rate limited)
 * - HTTP 5xx (server errors)
 *
 * Do NOT retry on:
 * - HTTP 4xx except 429 (client errors)
 * - AbortError (user cancelled or timeout)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // network error in fetch
  if (error instanceof DOMException && error.name === "AbortError") return false;
  const response = (error as ErrorWithResponse)?.response;
  if (response && typeof response.status === "number") {
    return response.status === 429 || response.status >= 500;
  }
  return false;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// ─── Main ──────────────────────────────────────────────────

/**
 * Wraps an async function with exponential backoff retry logic.
 *
 * - Uses full jitter: `delay = random() * min(initial * 2^attempt, max)`
 * - Passes an AbortSignal to `fn` for per-attempt cancellation
 * - Calls `signal.throwIfAborted()` before each attempt
 * - Only retries on retryable errors (network, 429, 5xx)
 *
 * @example
 * ```ts
 * const res = await retryWithBackoff(async () => {
 *   const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
 *   if (!r.ok) throw Object.assign(new Error(r.statusText), { response: r });
 *   return r;
 * }, { maxRetries: 3 });
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    signal,
    onRetry,
  } = options ?? {};

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check cancellation before starting attempt
      signal?.throwIfAborted();
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if aborted
      if (signal?.aborted) throw error;

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) throw error;

      // Last attempt — propagate the error
      if (attempt === maxRetries) throw lastError;

      // Calculate delay with full jitter
      const base = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      const delay = Math.random() * base; // full jitter: random [0, base)

      onRetry?.(lastError, attempt + 1);

      // Wait with abort support
      await sleep(delay, signal);
    }
  }

  // Should never reach here, but TypeScript wants a return
  throw lastError ?? new Error("retryWithBackoff: unexpected exit");
}
