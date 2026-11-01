import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiKeyForm } from "@/components/api-key-form";
import { CodeBlock } from "@/components/copy-button";
import { Card, ListSkeleton, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { env } from "@/lib/env";
import { currentMember, myApiKeys } from "@/lib/ui-data";
import { RevokeKeyButton } from "@/components/revoke-key-button";
import { fullDate, timeAgo } from "@/lib/ui-format";

export const metadata: Metadata = { title: "Connect AI tools" };

const KEY = "<your-key>";

export default function ConnectAiPage() {
  return (
    <>
      <PageHeader
        title="Use Orphic from your AI tools"
        description="Ask Claude, Cursor or Gemini things like “what did we save for video ads?” and they search the team's Orphic directly."
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <ListSkeleton rows={2} />
          </div>
        }
      >
        <ConnectAi />
      </Suspense>
    </>
  );
}

async function ConnectAi() {
  const { member, now } = await currentMember();
  const keys = await myApiKeys(member.id);
  const app = env.APP_URL;
  const mcpUrl = `${app}/api/mcp`;

  const cursor = JSON.stringify({ mcpServers: { orphic: { url: mcpUrl, headers: { Authorization: `Bearer ${KEY}` } } } }, null, 2);
  const gemini = JSON.stringify({ mcpServers: { orphic: { httpUrl: mcpUrl, headers: { Authorization: `Bearer ${KEY}` } } } }, null, 2);

  return (
    <div className="space-y-10">
      <section aria-labelledby="step1">
        <SectionTitle>
          <span id="step1">1 · Create your API key</span>
        </SectionTitle>
        <Card className="p-5">
          <p className="mb-4 text-sm text-subtle">
            The key acts as you ({member.display_name}): it can search everything the team saved and add saves. Keep it private, like a password.
          </p>
          <ApiKeyForm mcpUrl={mcpUrl} />
          {keys.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-xs font-medium text-subtle">Your active keys</p>
              <ul className="space-y-1.5">
                {keys.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                    <span className="text-ink">{k.name}</span>
                    <code className="font-mono text-xs text-subtle">{k.prefix}…</code>
                    <span className="ml-auto text-xs text-subtle">
                      created <time title={fullDate(k.created_at)}>{timeAgo(k.created_at, now)}</time>
                      {" · "}
                      {k.last_used_at ? <>used {timeAgo(k.last_used_at, now)}</> : "never used"}
                    </span>
                    <RevokeKeyButton keyId={k.id} name={k.name} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </section>

      <section aria-labelledby="step2" className="space-y-6">
        <SectionTitle>
          <span id="step2">2 · Add Orphic to your tool</span>
        </SectionTitle>
        <p className="-mt-3 text-sm text-subtle">
          Replace <code className="rounded bg-sunken px-1 font-mono text-ink">{KEY}</code> with your key. The Orphic MCP server lives at{" "}
          <code className="rounded bg-sunken px-1 font-mono text-ink">{mcpUrl}</code>.
        </p>

        <Snippet title="Claude Code" hint="Run once in your terminal.">
          <CodeBlock title="Terminal" code={`claude mcp add --transport http orphic ${mcpUrl} --header "Authorization: Bearer ${KEY}"`} />
        </Snippet>

        <Snippet title="Cursor" hint="Add to ~/.cursor/mcp.json (or .cursor/mcp.json in a project), then reload Cursor.">
          <CodeBlock title="~/.cursor/mcp.json" code={cursor} />
        </Snippet>

        <Snippet title="Gemini CLI" hint="Add to ~/.gemini/settings.json, then restart gemini.">
          <CodeBlock title="~/.gemini/settings.json" code={gemini} />
        </Snippet>

        <Snippet title="REST API" hint="For scripts and anything else. Results are paginated: check total and next_offset.">
          <div className="space-y-3">
            <CodeBlock title="Ranked search" code={`curl -H "Authorization: Bearer ${KEY}" \\\n  "${app}/api/v1/search?q=video+ads&limit=10"`} />
            <CodeBlock
              title="Everything, with filters (exhaustive)"
              code={`curl -H "Authorization: Bearer ${KEY}" \\\n  "${app}/api/v1/items?category=ai-video&limit=25&offset=0"`}
            />
          </div>
        </Snippet>

        <Card className="flex items-start gap-3 border-dashed p-4">
          <span aria-hidden="true" className="text-xl">
            🔜
          </span>
          <div className="text-sm">
            <p className="font-medium text-ink">Claude.ai, Claude mobile and ChatGPT connectors: coming soon</p>
            <p className="mt-0.5 text-subtle">These will connect with Google sign-in instead of a key, so there&apos;s nothing to paste.</p>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Snippet({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mb-2 text-sm text-subtle">{hint}</p>
      {children}
    </div>
  );
}
