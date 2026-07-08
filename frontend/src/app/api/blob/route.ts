import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // Validate that the URL targets the public Vercel Blob storage domain to prevent SSRF
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith('.public.blob.vercel-storage.com')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return new NextResponse('Failed to fetch asset', { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Stream the image body back to the client with caching headers
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('Error proxying blob:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
