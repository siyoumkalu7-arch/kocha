import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/app/dashboard" });
  }, [session, loading, navigate]);

  // Detect if there's any super_admin yet (so we can prompt /setup)
  useEffect(() => {
    supabase
      .from("user_roles")
      .select("role", { head: true, count: "exact" })
      .eq("role", "super_admin")
      .then(({ count, error }) => {
        if (!error && (count ?? 0) === 0) setNeedsSetup(true);
      });
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(username, password);
      toast.success("Welcome back");
      navigate({ to: "/app/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      toast.error(msg.includes("Invalid") ? "Invalid username or password" : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md card-elev p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl gradient-emerald grid place-items-center text-white font-bold text-xl shadow-lg">
            ₿
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your dashboard</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="u">Username</Label>
            <Input
              id="u"
              autoComplete="username"
              required
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full gradient-emerald">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {needsSetup && (
          <div className="mt-6 p-3 rounded-md border border-gold/40 bg-gold/5 text-sm">
            <p className="text-gold font-medium mb-1">First-time setup</p>
            <p className="text-muted-foreground">
              No super admin exists yet.{" "}
              <Link to="/setup" className="text-gold underline">
                Create one →
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
