import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const hashtags = await prisma.hashtag.findMany({
      take: 10,
      orderBy: { posts: { _count: 'desc' } },
      include: { _count: { select: { posts: true } } },
    });
    return NextResponse.json({ hashtags: hashtags.map((h) => ({ name: h.name, postCount: h._count.posts })) });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
