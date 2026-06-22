'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { ComposePost } from '@/components/feed/compose-post';
import { Feed } from '@/components/feed/feed';
import { DateFilterBar } from '@/components/feed/date-filter';
import { useFeedStore } from '@/stores/feed';

export default function HomePage() {
  const { dateFilter, customStartDate, customEndDate } = useFeedStore();

  return (
    <AppLayout>
      <PageHeader title="Home" />
      <ComposePost />
      <DateFilterBar />
      <Feed
        filter={dateFilter}
        startDate={dateFilter === 'custom' ? customStartDate : undefined}
        endDate={dateFilter === 'custom' ? customEndDate : undefined}
      />
    </AppLayout>
  );
}
