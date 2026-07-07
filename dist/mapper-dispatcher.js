/**
 * Mapper Dispatcher — listens to VFS change events and dispatches
 * the mapper agent when appropriate.
 *
 * Responsibilities:
 * 1. Accumulate VFS change events
 * 2. Coalesce events for the same path (last event wins)
 * 3. Check agentProcessing flag before dispatching
 * 4. Persist hash table to IndexedDB
 * 5. Fire-and-forget mapper execution
 */
import { dbKvGet, dbKvSet } from "./db.js";
import { runMapper } from "./mapper-agent.js";
import { getAllHashes, onVfsChange } from "./vfs-events.js";
// ─── Constants ──────────────────────────────────────────────
const HASHES_KEY = "_mapper:hashes";
const DISPATCH_DELAY_MS = 3000; // Wait 3s after last event before dispatching
// ─── State ──────────────────────────────────────────────────
let _pendingEvents = [];
let _dispatchTimer = null;
/**
 * Reference to the agentProcessing flag from index.ts.
 * Set via initMapperDispatcher() to avoid circular imports.
 */
let _isAgentProcessing = null;
// ─── Hash Table Persistence ─────────────────────────────────
/** Load persisted hash table from IndexedDB (for debugging/recovery). */
export async function loadPersistedHashes() {
    return dbKvGet(HASHES_KEY);
}
/** Persist current in-memory hash table to IndexedDB. */
export async function persistHashes() {
    const hashes = getAllHashes();
    await dbKvSet(HASHES_KEY, hashes);
}
// ─── Event Coalescing ───────────────────────────────────────
/**
 * Coalesce pending events: for the same path, keep only the latest event.
 * Exception: if a file was created then deleted, remove both events.
 */
function coalesceEvents(events) {
    const byPath = new Map();
    for (const event of events) {
        const key = event.type === "renamed" ? event.fromPath : event.path;
        const existing = byPath.get(key);
        if (!existing) {
            byPath.set(key, event);
            continue;
        }
        // Coalesce: created + deleted = nothing
        if (existing.type === "created" && event.type === "deleted") {
            byPath.delete(key);
            continue;
        }
        // Coalesce: modified + deleted = deleted (with original previousHash)
        if ((existing.type === "modified" || existing.type === "created") && event.type === "deleted") {
            byPath.set(key, {
                ...event,
                previousHash: existing.previousHash ?? existing.currentHash,
            });
            continue;
        }
        // Coalesce: any + modified = modified (keep original previousHash)
        if (event.type === "modified") {
            byPath.set(key, {
                ...event,
                previousHash: existing.previousHash ?? existing.currentHash,
            });
            continue;
        }
        // Default: latest event wins
        byPath.set(key, event);
    }
    return Array.from(byPath.values());
}
// ─── Dispatch Logic ─────────────────────────────────────────
function scheduleDispatch() {
    if (_dispatchTimer !== null) {
        clearTimeout(_dispatchTimer);
    }
    _dispatchTimer = setTimeout(() => {
        _dispatchTimer = null;
        dispatchMapper();
    }, DISPATCH_DELAY_MS);
}
async function dispatchMapper() {
    // Don't dispatch while main agent is processing
    if (_isAgentProcessing?.()) {
        console.log("🗺️ [Dispatcher] Agent busy, deferring mapper");
        // Re-schedule to check again later
        scheduleDispatch();
        return;
    }
    if (_pendingEvents.length === 0)
        return;
    // Take ownership of pending events
    const events = [..._pendingEvents];
    _pendingEvents = [];
    // Coalesce events for same path
    const coalesced = coalesceEvents(events);
    if (coalesced.length === 0) {
        console.log("🗺️ [Dispatcher] All events coalesced away");
        return;
    }
    console.log(`🗺️ [Dispatcher] Dispatching ${coalesced.length} coalesced event(s) to mapper`);
    // Persist hash table before mapper runs
    await persistHashes().catch((e) => {
        console.warn("⚠️ [Dispatcher] Failed to persist hashes:", e);
    });
    // Fire-and-forget mapper execution
    runMapper(coalesced).catch((err) => {
        console.error("❌ [Dispatcher] Mapper failed:", err);
    });
}
// ─── Event Listener ─────────────────────────────────────────
function handleVfsEvent(event) {
    // Skip _map directory self-writes (any project)
    if (event.path.includes("/_map/"))
        return;
    if (event.fromPath?.includes("/_map/"))
        return;
    if (event.toPath?.includes("/_map/"))
        return;
    _pendingEvents.push(event);
    scheduleDispatch();
}
// ─── Initialization ─────────────────────────────────────────
/**
 * Initialize the mapper dispatcher.
 * Must be called after initHashes() and before agent starts processing.
 *
 * @param isAgentProcessing Function that returns true when main agent is busy
 */
export function initMapperDispatcher(isAgentProcessing) {
    _isAgentProcessing = isAgentProcessing;
    // Subscribe to VFS change events
    onVfsChange(handleVfsEvent);
    console.log("🗺️ [Dispatcher] Initialized — listening for VFS events");
}
/**
 * Flush any pending events immediately.
 * Call this when the agent finishes processing to trigger mapper sooner.
 */
export function flushPendingEvents() {
    if (_dispatchTimer !== null) {
        clearTimeout(_dispatchTimer);
        _dispatchTimer = null;
    }
    if (_pendingEvents.length > 0) {
        dispatchMapper();
    }
}
