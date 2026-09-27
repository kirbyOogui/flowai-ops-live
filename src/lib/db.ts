import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type * as Enums from "@/generated/prisma/enums";
import type { Category, Priority, RequestStatus, ReviewState, SourceType } from "./domain";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL が設定されていません。.env.example を参考に .env を作成してください。");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// 開発時のホットリロードで接続が増え続けないよう、グローバルに 1 つだけ保持する
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// domain.ts の定数と Prisma の enum がずれたらここで型エラーになる
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _enumsInSync: [
  Same<Category, Enums.Category>,
  Same<Priority, Enums.Priority>,
  Same<RequestStatus, Enums.RequestStatus>,
  Same<ReviewState, Enums.ReviewState>,
  Same<SourceType, Enums.SourceType>,
] = [true, true, true, true, true];
void _enumsInSync;
