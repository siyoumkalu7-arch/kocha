import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapSuperAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

function SetupPage() {
  const bootstrap = useServerFn(bootstrapSuperAdmin);
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await bootstrap({ data: { username, password } });
      toast.success("Super admin created. You can sign in now.");
      nav({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md card-elev p-8">
        <h1 className="text-2xl font-semibold">First-time setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create the initial <span className="text-gold">Super Admin</span> account.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="u">Username</Label>
            <Input
              id="u"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="p">Password</Label>
            <Input
              id="p"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button disabled={busy} className="w-full gradient-emerald">
            {busy ? "Creating…" : "Create Super Admin"}
          </Button>
        </form>
      </div>
    </div>
  );
}
