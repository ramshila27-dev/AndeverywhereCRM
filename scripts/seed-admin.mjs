// Seed / reset the initial admin account so the app can be logged into.
// Usage: node scripts/seed-admin.mjs [email] [password]
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = (process.argv[2] || "admin@andeverywhere.co").toLowerCase();
const password = process.argv[3] || "Andeverywhere@2026";

const ALL_FEATURES = [
  "queries",
  "quotes",
  "itineraries",
  "rates",
  "reports",
  "users",
  "settings",
];

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      roles: ["ADMIN"],
      permissions: ALL_FEATURES,
      status: "ACTIVE",
      passwordHash,
      mustChangePassword: true,
    },
    create: {
      name: "Administrator",
      email,
      passwordHash,
      roles: ["ADMIN"],
      permissions: ALL_FEATURES,
      status: "ACTIVE",
      mustChangePassword: true,
    },
  });
  console.log(`Admin ready: ${user.email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
