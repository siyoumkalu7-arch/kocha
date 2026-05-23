import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  resetPassword,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, KeyRound, Eye } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

interface Account {
  id: string;
  username: string;
  parent_admin_id: string | null;
  can_edit: boolean;
  created_at: string;
  role: "super_admin" | "admin" | "user";
}

interface Entry {
  id: string;
  user_id: string;
  entry_date: string;
  system: number; online: number; number: number;
  bonus: number; win: number; cash: number;
  note: string | null;
}

function UsersPage() {
  const { role, loading } = useAuth();
  const nav = useNavigate();
  const list = useServerFn(listAccounts);
  const create = useServerFn(createAccount);
  const del = useServerFn(deleteAccount);
  const reset = useServerFn(resetPassword);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && role && role !== "admin" && role !== "super_admin") {
      nav({ to: "/dashboard" });
    }
  }, [role, loading, nav]);

  const refresh = async () => {
    try {
      const r = await list();
      setAccounts(r as Account[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    }
  };
  useEffect(() => {
    if (role) refresh();
  }, [role]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { username: newUsername, password: newPassword, role: newRole } });
      toast.success(`${newRole === "admin" ? "Admin" : "User"} created`);
      setNewUsername("");
      setNewPassword("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this account permanently?")) return;
    try {
      await del({ data: { userId: id } });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const onResetPassword = async (id: string) => {
    const pw = prompt("New password (min 6 chars):");
    if (!pw || pw.length < 6) return;
    try {
      await reset({ data: { userId: id, newPassword: pw } });
      toast.success("Password reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const onToggleEdit = async (a: Account, value: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ can_edit: value })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success(value ? "Editing enabled" : "Editing locked");
    refresh();
  };

  const filtered = useMemo(
    () =>
      accounts.filter((a) =>
        a.username.toLowerCase().includes(search.toLowerCase()),
      ),
    [accounts, search],
  );

  return (
    <div className="space-y-6">
      <Card className="card-elev">
        <CardHeader><CardTitle>Create account</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label>Username</Label>
              <Input required minLength={3} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Password</Label>
              <Input required minLength={6} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  {role === "super_admin" && <SelectItem value="admin">Admin</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <Button disabled={busy} className="gradient-emerald">{busy ? "Creating…" : "Create"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="card-elev">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Accounts ({filtered.length})</CardTitle>
            <Input
              placeholder="Search username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Can edit</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.username}</TableCell>
                  <TableCell>
                    <span className={
                      a.role === "super_admin" ? "text-gold" :
                      a.role === "admin" ? "text-primary" : "text-muted-foreground"
                    }>{a.role.replace("_", " ")}</span>
                  </TableCell>
                  <TableCell>
                    {a.role === "user" ? (
                      <Switch
                        checked={a.can_edit}
                        onCheckedChange={(v) => onToggleEdit(a, v)}
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="flex gap-1 justify-end">
                    {a.role === "user" && <ViewEntriesDialog account={a} />}
                    <Button size="icon" variant="ghost" onClick={() => onResetPassword(a.id)} title="Reset password">
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(a.id)} title="Delete" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No accounts.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ViewEntriesDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    let q = supabase.from("entries").select("*").eq("user_id", account.id).order("entry_date", { ascending: false });
    if (from) q = q.gte("entry_date", from);
    if (to) q = q.lte("entry_date", to);
    const { data } = await q;
    setEntries((data ?? []) as Entry[]);
  };
  useEffect(() => { if (open) load(); }, [open, from, to]);

  const total = (k: keyof Entry) => entries.reduce((a, e) => a + Number(e[k] || 0), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" title="View entries"><Eye className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{account.username} — entries</DialogTitle>
        </DialogHeader>
        <div className="flex gap-3 items-end">
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1.5" /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1.5" /></div>
          <Button variant="outline" onClick={() => { setFrom(""); setTo(""); }}>Clear</Button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="card-elev p-3"><div className="text-muted-foreground text-xs">Entries</div><div className="text-xl font-semibold">{entries.length}</div></div>
          <div className="card-elev p-3"><div className="text-muted-foreground text-xs">Total Cash</div><div className="text-xl font-semibold">{total("cash").toLocaleString()}</div></div>
          <div className="card-elev p-3"><div className="text-muted-foreground text-xs">Total Win</div><div className="text-xl font-semibold text-gold">{total("win").toLocaleString()}</div></div>
        </div>
        <div className="overflow-x-auto max-h-96">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Sys</TableHead><TableHead>Online</TableHead>
                <TableHead>Num</TableHead><TableHead>Bonus</TableHead><TableHead>Win</TableHead>
                <TableHead>Cash</TableHead><TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.entry_date}</TableCell>
                  <TableCell>{e.system}</TableCell><TableCell>{e.online}</TableCell>
                  <TableCell>{e.number}</TableCell><TableCell>{e.bonus}</TableCell>
                  <TableCell className="text-gold">{e.win}</TableCell>
                  <TableCell>{e.cash}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">{e.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
