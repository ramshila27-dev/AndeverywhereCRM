"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ALL_ROLES,
  ROLE_LABELS,
  ROLE_PRESETS,
  GRANTABLE_FEATURES,
  permissionsForRoles,
} from "@/lib/permissions";
import type { Role, UserStatus } from "@prisma/client";

interface ExistingUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: Role[];
  permissions: string[];
  status: UserStatus;
}

export default function UserForm({ user }: { user?: ExistingUser }) {
  const router = useRouter();
  const editing = !!user;

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Role[]>(user?.roles ?? ["SALES_PERSON"]);
  const [permissions, setPermissions] = useState<string[]>(
    user?.permissions ?? permissionsForRoles(["SALES_PERSON"]),
  );
  const [status, setStatus] = useState<UserStatus>(user?.status ?? "PENDING");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdminSelected = roles.includes("ADMIN");

  // When roles change, re-seed permissions from the combined presets (admin can
  // still tweak individual boxes afterwards).
  function toggleRole(r: Role) {
    setRoles((prev) => {
      const next = prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r];
      const seeded = permissionsForRoles(next.length ? next : ["SALES_PERSON"]);
      setPermissions(seeded);
      return next;
    });
  }

  function togglePermission(key: string) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const effectivePermissions = useMemo(
    () => (isAdminSelected ? GRANTABLE_FEATURES.map((f) => f.key) : permissions),
    [isAdminSelected, permissions],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (roles.length === 0) {
      setError("Select at least one role.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name,
        phone,
        roles,
        permissions: effectivePermissions,
      };
      if (!editing) {
        payload.email = email;
        payload.password = password;
      } else {
        payload.status = status;
        if (password) payload.password = password;
      }

      const res = await fetch(
        editing ? `/api/admin/users/${user!.id}` : "/api/admin/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save user.");
      router.push("/admin/users");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save user.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirm(`Delete ${user!.name}? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user!.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete user.");
      router.push("/admin/users");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete user.");
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Profile */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Profile
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Full name *
            </label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email *
            </label>
            <input
              type="email"
              required
              disabled={editing}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${field} ${editing ? "bg-slate-50 text-slate-500" : ""}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Phone
            </label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {editing ? "Reset password" : "Initial password *"}
            </label>
            <input
              type="text"
              required={!editing}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editing ? "Leave blank to keep current" : "Min 8 characters"}
              className={field}
            />
            <p className="mt-1 text-xs text-slate-400">
              The employee is asked to change this on first sign-in.
            </p>
          </div>
        </div>
        {editing && (
          <div className="mt-4 max-w-xs">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatus)}
              className={field}
            >
              <option value="PENDING">Pending</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        )}
      </section>

      {/* Roles */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Roles
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Roles seed the default feature access below. You can fine-tune access
          afterwards.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ALL_ROLES.map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                roles.includes(r)
                  ? "border-brand-400 bg-brand-50/60"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="checkbox"
                checked={roles.includes(r)}
                onChange={() => toggleRole(r)}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {ROLE_LABELS[r]}
                </div>
                <div className="text-xs text-slate-500">
                  {r === "ADMIN"
                    ? "Full access to everything, including user management."
                    : `Grants: ${ROLE_PRESETS[r]
                        .map(
                          (k) =>
                            GRANTABLE_FEATURES.find((f) => f.key === k)?.label ?? k,
                        )
                        .filter(Boolean)
                        .join(", ")}`}
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Feature access */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Feature access
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Choose which sections this employee can see and use.
        </p>
        {isAdminSelected && (
          <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
            Admins have full access to every feature — individual toggles are
            managed automatically.
          </p>
        )}
        <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${isAdminSelected ? "pointer-events-none opacity-50" : ""}`}>
          {GRANTABLE_FEATURES.map((f) => {
            const checked = effectivePermissions.includes(f.key);
            return (
              <label
                key={f.key}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                  checked ? "border-brand-400 bg-brand-50/60" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePermission(f.key)}
                  disabled={isAdminSelected}
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-800">{f.label}</div>
                  <div className="text-xs text-slate-500">{f.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Create user"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/users")}
            className="text-sm text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
        {editing && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-60"
          >
            Delete user
          </button>
        )}
      </div>
    </form>
  );
}
