import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Users, MessageSquare, Zap, TrendingUp, Pin, Megaphone } from "lucide-react";
import { PEOPLE, POSTS, tribeById } from "@/lib/mutuals-data";

export const Route = createFileRoute("/host-dashboard")({
  head: () => ({
    meta: [
      { title: "Host Dashboard — MUTUALS" },
      { name: "description", content: "Manage your Hosted Tribe: members, posts, ventures, and announcements." },
    ],
  }),
  component: HostDashboard,
});

type Tab = "overview" | "members" | "posts" | "ventures" | "announcements";

function HostDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const tribe = tribeById("bee"); // hosted demo tribe
  const members = PEOPLE.filter((p) => p.tribeId === "bee");
  const tribePosts = POSTS.filter((p) => p.tribeId === "bee");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to app
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tribe.emoji}</span>
            <div className="leading-tight">
              <p className="font-display text-sm font-bold">{tribe.name}</p>
              <p className="label-mono text-muted-foreground">{tribe.hostOrg}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-5 py-6 md:grid-cols-[180px_1fr]">
        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
          {([
            ["overview", "Overview"],
            ["members", "Members"],
            ["posts", "Posts"],
            ["ventures", "Ventures"],
            ["announcements", "Announcements"],
          ] as [Tab, string][]).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`shrink-0 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
                tab === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {l}
            </button>
          ))}
        </nav>

        <main>
          {tab === "overview" && <Overview members={members.length} posts={tribePosts.length} />}
          {tab === "members" && <Members members={members} />}
          {tab === "posts" && <Posts posts={tribePosts} />}
          {tab === "ventures" && <Ventures />}
          {tab === "announcements" && <Announcements />}
        </main>
      </div>
    </div>
  );
}

function Overview({ members, posts }: { members: number; posts: number }) {
  const stats = [
    { icon: Users, label: "Members", value: "11,230" },
    { icon: MessageSquare, label: "Posts this week", value: String(posts * 6) },
    { icon: Zap, label: "Active Ventures", value: "27" },
    { icon: TrendingUp, label: "New (30d)", value: "+412" },
  ];
  const weeks = [320, 410, 380, 470, 540, 612, 700, 812];
  const max = Math.max(...weeks);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary"><s.icon className="h-4 w-4" /></span>
            <p className="mt-3 font-display text-2xl font-bold">{s.value}</p>
            <p className="label-mono text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="font-display text-base font-bold">Member growth · last 8 weeks</p>
        <div className="mt-4 flex h-32 items-end gap-2">
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t-md bg-primary/70" style={{ height: `${(w / max) * 100}%` }} />
              <span className="label-mono text-muted-foreground">W{i + 1}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Members({ members }: { members: typeof PEOPLE }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Joined</th></tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3"><span className="mr-2">{m.avatar}</span>{m.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{m.city}</td>
              <td className="px-4 py-3 text-muted-foreground">Mar 2026</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Posts({ posts }: { posts: typeof POSTS }) {
  return (
    <div className="space-y-3">
      {posts.length === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No posts yet in this Tribe.</p>}
      {posts.map((p) => (
        <article key={p.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm">{p.content}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{p.likes} likes · {p.replies} replies · {p.time} ago</p>
          </div>
          <button className="flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"><Pin className="h-3 w-3" /> Pin</button>
        </article>
      ))}
    </div>
  );
}

function Ventures() {
  const rows = [
    { user: "Priya Shah", intents: "Coffee, Co-working", window: "Thu 8–10am", status: "Live" },
    { user: "Rae Owens", intents: "Drinks", window: "Fri eve", status: "Live" },
    { user: "Tom Vega", intents: "Co-working", window: "Tue all-day", status: "Ended" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Intents</th><th className="px-4 py-3">Window</th><th className="px-4 py-3">Status</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3">{r.user}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.intents}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.window}</td>
              <td className="px-4 py-3">
                <span className={`label-mono rounded-full px-2 py-0.5 ${r.status === "Live" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  {r.status.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Announcements() {
  const [text, setText] = useState("");
  const [posted, setPosted] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <p className="font-display text-base font-bold">New announcement</p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pin a message to the top of the Tribe feed."
          rows={4}
          className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          onClick={() => { if (text.trim()) { setPosted(text.trim()); setText(""); } }}
          disabled={!text.trim()}
          className="mt-3 rounded-2xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          Post Announcement
        </button>
      </div>

      {posted && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <p className="label-mono text-primary">[ HOSTED ANNOUNCEMENT · PINNED ]</p>
          <p className="mt-2 text-sm">{posted}</p>
        </div>
      )}
    </div>
  );
}
