/**
 * Timeout and signal helpers for the agent loop.
 *
 * Provides composable AbortSignal utilities so that LLM calls and tool
 * executions can be cancelled by user action, timeout, or both.
 */

import { getAi } from "../types.js";

// ─── Constants ──────────────────────────────────────────────
export const LLM_TIMEOUT_MS = 300_000; // 5 min — Perchance AI can be slow

// ─── combineSignals ─────────────────────────────────────────
/**
 * Combine multiple AbortSignals into one.
 * The combined signal aborts when ANY constituent signal aborts.
 * Falls back to manual combining if AbortSignal.any() is unavailable.
 */
export function combineSignals(...signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }
  // Manual fallback for older browsers
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener("abort", () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

// ─── withTimeout ────────────────────────────────────────────
/**
 * Wrap a promise with a timeout via AbortSignal.
 * If an existingSignal is provided, combines both — whichever fires first aborts.
 * On timeout, rejects with DOMException 'AbortError'.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  existingSignal?: AbortSignal
): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(ms);
  const signal = existingSignal
    ? combineSignals(existingSignal, timeoutSignal)
    : timeoutSignal;

  if (signal.aborted) {
    return Promise.reject(
      new DOMException(signal.reason?.message ?? `Timed out after ${ms}ms`, "AbortError")
    );
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(
        new DOMException(
          signal.reason?.message ?? `Operation "${label}" timed out after ${ms}ms`,
          "AbortError"
        )
      );
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      }
    );
  });
}

// ─── aiCallWithSignal ───────────────────────────────────────
/**
 * Wrapper around getAi() that supports AbortSignal cancellation.
 * The Perchance ai-text-plugin doesn't support AbortSignal natively,
 * so we listen to the signal and call result.stop() on abort.
 * Returns the AiCallResult (which is thenable — can be awaited).
 */
export function aiCallWithSignal(
  options: {
    instruction: string;
    startWith?: string;
    stopSequences?: string[];
  },
  signal?: AbortSignal
): Promise<any> {
  const aiResult = getAi()(options);

  if (!signal) {
    return Promise.resolve(aiResult);
  }

  if (signal.aborted) {
    aiResult.stop();
    return Promise.reject(
      new DOMException(signal.reason?.message ?? "Aborted", "AbortError")
    );
  }

  return new Promise<any>((resolve, reject) => {
    let settled = false;

    const onAbort = () => {
      if (settled) return;
      settled = true;
      aiResult.stop();
      reject(new DOMException(signal!.reason?.message ?? "Aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });

    // The thenable resolves/rejects when generation finishes
    Promise.resolve(aiResult).then(
      (val: any) => {
        if (settled) return;
        settled = true;
        signal!.removeEventListener("abort", onAbort);
        resolve(val);
      },
      (err: any) => {
        if (settled) return;
        settled = true;
        signal!.removeEventListener("abort", onAbort);
        reject(err);
      }
    );
  });
}
