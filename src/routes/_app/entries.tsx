import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";

export const Route = createFileRoute("/_app/entries")({
  component: EntriesPage,
});

interface Entry {
  id: string;
  entry_date: string;
  system: number;
  online: number;
  number: number;
  bonus: number;
  win: number;
  cash: number;
  note: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  entry_date: today(),
  system: "",
  online: "",
  number: "",
  bonus: "",
  win: "",
  cash: "",
  note: "",
});

function EntriesPage() {
  const { user, profile, role, loading } = useAuth();
  const nav = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ReturnType<typeof emptyForm>>(emptyForm());

  useEffect(() => {
    if (!loading && role && role !== "user") nav({ to: "/dashboard" });
  }, [loading, role, nav]);

  const load = async () => {
    const { data } = await supabase
      .from("entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    setEntries((data ?? []) as Entry[]);
  };
  useEffect(() => {
    if (user) load();
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const num = (v: string) => (v === "" ? 0 : Number(v));
    const { error } = await supabase.from("entries").insert({
      user_id: user.id,
      entry_date: form.entry_date,
      system: num(form.system),
      online: num(form.online),
      number: num(form.number),
      bonus: num(form.bonus),
      win: num(form.win),
      cash: num(form.cash),
      note: form.note || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Entry saved");
    setForm(emptyForm());
    load();
  };

  const startEdit = (e: Entry) => {
    setEditingId(e.id);
    setEditForm({
      entry_date: e.entry_date,
      system: String(e.system),
      online: String(e.online),
      number: String(e.number),
      bonus: String(e.bonus),
      win: String(e.win),
      cash: String(e.cash),
      note: e.note ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const num = (v: string) => (v === "" ? 0 : Number(v));
    const { error } = await supabase
      .from("entries")
      .update({
        entry_date: editForm.entry_date,
        system: num(editForm.system),
        online: num(editForm.online),
        number: num(editForm.number),
        bonus: num(editForm.bonus),
        win: num(editForm.win),
        cash: num(editForm.cash),
        note: editForm.note || null,
      })
      .eq("id", editingId);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setEditingId(null);
    load();
  };

  const canEdit = profile?.can_edit === true;

  return (
    <div className="space-y-6">
      <Card className="card-elev">
        <CardHeader>
          <CardTitle>New entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Date" type="date" value={form.entry_date} onChange={(v) => setForm({ ...form, entry_date: v })} required />
            <Field label="System" type="number" value={form.system} onChange={(v) => setForm({ ...form, system: v })} />
            <Field label="Online" type="number" value={form.online} onChange={(v) => setForm({ ...form, online: v })} />
            <Field label="Number" type="number" value={form.number} onChange={(v) => setForm({ ...form, number: v })} placeholder="0" />
            <Field label="Bonus" type="number" value={form.bonus} onChange={(v) => setForm({ ...form, bonus: v })} />
            <Field label="Win" type="number" value={form.win} onChange={(v) => setForm({ ...form, win: v })} />
            <Field label="Cash" type="number" value={form.cash} onChange={(v) => setForm({ ...form, cash: v })} />
            <div className="col-span-2 md:col-span-4">
              <Label>Note (optional)</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="mt-1.5"
                rows={2}
              />
            </div>
            <div className="col-span-2 md:col-span-4">
              <Button type="submit" disabled={busy} className="gradient-emerald">
                {busy ? "Saving…" : "Submit entry"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="card-elev">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>History ({entries.length})</CardTitle>
            <span className={`text-xs ${canEdit ? "text-gold" : "text-muted-foreground"}`}>
              {canEdit ? "Editing enabled by admin" : "Editing locked"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Online</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Bonus</TableHead>
                <TableHead>Win</TableHead>
                <TableHead>Cash</TableHead>
                <TableHead>Note</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) =>
                editingId === e.id ? (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Input type="date" value={editForm.entry_date} onChange={(ev) => setEditForm({ ...editForm, entry_date: ev.target.value })} />
                    </TableCell>
                    {(["system", "online", "number", "bonus", "win", "cash"] as const).map((k) => (
                      <TableCell key={k}>
                        <Input
                          type="number"
                          value={editForm[k]}
                          onChange={(ev) => setEditForm({ ...editForm, [k]: ev.target.value })}
                          className="w-20"
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Input value={editForm.note} onChange={(ev) => setEditForm({ ...editForm, note: ev.target.value })} />
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={saveEdit}><Save className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={e.id}>
                    <TableCell>{e.entry_date}</TableCell>
                    <TableCell>{e.system}</TableCell>
                    <TableCell>{e.online}</TableCell>
                    <TableCell>{e.number}</TableCell>
                    <TableCell>{e.bonus}</TableCell>
                    <TableCell className="text-gold font-medium">{e.win}</TableCell>
                    <TableCell className="font-medium">{e.cash}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{e.note}</TableCell>
                    <TableCell>
                      {canEdit && (
                        <Button size="icon" variant="ghost" onClick={() => startEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              )}
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No entries yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        step="any"
        className="mt-1.5"
      />
    </div>
  );
}
