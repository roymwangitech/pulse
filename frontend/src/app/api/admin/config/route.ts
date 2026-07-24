import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';
import { z } from 'zod';

const schema = z.object({
  registrationEnabled: z.boolean(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'registration_enabled' },
    });
    const registrationEnabled = setting ? setting.value === 'true' : true;

    return NextResponse.json({ registrationEnabled });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const { registrationEnabled } = parsed.data;

    await prisma.systemSetting.upsert({
      where: { key: 'registration_enabled' },
      create: { key: 'registration_enabled', value: String(registrationEnabled) },
      update: { value: String(registrationEnabled) },
    });

    return NextResponse.json({ registrationEnabled });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
