ALTER TABLE "DirectMessage" ALTER COLUMN "content" TYPE VARCHAR(3000);
ALTER TABLE "DirectMessage" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
