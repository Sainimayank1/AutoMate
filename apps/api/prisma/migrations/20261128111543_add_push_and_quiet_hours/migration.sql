-- CreateEnum
CREATE TYPE "ReminderRepeat" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "pushed_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "repeat" "ReminderRepeat" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "quiet_end" VARCHAR(5),
ADD COLUMN     "quiet_start" VARCHAR(5);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "device" TEXT,
    "last_push_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
