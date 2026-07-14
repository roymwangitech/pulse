import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';
import { getCache, setCache } from '@/lib/redis';
import { invalidateDmCacheForUsers } from '@/lib/cache';

const userSelect = { id: true, username: true, displayName: true, avatarUrl: true };

// GET /api/dm — list all conversations for the current user with last message + unread count
export async function GET(req: NextRequest) {
  try {
    const me = await authenticate(req);

    const cacheKey = `dm:conversations:${me.userId}`;
    const cached = await getCache<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ userAId: me.userId }, { userBId: me.userId }] },
      orderBy: { updatedAt: 'desc' },
      include: {
        userA: { select: userSelect },
        userB: { select: userSelect },
        messages: {
          where: { deletedBySender: false, deletedByReceiver: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Count unread per conversation in a single query (Group By) to eliminate N+1 problem
    const unreadCountsGrouped = await prisma.directMessage.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderId: { not: me.userId },
        readAt: null,
        deletedByReceiver: false,
      },
      _count: {
        id: true,
      },
    });

    const unreadMap = new Map<string, number>();
    for (const group of unreadCountsGrouped) {
      unreadMap.set(group.conversationId, group._count.id);
    }

    const result = conversations.map((c) => {
      const other = c.userAId === me.userId ? c.userB : c.userA;
      const last = c.messages[0] ?? null;
      return {
        id: c.id,
        other,
        lastMessage: last ? { content: last.content, createdAt: last.createdAt, fromMe: last.senderId === me.userId } : null,
        unread: unreadMap.get(c.id) ?? 0,
        updatedAt: c.updatedAt,
      };
    });

    const responseData = { conversations: result };
    await setCache(cacheKey, responseData, 300);

    return NextResponse.json(responseData);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/dm — start or get conversation with a user
export async function POST(req: NextRequest) {
  try {
    const me = await authenticate(req);
    const { username } = await req.json();
    if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 });

    const other = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!other) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (other.id === me.userId) return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });

    // Canonical order: smaller id = userA
    const [userAId, userBId] = [me.userId, other.id].sort();

    const conversation = await prisma.conversation.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
      include: { userA: { select: userSelect }, userB: { select: userSelect } },
    });

    const otherUser = conversation.userAId === me.userId ? conversation.userB : conversation.userA;
    
    // Invalidate conversation list cache for both users
    await invalidateDmCacheForUsers([me.userId, other.id]);

    return NextResponse.json({ conversation: { id: conversation.id, other: otherUser } });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

