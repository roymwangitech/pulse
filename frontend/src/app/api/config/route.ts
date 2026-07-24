import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'registration_enabled' },
    });
    const registrationEnabled = setting ? setting.value === 'true' : true;
    return NextResponse.json({ registrationEnabled });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
