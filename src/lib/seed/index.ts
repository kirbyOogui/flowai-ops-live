import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { MEMBERS } from "@/lib/nexora";

// 初期データの投入。本物版では架空の依頼は入れず、担当者候補のメンバーだけを登録する。
// Next.js の外（tsx）からも実行するため、server-only なモジュールには依存しない。

type Db = PrismaClient | Prisma.TransactionClient;

export async function seedMembers(db: Db) {
  for (const [index, m] of MEMBERS.entries()) {
    const data = { name: m.name, department: m.department, role: m.role, responsibilities: m.responsibilities, sortOrder: index };
    await db.member.upsert({ where: { id: m.id }, create: { id: m.id, ...data }, update: data });
  }
  return { members: MEMBERS.length };
}
