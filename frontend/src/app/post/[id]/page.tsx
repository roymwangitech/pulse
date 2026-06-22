'use client';

import { use } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { ThreadView } from '@/components/feed/thread-view';

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppLayout>
      <ThreadView postId={id} />
    </AppLayout>
  );
}
