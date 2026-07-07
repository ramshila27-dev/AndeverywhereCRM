// Seed a handful of demo employees so the Users list is populated.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PRESETS = {
  ADMIN: ["queries", "quotes", "itineraries", "rates", "reports", "users", "settings"],
  SALES_PERSON: ["queries", "quotes", "itineraries"],
  RESERVATION: ["queries", "quotes", "rates"],
  OPERATION: ["queries", "itineraries"],
};
function permsFor(roles) {
  const s = new Set();
  for (const r of roles) for (const k of PRESETS[r]) s.add(k);
  return [...s];
}

const now = new Date("2026-07-01T09:00:00Z");
const demo = [
  { name: "Gaurav Sharma", email: "gaurav@andeverywhere.co", roles: ["ADMIN"], status: "ACTIVE", last: 26 * 60000 },
  { name: "Charu Sharma", email: "charu@andeverywhere.co", roles: ["SALES_PERSON", "RESERVATION", "OPERATION"], status: "ACTIVE", last: 19 * 3600000 },
  { name: "Yash Saini", email: "ops2.kz@andeverywhere.co", roles: ["SALES_PERSON", "RESERVATION", "OPERATION"], status: "ACTIVE", last: 24 * 3600000 },
  { name: "Amrit Prakash Rai", email: "ops3@andeverywhere.co", roles: ["SALES_PERSON", "RESERVATION", "OPERATION"], status: "ACTIVE", last: 26 * 3600000 },
  { name: "Post Operation Team", email: "dubai.ops@andeverywhere.co", roles: ["SALES_PERSON", "RESERVATION", "OPERATION"], status: "ACTIVE", last: 6 * 24 * 3600000 },
  { name: "Namrataa (Mumbai Sales)", email: "namrataa@andeverywhere.co", roles: ["SALES_PERSON"], status: "PENDING", last: null },
  { name: "Sachin Karvade (MP Sales)", email: "sachin@andeverywhere.co", roles: ["SALES_PERSON"], status: "PENDING", last: null },
];

async function main() {
  const hash = await bcrypt.hash("Welcome@2026", 10);
  for (const d of demo) {
    await prisma.user.upsert({
      where: { email: d.email.toLowerCase() },
      update: {
        name: d.name,
        roles: d.roles,
        permissions: permsFor(d.roles),
        status: d.status,
        lastActiveAt: d.last == null ? null : new Date(now.getTime() - d.last),
      },
      create: {
        name: d.name,
        email: d.email.toLowerCase(),
        passwordHash: hash,
        roles: d.roles,
        permissions: permsFor(d.roles),
        status: d.status,
        mustChangePassword: true,
        invitedAt: new Date("2026-06-20T09:00:00Z"),
        lastActiveAt: d.last == null ? null : new Date(now.getTime() - d.last),
      },
    });
    console.log("seeded", d.email);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
