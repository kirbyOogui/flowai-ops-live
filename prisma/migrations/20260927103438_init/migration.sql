-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('email', 'slack', 'form');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('sales', 'customer_success', 'product', 'design', 'engineering', 'marketing', 'finance', 'hr', 'general_affairs', 'legal');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('urgent', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('todo', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('auto_assigned', 'needs_review', 'confirmed');

-- CreateEnum
CREATE TYPE "Actor" AS ENUM ('ai', 'human', 'system');

-- CreateEnum
CREATE TYPE "InboundStatus" AS ENUM ('received', 'processing', 'processed', 'failed');

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "responsibilities" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundMessage" (
    "id" TEXT NOT NULL,
    "source" "SourceType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "InboundStatus" NOT NULL DEFAULT 'received',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "inboundId" TEXT,
    "title" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceMetadata" JSONB NOT NULL,
    "requesterName" TEXT NOT NULL,
    "originalMessage" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "priority" "Priority" NOT NULL,
    "assigneeId" TEXT,
    "reviewState" "ReviewState" NOT NULL,
    "dueDate" DATE,
    "nextAction" TEXT NOT NULL,
    "replySubject" TEXT NOT NULL,
    "replyDraft" TEXT NOT NULL,
    "replySentAt" TIMESTAMP(3),
    "replyExternalId" TEXT,
    "relatedRequestId" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'todo',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "assigneeConfidence" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor" "Actor" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboundMessage_status_createdAt_idx" ON "InboundMessage"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboundMessage_source_externalId_key" ON "InboundMessage"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Request_inboundId_key" ON "Request"("inboundId");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "Request"("status");

-- CreateIndex
CREATE INDEX "Request_receivedAt_idx" ON "Request"("receivedAt");

-- CreateIndex
CREATE INDEX "Request_updatedAt_idx" ON "Request"("updatedAt");

-- CreateIndex
CREATE INDEX "Request_requesterName_idx" ON "Request"("requesterName");

-- CreateIndex
CREATE INDEX "AiAnalysis_requestId_idx" ON "AiAnalysis"("requestId");

-- CreateIndex
CREATE INDEX "ActivityLog_requestId_createdAt_idx" ON "ActivityLog"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageLog_key_createdAt_idx" ON "UsageLog"("key", "createdAt");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_inboundId_fkey" FOREIGN KEY ("inboundId") REFERENCES "InboundMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_relatedRequestId_fkey" FOREIGN KEY ("relatedRequestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
