/**
 * Memory Extraction — persistent facts extracted from conversations.
 *
 * After each agent response, extracts 1-3 "timeless facts" using window.ai()
 * and stores them in IndexedDB via the db module.
 */

import { dbKvDel, dbKvGet, dbKvSet } from "./db.js";
import { getAi } from "./types.js";

// ─── Constants ──────────────────────────────────────────────
const MEMORIES_KEY = "memories";
const MAX_MEMORIES = 20;
const MIN_CONTENT_LENGTH = 50; // Skip trivial exchanges

// ─── Memory Persistence ─────────────────────────────────────
export async function getMemories(): Promise<string[]> {
  const memories = await dbKvGet<string[]>(MEMORIES_KEY);
  if (!Array.isArray(memories)) return [];
  return memories.filter((m): m is string => typeof m === "string");
}

async function saveMemories(memories: string[]): Promise<void> {
  await dbKvSet(MEMORIES_KEY, memories.slice(-MAX_MEMORIES));
}

export async function clearMemories(): Promise<void> {
  await dbKvDel(MEMORIES_KEY);
}

export async function deleteMemory(index: number): Promise<void> {
  const memories = await getMemories();
  if (index < 0 || index >= memories.length) return;
  memories.splice(index, 1);
  await saveMemories(memories);
}

// ─── Format for Context Injection ───────────────────────────
export async function formatMemories(): Promise<string> {
  const memories = await getMemories();
  if (memories.length === 0) return "";
  return memories.map((m) => `- ${m}`).join("\n");
}

// ─── Memory Extraction ──────────────────────────────────────
export async function extractMemories(
  userMessage: string,
  agentResponse: string
): Promise<void> {
  // Skip trivial exchanges
  if (userMessage.length < MIN_CONTENT_LENGTH && agentResponse.length < MIN_CONTENT_LENGTH) {
    return;
  }

  // Check for existing memories to avoid duplicates
  const existing = await getMemories();
  const existingText = existing.join("\n");

  const instruction = `Extract 1-3 NEW facts from this conversation exchange that would be useful to remember in future conversations. Focus on:
- User preferences, goals, or requirements
- Important decisions or conclusions
- Key technical details or constraints
- Names, dates, or specific references

RULES:
- Each fact must be self-contained (no pronouns without antecedents)
- Use specific names and details, not vague references
- Only extract facts NOT already in the existing memories
- If there are no new noteworthy facts, respond with: NONE

Existing memories:
${existingText || "(none)"}

Conversation exchange:
User: ${userMessage}
Assistant: ${agentResponse.slice(0, 1000)}

New facts (one per line, or NONE):`;

  try {
    const result = await getAi()({ instruction });
    const text = (result.generatedText || result.text || result.toString()).trim();

    // Check for no new facts
    if (text === "NONE" || text.includes("NONE") || text.length < 5) {
      console.log("🧠 [Memory] No new facts to extract");
      return;
    }

    // Parse facts (one per line)
    const newFacts: string[] = text
      .split("\n")
      .map((line: string) => line.replace(/^[-•*]\s*/, "").trim())
      .filter((line: string) => line.length > 10 && line !== "NONE");

    if (newFacts.length === 0) {
      console.log("🧠 [Memory] No valid facts extracted");
      return;
    }

    // Deduplicate against existing
    const unique = newFacts.filter(
      (fact: string) => !existing.some((e: string) => e.toLowerCase() === fact.toLowerCase())
    );

    if (unique.length === 0) {
      console.log("🧠 [Memory] All facts already exist");
      return;
    }

    // Append and save
    const updated = [...existing, ...unique];
    await saveMemories(updated);
    console.log("🧠 [Memory] Extracted", unique.length, "new fact(s). Total:", updated.length);
  } catch (err) {
    console.error("❌ [Memory] Extraction failed:", err);
  }
}
