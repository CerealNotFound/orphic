// Shared contract between the Mac worker and the server.
// `pnpm contracts` exports these as JSON Schema into /contracts for the Python worker.
import { z } from "zod";

export const ENTITY_KINDS = ["tool", "workflow", "prompt", "template", "repo", "course", "resource", "other"] as const;

export const CATEGORIES = [
  "ai-video",
  "ai-image",
  "ai-audio-voice",
  "ai-writing",
  "ai-coding",
  "ai-agents-automation",
  "llm-chat-assistants",
  "prompts",
  "design",
  "marketing-ads",
  "social-content",
  "productivity",
  "research-learning",
  "data-analytics",
  "dev-tools",
  "business-ops",
  "sales-crm",
  "finance",
  "hardware-gadgets",
  "other",
] as const;

export const EntityInput = z.object({
  name: z.string().min(1).describe("Product / resource name as people would search it, e.g. 'Higgsfield'"),
  kind: z.enum(ENTITY_KINDS),
  role: z.enum(["primary", "mentioned", "alternative"]).default("primary"),
  canonical_url: z.url().nullish().describe("Official URL. Only set if verified (domain matches, page matches the claim)."),
  link_verified: z.boolean().default(false),
  aliases: z.array(z.string()).default([]),
  summary: z.string().min(1).describe("1-2 sentences in English: what it is and what it does"),
  use_cases: z.array(z.string()).default([]).describe("Short English phrases, e.g. 'turn podcasts into short clips'"),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string()).default([]).describe("lowercase-kebab tags; reuse existing tags when possible"),
  search_terms: z
    .array(z.string())
    .default([])
    .describe("10-25 other ways a teammate might search for this: synonyms, plain-English phrasings of the problem it solves, related concepts, common misspellings. E.g. for a clip tool: 'repurpose long videos into shorts', 'podcast to reels'"),
  pricing: z.string().nullish().describe("free / freemium / paid / open-source, if known"),
  is_creator_owned: z.boolean().default(false).describe("True for the creator's own resource (prompt pack, template, workflow file) only reachable via their DM/link"),
  creator_handle: z.string().nullish(),
  comment_keyword: z.string().nullish().describe("If the reel says 'comment X to get it', the X"),
});
export type EntityInput = z.infer<typeof EntityInput>;

export const CaptureInput = z.object({
  source_url: z.string().nullish(),
  shortcode: z.string().nullish(),
  creator_handle: z.string().nullish(),
  caption: z.string().nullish(),
  transcript: z.string().nullish(),
  ocr_text: z.string().nullish(),
  comments_excerpt: z.string().nullish(),
  language: z.string().nullish(),
  archived_content: z.string().nullish().describe("Text copy of the destination page (for DM links)"),
  summary: z.string().nullish().describe("One line: what this reel/link is about"),
});

export const JobResult = z.object({
  status: z.enum(["ok", "pending_dm", "unresolved", "needs_user"]),
  confidence: z.number().min(0).max(1),
  capture: CaptureInput,
  entities: z.array(EntityInput).default([]),
  resolves_task_id: z.uuid().nullish().describe("Set when this link is the DM link that completes an open comment_for_link task"),
  reply_note: z.string().nullish().describe("Optional extra line shown to the sender"),
});
export type JobResult = z.infer<typeof JobResult>;

export const JobAsk = z.object({
  question: z.string().min(1).max(300),
  options: z.array(z.string().min(1).max(60)).min(1).max(6),
});

export const JobFail = z.object({
  error: z.string().min(1).max(2000),
  retryable: z.boolean().default(false),
});

export const JobProgress = z.object({
  text: z.string().min(1).max(200),
});
