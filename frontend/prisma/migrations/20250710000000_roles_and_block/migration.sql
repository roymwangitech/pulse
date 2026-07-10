-- Add postingBlocked column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "postingBlocked" BOOLEAN NOT NULL DEFAULT false;
