import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const companyName = process.env.ADMIN_COMPANY_NAME || "Founder Match Admin";

  if (!email || !username || !password) {
    throw new Error("Missing ADMIN_EMAIL, ADMIN_USERNAME, or ADMIN_PASSWORD in backend/.env");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { username },
    update: {
      email,
      companyName,
      role: "admin",
      passwordHash,
    },
    create: {
      email,
      username,
      companyName,
      role: "admin",
      passwordHash,
    },
  });

  console.log(`Admin user ready: ${username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
