import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Wallet, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

interface Stats {
  entryCount: number;
  totalCash: number;
  totalWin: number;
  userCount?: number;
}

function Dashboard() {
  const { role, profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!role) return;
    (async () => {
      // entries visible to caller via RLS
      const { data: entries } = await supabase
        .from("entries")
        .select("cash, win");
      const totalCash = (entries ?? []).reduce(
        (a, r: { cash: number | string }) => a + Number(r.cash || 0),
        0,
      );
      const totalWin = (entries ?? []).reduce(
        (a, r: { win: number | string }) => a + Number(r.win || 0),
        0,
      );

      let userCount: number | undefined;
      if (role !== "user") {
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });
        userCount = count ?? 0;
      }

      setStats({ entryCount: entries?.length ?? 0, totalCash, totalWin, userCount });
    })();
  }, [role]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, <span className="text-gold">{profile?.username}</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          {role === "super_admin" && "You have full access to all data."}
          {role === "admin" && "Managing your users and their submissions."}
          {role === "user" && "Submit new entries and view your history."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Total Entries"
          value={stats?.entryCount ?? "—"}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total Cash"
          value={stats ? stats.totalCash.toLocaleString() : "—"}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Total Win"
          value={stats ? stats.totalWin.toLocaleString() : "—"}
        />
        {role !== "user" && (
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label={role === "super_admin" ? "All Accounts" : "My Users"}
            value={stats?.userCount ?? "—"}
          />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {role === "user" && (
          <QuickLink to="/entries" title="Submit new entry" desc="Add today's numbers" />
        )}
        {role !== "user" && (
          <QuickLink to="/users" title="Manage users" desc="Create, delete, reset" />
        )}
        {role !== "user" && (
          <QuickLink to="/messages" title="Messages" desc={role === "super_admin" ? "Read inbox" : "Message super admin"} />
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="card-elev">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <span className="text-gold">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="card-elev p-5 hover:ring-gold transition-shadow block"
    >
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{desc}</div>
    </Link>
  );
}
