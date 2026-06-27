/**
 * customData Storage Limit Test
 *
 * Paste this entire script into the browser console while on the Perchance page
 * (with the agent loaded). It tests how much data oc.thread.customData can hold.
 *
 * Usage:
 *   1. Open Perchance page + DevTools Console (F12)
 *   2. Paste this script → runs automatically
 *   3. Watch results table
 *   4. After reload, paste:  checkPersistence()
 *   5. To clean up test data:  cleanup()
 */

// ─── Configuration ──────────────────────────────────────────
const TEST_SIZES = [
  { label: "1KB",    bytes: 1024 },
  { label: "5KB",    bytes: 5 * 1024 },
  { label: "10KB",   bytes: 10 * 1024 },
  { label: "50KB",   bytes: 50 * 1024 },
  { label: "100KB",  bytes: 100 * 1024 },
  { label: "500KB",  bytes: 500 * 1024 },
  { label: "1MB",    bytes: 1024 * 1024 },
  { label: "5MB",    bytes: 5 * 1024 * 1024 },
  { label: "10MB",   bytes: 10 * 1024 * 1024 },
  { label: "25MB",   bytes: 25 * 1024 * 1024 },
  { label: "50MB",   bytes: 50 * 1024 * 1024 },
  { label: "100MB",  bytes: 100 * 1024 * 1024 },
];

const KEY_PREFIX = "__test_";

// ─── Helpers ────────────────────────────────────────────────

function debugOc() {
  const oc = window.oc;
  console.log("🔍 Debug — window.oc:", oc ? "exists" : "❌ MISSING");
  if (!oc) return;
  console.log("   oc.thread:", oc.thread ? "exists" : "❌ MISSING");
  if (!oc.thread) return;
  console.log("   oc.thread.customData:", oc.thread.customData ?? "❌ undefined");
  console.log("   oc.thread.messages:", Array.isArray(oc.thread.messages) ? `array(${oc.thread.messages.length})` : "❌ MISSING");
  console.log("   oc.generateText:", typeof oc.generateText);
  console.log("   oc.window:", oc.window ? "exists" : "❌ MISSING");
  // Show all own keys on thread
  console.log("   oc.thread keys:", Object.keys(oc.thread).join(", "));
}

function getCustomData() {
  debugOc();
  if (!window.oc) {
    throw new Error("window.oc not found — are you on the Perchance page?");
  }
  if (!window.oc.thread) {
    throw new Error("oc.thread not found — is the agent loaded?");
  }
  // customData may be undefined until first write — initialize if needed
  if (window.oc.thread.customData === undefined) {
    console.log("⚠️  oc.thread.customData is undefined — attempting to initialize...");
    try {
      window.oc.thread.customData = {};
    } catch (e) {
      throw new Error("Cannot initialize customData: " + e.message);
    }
  }
  return window.oc.thread.customData;
}

function generatePayload(targetBytes) {
  // Use random content to avoid compression tricks
  const chunk = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  while (result.length < targetBytes) {
    result += chunk;
  }
  return result.slice(0, targetBytes);
}

function keyFor(label) {
  return KEY_PREFIX + label;
}

function byteSize(str) {
  return new Blob([str]).size;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ─── Core Test ──────────────────────────────────────────────

async function runWriteTest(label, bytes) {
  const data = getCustomData();
  const key = keyFor(label);
  const payload = generatePayload(bytes);
  const actualSize = byteSize(payload);

  const result = {
    label,
    targetBytes: bytes,
    actualSize,
    writeSuccess: false,
    writeTimeMs: 0,
    verified: false,
    readTimeMs: 0,
    error: null,
  };

  // Write
  try {
    const t0 = performance.now();
    data[key] = payload;
    const t1 = performance.now();
    result.writeTimeMs = Math.round(t1 - t0);
    result.writeSuccess = true;
  } catch (e) {
    result.error = "WRITE: " + e.message;
    return result;
  }

  // Read back and verify
  try {
    const t0 = performance.now();
    const readBack = data[key];
    const t1 = performance.now();
    result.readTimeMs = Math.round(t1 - t0);

    if (readBack === payload) {
      result.verified = true;
    } else {
      result.error = "VERIFY MISMATCH: read " + (readBack?.length ?? 0) + " chars, expected " + payload.length;
    }
  } catch (e) {
    result.error = "READ: " + e.message;
  }

  return result;
}

async function runAll() {
  console.clear();
  console.log("🔬 customData Storage Limit Test");
  console.log("   Testing oc.thread.customData with sizes up to 100MB\n");

  // Verify environment
  try {
    getCustomData();
  } catch (e) {
    console.error("❌ " + e.message);
    return;
  }

  // Clean previous test data
  cleanup();

  const results = [];
  let maxSuccessBytes = 0;
  let firstFailure = null;

  for (const { label, bytes } of TEST_SIZES) {
    console.log(`⏳ Testing ${label} (${formatBytes(bytes)})...`);

    const result = await runWriteTest(label, bytes);
    results.push(result);

    if (result.writeSuccess && result.verified) {
      maxSuccessBytes = bytes;
      console.log(`   ✅ Write: ${result.writeTimeMs}ms | Read: ${result.readTimeMs}ms | Size: ${formatBytes(result.actualSize)}`);
    } else {
      firstFailure = label;
      console.log(`   ❌ FAILED: ${result.error}`);
      break; // Stop at first failure
    }

    // Yield to browser between large writes
    if (bytes >= 1024 * 1024) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // Print summary table
  console.log("\n📊 Results:");
  console.table(
    results.map((r) => ({
      Size: r.label,
      "Written": r.writeSuccess ? "✅" : "❌",
      "Write(ms)": r.writeTimeMs || "-",
      "Verified": r.verified ? "✅" : "❌",
      "Read(ms)": r.readTimeMs || "-",
      "Actual": formatBytes(r.actualSize),
      "Error": r.error || "",
    }))
  );

  console.log(`\n🎯 Max successful size: ${formatBytes(maxSuccessBytes)}`);
  if (firstFailure) {
    console.log(`⚠️  First failure at: ${firstFailure}`);
  } else {
    console.log(`🎉 All sizes up to 100MB succeeded!`);
  }

  console.log(`\n📋 Next steps:`);
  console.log(`   1. Reload the page`);
  console.log(`   2. Paste:  checkPersistence()`);
  console.log(`   3. To clean up:  cleanup()`);

  // Store results globally for programmatic access
  window.__customDataTestResults = results;
  console.log(`\n💾 Full results available at: window.__customDataTestResults`);

  return results;
}

// ─── Persistence Check ──────────────────────────────────────

function checkPersistence() {
  console.log("🔍 Checking persistence after reload...\n");

  const data = getCustomData();
  const results = [];

  for (const { label } of TEST_SIZES) {
    const key = keyFor(label);
    const value = data[key];

    const result = {
      label,
      persisted: value !== undefined,
      size: value ? formatBytes(byteSize(value)) : "-",
    };
    results.push(result);

    if (result.persisted) {
      console.log(`   ✅ ${label}: survived (${result.size})`);
    } else {
      console.log(`   ❌ ${label}: lost`);
    }
  }

  const survived = results.filter((r) => r.persisted);
  const lost = results.filter((r) => !r.persisted);

  console.log(`\n📊 Persistence: ${survived.length}/${results.length} survived`);

  if (lost.length > 0) {
    console.log(`⚠️  Lost: ${lost.map((r) => r.label).join(", ")}`);
    console.log(`💡 Max persisted size: ${survived.length > 0 ? survived[survived.length - 1].label : "none"}`);
  } else {
    console.log(`🎉 All test data survived the reload!`);
  }

  window.__customDataPersistenceResults = results;
  return results;
}

// ─── Cleanup ────────────────────────────────────────────────

function cleanup() {
  try {
    const data = getCustomData();
    let count = 0;
    for (const key of Object.keys(data)) {
      if (key.startsWith(KEY_PREFIX)) {
        delete data[key];
        count++;
      }
    }
    console.log(`🧹 Cleaned up ${count} test key(s)`);
  } catch (e) {
    console.warn("Cleanup failed:", e.message);
  }
}

// ─── Auto-run ───────────────────────────────────────────────
runAll();
