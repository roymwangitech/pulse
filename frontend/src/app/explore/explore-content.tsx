'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import type { Post, User } from '@/types';

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQ);
  const [search, setSearch] = useState(initialQ);

  const { data, isLoading } = useQuery({
    queryKey: ['search', search],
    queryFn: () =>
      api.get<{ users: User[]; hashtags: { name: string; _count: { posts: number } }[]; posts: Post[] }>(
        `/search?q=${encodeURIComponent(search)}&type=all`
      ),
    enabled: search.length > 0,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(query);
  };

  return (
    <AppLayout>
      <PageHeader title="Explore">
        <form onSubmit={handleSearch} className="mt-3">
          <Input
            placeholder="Search users, hashtags, captions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      </PageHeader>

      <div className="p-3 sm:p-4">
        {isLoading && <p className="text-muted-foreground">Searching...</p>}

        {data?.users && data.users.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-bold">Users</h2>
            {data.users.map((user) => (
              <Link key={user.id} href={`/profile/${user.username}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-card">
                <Avatar src={user.avatarUrl} alt={user.username} />
                <div>
                  <p className="font-semibold">{user.displayName ?? user.username}</p>
                  <p className="text-sm text-muted-foreground">@{user.username}</p>
                </div>
              </Link>
            ))}
          </section>
        )}

        {data?.hashtags && data.hashtags.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-bold">Hashtags</h2>
            {data.hashtags.map((tag) => (
              <Link key={tag.name} href={`/explore?q=%23${tag.name}`} className="block rounded-xl p-3 hover:bg-card">
                <p className="font-semibold">#{tag.name}</p>
                <p className="text-sm text-muted-foreground">{tag._count.posts} posts</p>
              </Link>
            ))}
          </section>
        )}

        {data?.posts && data.posts.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-bold">Posts</h2>
            {data.posts.map((post) => (
              <Link key={post.id} href={`/post/${post.id}`} className="block rounded-xl p-3 hover:bg-card">
                <p className="text-sm text-muted-foreground">@{post.user.username}</p>
                <p className="mt-1">{post.caption}</p>
              </Link>
            ))}
          </section>
        )}

        {search && !isLoading && !data?.users?.length && !data?.hashtags?.length && !data?.posts?.length && (
          <p className="text-center text-muted-foreground">No results for &quot;{search}&quot;</p>
        )}

        {!search && (
          <p className="text-center text-muted-foreground">Search for users, hashtags, or captions</p>
        )}
      </div>
    </AppLayout>
  );
}
