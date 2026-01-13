-- AlterTable
ALTER TABLE "SocialProvider" ADD COLUMN "quotaExhausted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "quotaExhaustedAt" TIMESTAMP(3),
ADD COLUMN "totalPostsPublished" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "SocialProvider_quotaExhausted_idx" ON "SocialProvider"("quotaExhausted");
