-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "AIChatDailyUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usageDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIChatDailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIChatDailyUsage_userId_idx" ON "AIChatDailyUsage"("userId");

-- CreateIndex
CREATE INDEX "AIChatDailyUsage_usageDate_idx" ON "AIChatDailyUsage"("usageDate");

-- CreateIndex
CREATE UNIQUE INDEX "AIChatDailyUsage_userId_usageDate_key" ON "AIChatDailyUsage"("userId", "usageDate");

-- CreateIndex
CREATE INDEX "Maintenance_status_idx" ON "Maintenance"("status");

-- CreateIndex
CREATE INDEX "Maintenance_startsAt_idx" ON "Maintenance"("startsAt");

-- CreateIndex
CREATE INDEX "Maintenance_endsAt_idx" ON "Maintenance"("endsAt");

-- AddForeignKey
ALTER TABLE "AIChatDailyUsage" ADD CONSTRAINT "AIChatDailyUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
