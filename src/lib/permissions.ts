// Feature-level access control.
//
// Every gated section of the app is a "feature" with a stable key. A user's
// `permissions` array holds the keys they may access. Admins implicitly hold
// every key (see `can`).
//
// Roles are presets: selecting roles for a user seeds a default permission set,
// which the admin can then fine-tune per user.

import type { Role } from "@prisma/client";

export type FeatureKey =
  | "queries"
  | "quotes"
  | "itineraries"
  | "rates"
  | "reports"
  | "users"
  | "settings";

export interface Feature {
  key: FeatureKey;
  label: string;
  description: string;
  href: string;
  adminOnly?: boolean;
}

// Order here drives the nav order and the permission checkbox order.
export const FEATURES: Feature[] = [
  {
    key: "queries",
    label: "Queries",
    description: "View and work the travel enquiries assigned to them.",
    href: "/queries",
  },
  {
    key: "quotes",
    label: "Quotes",
    description: "Build and manage client quotations.",
    href: "/quotes",
  },
  {
    key: "itineraries",
    label: "Itineraries",
    description: "Create AI day-by-day itineraries.",
    href: "/",
  },
  {
    key: "rates",
    label: "Rates & Inventory",
    description: "View the contracted rate catalog and upload prices / images.",
    href: "/catalog",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Sales, team and destination performance reports.",
    href: "/reports",
  },
  {
    key: "users",
    label: "User Management",
    description: "Add employees, assign roles and set access rights.",
    href: "/admin/users",
    adminOnly: true,
  },
  {
    key: "settings",
    label: "Settings",
    description: "Company profile, bank details and preferences.",
    href: "/admin/settings",
    adminOnly: true,
  },
];

export const ALL_FEATURE_KEYS = FEATURES.map((f) => f.key);

// Features an employee can be granted (admin-only ones are excluded from the
// per-user grant list — they come with the ADMIN role).
export const GRANTABLE_FEATURES = FEATURES.filter((f) => !f.adminOnly);

// Default feature set seeded when a given role is assigned.
export const ROLE_PRESETS: Record<Role, FeatureKey[]> = {
  ADMIN: [...ALL_FEATURE_KEYS],
  SALES_PERSON: ["queries", "quotes", "itineraries"],
  RESERVATION: ["queries", "quotes", "rates"],
  OPERATION: ["queries", "itineraries"],
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  SALES_PERSON: "Sales Person",
  RESERVATION: "Reservation",
  OPERATION: "Operation",
};

export const ALL_ROLES: Role[] = [
  "ADMIN",
  "SALES_PERSON",
  "RESERVATION",
  "OPERATION",
];

// Union of the presets for the given roles — used to seed a new user's grants.
export function permissionsForRoles(roles: Role[]): FeatureKey[] {
  const set = new Set<FeatureKey>();
  for (const r of roles) for (const k of ROLE_PRESETS[r] ?? []) set.add(k);
  return ALL_FEATURE_KEYS.filter((k) => set.has(k));
}

export function isAdmin(roles: Role[] | undefined | null): boolean {
  return !!roles?.includes("ADMIN");
}

// Central access check. Admins can do everything; everyone else needs the key.
export function can(
  user: { roles: Role[]; permissions: string[] } | null | undefined,
  key: FeatureKey,
): boolean {
  if (!user) return false;
  if (isAdmin(user.roles)) return true;
  const feature = FEATURES.find((f) => f.key === key);
  if (feature?.adminOnly) return false;
  return user.permissions.includes(key);
}
