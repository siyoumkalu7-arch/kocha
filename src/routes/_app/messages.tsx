import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, MailOpen } from "lucide-react";

export const Route = createFileRoute("/_app/messages")({
  component: MessagesPage,
});

interface Message {
  id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
  sender_name?: string;
}

function MessagesPage() {
  const { role, user, loading } = useAuth();
  const nav = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && role !== "admin" && role !== "super_admin") {
      nav({ to: "/app/dashboard" });
    }
  }, [role, loading, nav]);

  const load = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
    const msgs = (data ?? []) as Message[];
    // resolve sender usernames
    const ids = [...new Set(msgs.map((m) => m.sender_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      const map = new Map((profs ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));
      msgs.forEach((m) => (m.sender_name = map.get(m.sender_id)));
    }
    setMessages(msgs);
  };

  useEffect(() => {
    if (!role) return;
    load();
    // Realtime: super admin gets notified
    if (role === "super_admin") {
      const ch = supabase
        .channel("messages_inbox")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            toast.info(`New message from admin`, { description: (payload.new as Message).body.slice(0, 60) });
            load();
          },
        )
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [role]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({ sender_id: user.id, body: body.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Message sent");
    setBody("");
    load();
  };

  const markRead = async (id: string) => {
    const { error } = await supabase.from("messages").update({ read: true }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      {role === "admin" && (
        <Card className="card-elev">
          <CardHeader><CardTitle>Message Super Admin</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={send} className="space-y-3">
              <Textarea
                placeholder="Type your message…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                required
                maxLength={2000}
              />
              <Button disabled={busy || !body.trim()} className="gradient-emerald">
                {busy ? "Sending…" : "Send"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="card-elev">
        <CardHeader>
          <CardTitle>{role === "super_admin" ? "Inbox" : "Your sent messages"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-sm">No messages yet.</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-4 rounded-lg border ${
                role === "super_admin" && !m.read
                  ? "border-gold/50 bg-gold/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {role === "super_admin" ? (
                      m.read ? <MailOpen className="h-3 w-3" /> : <Mail className="h-3 w-3 text-gold" />
                    ) : null}
                    <span className="font-medium text-foreground">
                      {m.sender_name ?? m.sender_id.slice(0, 8)}
                    </span>
                    <span>· {new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{m.body}</p>
                </div>
                {role === "super_admin" && !m.read && (
                  <Button size="sm" variant="outline" onClick={() => markRead(m.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
