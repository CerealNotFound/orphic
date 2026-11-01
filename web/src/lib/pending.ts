import { q } from "./db";

/**
 * Stops waiting on a creator's DM (their comment automation is broken or never replied).
 * Closes every open "comment for link" task for the item and marks its link as unavailable.
 * The item stays searchable; if the link turns up later, forwarding it still upgrades the item.
 */
export async function closeDmWait(workspaceId: string, entityId: string): Promise<{ name: string } | null> {
  const rows = await q<{ name: string }>(
    `update entities set link_status = 'unavailable', updated_at = now()
     where id = $1 and workspace_id = $2 and link_status in ('pending_dm', 'none') returning name`,
    [entityId, workspaceId],
  );
  await q(`update tasks set status = 'dismissed', done_at = now() where entity_id = $1 and workspace_id = $2 and status = 'open'`, [entityId, workspaceId]);
  return rows[0] ?? null;
}
