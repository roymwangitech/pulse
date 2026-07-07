import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { authenticate } from '@/lib/auth-server';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Required for file uploads in Next.js — disables default body size limit
export const config = {
  api: { bodyParser: false },
};

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Storage not configured. Set BLOB_READ_WRITE_TOKEN.' },
      { status: 500 }
    );
  }

  try {
    const user = await authenticate(req);

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (fe) {
      console.error('[upload] formData parse error', fe);
      return NextResponse.json({ error: 'Could not parse form data' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, GIF and WebP are allowed' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filename = `posts/${user.userId}-${Date.now()}.${ext}`;

    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[upload] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
