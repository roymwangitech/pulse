-- CreateIndex for full-text search on posts
-- Run after initial migration: npx prisma db execute --file prisma/migrations/fulltext.sql

CREATE INDEX IF NOT EXISTS post_search_text_gin_idx ON "Post" USING gin(to_tsvector('english', coalesce("searchText", '')));
