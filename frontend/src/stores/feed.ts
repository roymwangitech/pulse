import { create } from 'zustand';
import type { Post, DateFilter } from '@/types';

interface FeedState {
  posts: Post[];
  dateFilter: DateFilter;
  customStartDate: string;
  customEndDate: string;
  prependPost: (post: Post) => void;
  setPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[]) => void;
  updatePost: (postId: string, updates: Partial<Post>) => void;
  removePost: (postId: string) => void;
  setDateFilter: (filter: DateFilter) => void;
  setCustomDates: (start: string, end: string) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  dateFilter: 'all',
  customStartDate: '',
  customEndDate: '',
  prependPost: (post) =>
    set((state) => ({
      posts: state.posts.some((p) => p.id === post.id) ? state.posts : [post, ...state.posts],
    })),
  setPosts: (posts) => set({ posts }),
  appendPosts: (posts) =>
    set((state) => ({
      posts: [...state.posts, ...posts.filter((p) => !state.posts.some((ep) => ep.id === p.id))],
    })),
  updatePost: (postId, updates) =>
    set((state) => ({
      posts: state.posts.map((p) => (p.id === postId ? { ...p, ...updates } : p)),
    })),
  removePost: (postId) =>
    set((state) => ({ posts: state.posts.filter((p) => p.id !== postId) })),
  setDateFilter: (dateFilter) => set({ dateFilter }),
  setCustomDates: (customStartDate, customEndDate) => set({ customStartDate, customEndDate }),
}));
