import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { DMConversation } from '@/types';

export function useUnreadDmCount() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<{ conversations: DMConversation[] }>('/dm', accessToken ?? undefined),
    enabled: !!accessToken,
  });
  return data?.conversations.reduce((sum, c) => sum + c.unread, 0) ?? 0;
}
