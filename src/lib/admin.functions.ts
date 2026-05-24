import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const usernameToEmail = (u: string) =>
  `${u.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")}@bet.local`;

async function getCallerRole(userId: string): Promise<"super_admin" | "admin" | "user" | null> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("user")) return "user";
  return null;
}

async function listExistingAuthUserIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(error.message);

    data.users.forEach((user) => ids.add(user.id));
    if (data.users.length < 1000) break;
    page += 1;
  }

  return ids;
}

/* ============ SETUP STATUS ============ */
export const superAdminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "super_admin");
  return { exists: (count ?? 0) > 0 };
});

/* ============ BOOTSTRAP ============ */
/** Create the first super admin. Only works if NO super_admin exists. Public on purpose. */
export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string }) =>
    z
      .object({
        username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
        password: z.string().min(6).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");
    if ((count ?? 0) > 0) throw new Error("Super admin already exists");

    const email = usernameToEmail(data.username);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    await supabaseAdmin.from("profiles").insert({ id: uid, username: data.username });
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "super_admin" });
    return { ok: true };
  });

/* ============ CREATE USER / ADMIN ============ */
export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string; password: string; role: "admin" | "user" }) =>
    z
      .object({
        username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
        password: z.string().min(6).max(100),
        role: z.enum(["admin", "user"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const caller = await getCallerRole(context.userId);
    if (caller === "super_admin") {
      // can create both
    } else if (caller === "admin") {
      if (data.role !== "user") throw new Error("Admins can only create users");
    } else {
      throw new Error("Forbidden");
    }

    const email = usernameToEmail(data.username);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    // For users, parent_admin_id = caller (whoever created them). Admins have null parent.
    const parent_admin_id = data.role === "user" ? context.userId : null;
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .insert({ id: uid, username: data.username, parent_admin_id });
    if (pErr) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error(pErr.message);
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    return { ok: true, id: uid };
  });

/* ============ DELETE USER ============ */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");
    const caller = await getCallerRole(context.userId);
    if (caller !== "super_admin" && caller !== "admin") throw new Error("Forbidden");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("parent_admin_id")
      .eq("id", data.userId)
      .single();

    if (caller === "admin" && target?.parent_admin_id !== context.userId) {
      throw new Error("Can only delete users you created");
    }

    // Clean up app data first (no FK cascade from auth.users)
    const cleanup = await Promise.all([
      supabaseAdmin.from("entries").delete().eq("user_id", data.userId),
      supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId),
      supabaseAdmin.from("profiles").delete().eq("id", data.userId),
    ]);
    const cleanupError = cleanup.find((result) => result.error)?.error;
    if (cleanupError) throw new Error(cleanupError.message);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    const authDeleteStatus = (error as { status?: number } | null)?.status;
    if (error && authDeleteStatus !== 404 && !error.message.toLowerCase().includes("not found")) {
      throw new Error(error.message);
    }
    return { ok: true };
  });

/* ============ RESET PASSWORD ============ */
export const resetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; newPassword: string }) =>
    z
      .object({ userId: z.string().uuid(), newPassword: z.string().min(6).max(100) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const caller = await getCallerRole(context.userId);
    if (caller === "super_admin") {
      // ok
    } else if (caller === "admin") {
      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("parent_admin_id")
        .eq("id", data.userId)
        .single();
      if (target?.parent_admin_id !== context.userId) throw new Error("Forbidden");
    } else {
      throw new Error("Forbidden");
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ LIST ACCOUNTS (with role) ============ */
export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const caller = await getCallerRole(context.userId);
    if (caller !== "super_admin" && caller !== "admin") throw new Error("Forbidden");

    let q = supabaseAdmin
      .from("profiles")
      .select("id, username, parent_admin_id, can_edit, created_at")
      .order("created_at", { ascending: false });

    if (caller === "admin") {
      q = q.eq("parent_admin_id", context.userId);
    }
    const { data: profiles, error } = await q;
    if (error) throw new Error(error.message);

    const [authUserIds, { data: roles }] = await Promise.all([
      listExistingAuthUserIds(),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string>();
    (roles ?? []).forEach((r: { user_id: string; role: string }) =>
      roleMap.set(r.user_id, r.role),
    );

    return (profiles ?? []).filter((p) => authUserIds.has(p.id)).map((p) => ({
      ...p,
      role: (roleMap.get(p.id) ?? "user") as "super_admin" | "admin" | "user",
    }));
  });
