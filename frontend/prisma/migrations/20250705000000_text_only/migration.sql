-- Drop sticker system and media columns (text + emoji only)

UPDATE "Post" SET "caption" = '(legacy post)' WHERE "caption" IS NULL;
UPDATE "ThreadReply" SET "content" = '(legacy reply)' WHERE "content" IS NULL;

DROP TABLE IF EXISTS "Sticker";
DROP TYPE IF EXISTS "StickerCategory";

ALTER TABLE "Post" DROP COLUMN IF EXISTS "imageUrl";
ALTER TABLE "Post" DROP COLUMN IF EXISTS "stickerUrl";
ALTER TABLE "Post" ALTER COLUMN "caption" SET NOT NULL;

ALTER TABLE "ThreadReply" DROP COLUMN IF EXISTS "imageUrl";
ALTER TABLE "ThreadReply" DROP COLUMN IF EXISTS "stickerUrl";
ALTER TABLE "ThreadReply" ALTER COLUMN "content" SET NOT NULL;
