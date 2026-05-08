import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
const root = process.cwd();
const prismaDir = path.join(root, "prisma");

const sourceMap = {
  neon: path.join(prismaDir, "schema.postgres.prisma"),
  sqlite: path.join(prismaDir, "schema.sqlite.prisma"),
};

if (!target || !(target in sourceMap)) {
  console.error("Usage: node scripts/select-db.mjs <neon|sqlite>");
  process.exit(1);
}

fs.copyFileSync(sourceMap[target], path.join(prismaDir, "schema.prisma"));
console.log(`Selected DB provider: ${target}`);
