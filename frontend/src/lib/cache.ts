import { invalidateCachePattern, delCache } from './redis';

export async function invalidateFeedCache() {
  await invalidateCachePattern('feed:posts:*');
}

export async function invalidatePostCache(postId: string) {
  await delCache(`post:${postId}`);
  await invalidateFeedCache();
}

export async function invalidateUserCache(username: string) {
  const norm = username.toLowerCase();
  await delCache(`user:profile:${norm}`);
  await invalidateCachePattern(`user:posts:${norm}:*`);
}

export async function invalidateThreadRepliesCache(postId: string) {
  await invalidateCachePattern(`thread:replies:${postId}:*`);
}

export async function invalidateSearchCache() {
  await delCache('search:trending');
  await delCache('search:recent-threads');
}

export async function invalidateDmCache(userId: string) {
  await delCache(`dm:conversations:${userId}`);
}

export async function invalidateDmCacheForUsers(userIds: string[]) {
  await Promise.all(userIds.map((userId) => delCache(`dm:conversations:${userId}`)));
}

