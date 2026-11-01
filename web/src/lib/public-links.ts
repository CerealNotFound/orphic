// Link rules shared by the open catalogue (no imports, safe anywhere).

/** Links whose owner can revoke access at any time (Drive, Docs, Notion, …). For these we open our saved copy. */
export const REVOCABLE = /^https?:\/\/([a-z0-9-]+\.)*(drive\.google\.com|docs\.google\.com|notion\.so|notion\.site|notion\.com|dropbox\.com|onedrive\.live\.com|1drv\.ms|box\.com|wetransfer\.com|we\.tl)\//i;
export const REVOCABLE_SQL = `'^https?://([a-z0-9-]+\\.)*(drive\\.google\\.com|docs\\.google\\.com|notion\\.so|notion\\.site|notion\\.com|dropbox\\.com|onedrive\\.live\\.com|1drv\\.ms|box\\.com|wetransfer\\.com|we\\.tl)/'`;

/** Social posts. We credit them, but never publish anything copied from them. */
export const SOCIAL = /^https:\/\/(www\.)?(instagram\.com|linkedin\.com|tiktok\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|threads\.(net|com))\//i;
export const SOCIAL_SQL = `'(instagram\\.com|tiktok\\.com|youtube\\.com|youtu\\.be|x\\.com|twitter\\.com|threads\\.(net|com)|linkedin\\.com)'`;

export const PLATFORM: [RegExp, string][] = [
  [/instagram\.com/i, "Instagram"],
  [/linkedin\.com/i, "LinkedIn"],
  [/tiktok\.com/i, "TikTok"],
  [/(youtube\.com|youtu\.be)/i, "YouTube"],
  [/(x\.com|twitter\.com)/i, "X"],
  [/threads\./i, "Threads"],
];

/** The workspace the open catalogue shows: PUBLIC_WORKSPACE_ID, else the first one. As SQL, so it costs no extra query. */
export const PUBLIC_WS_SQL = `coalesce(nullif($1, '')::uuid, (select id from workspaces order by created_at limit 1))`;
export const publicWsParam = () => process.env.PUBLIC_WORKSPACE_ID ?? "";
