import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';

const schema = z.object({ emoji: z.string().min(1).max(10) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const user = await authenticate(req);
    const { postId } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const { emoji } = parsed.data;
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const existing = await prisma.reaction.findUnique({
      where: { userId_postId_emoji: { userId: user.userId, postId, emoji } },
    });

    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      return NextResponse.json({ action: 'removed', emoji });
    }

    const reaction = await prisma.reaction.create({ data: { userId: user.userId, postId, emoji } });
    return NextResponse.json({ action: 'added', reaction }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
