'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchJson, ApiError } from '@/lib/api';
import type {
  ProgramDashboardData,
  TaskWithAssignee,
  ChatHistoryResponse,
  CommentWithAuthor,
  InboxData,
  ApprovalWithMembers,
  ProgramSummary,
  Member,
} from '@/lib/types';

// ============================================
// XCollab — Shared data hooks (React Query)
// All views share one cache entry per resource, so switching
// screens no longer refires /api/program every time.
// ============================================

export const queryKeys = {
  program: ['program'] as const,
  programs: ['programs'] as const,
  tasks: ['tasks'] as const,
  chatHistory: ['chat-history'] as const,
  inbox: ['inbox'] as const,
  me: ['me'] as const,
  comments: (wbpId: string) => ['comments', wbpId] as const,
  approvals: (wbpId: string) => ['approvals', wbpId] as const,
};

// Polling keeps every open window in sync — the "real-time" contract for the
// prototype. A second browser sees comments, moves, and approvals within
// one interval without any manual refresh.
const LIVE = { refetchInterval: 5000, refetchOnWindowFocus: true } as const;
const LIVE_FAST = { refetchInterval: 3500, refetchOnWindowFocus: true } as const;

export function useProgram() {
  return useQuery<ProgramDashboardData, ApiError>({
    queryKey: queryKeys.program,
    queryFn: () => fetchJson<ProgramDashboardData>('/api/program'),
    ...LIVE,
  });
}

export function usePrograms() {
  return useQuery<ProgramSummary[], ApiError>({
    queryKey: queryKeys.programs,
    queryFn: () => fetchJson<ProgramSummary[]>('/api/programs'),
    ...LIVE,
  });
}

export function useTasks() {
  return useQuery<TaskWithAssignee[], ApiError>({
    queryKey: queryKeys.tasks,
    queryFn: () => fetchJson<TaskWithAssignee[]>('/api/tasks'),
    ...LIVE,
  });
}

export function useChatHistory() {
  return useQuery<ChatHistoryResponse, ApiError>({
    queryKey: queryKeys.chatHistory,
    queryFn: () => fetchJson<ChatHistoryResponse>('/api/ai-chat'),
  });
}

export function useMe() {
  return useQuery<Member, ApiError>({
    queryKey: queryKeys.me,
    queryFn: () => fetchJson<Member>('/api/me'),
    staleTime: Infinity,
  });
}

export function useInbox() {
  return useQuery<InboxData, ApiError>({
    queryKey: queryKeys.inbox,
    queryFn: () => fetchJson<InboxData>('/api/inbox'),
    ...LIVE_FAST,
  });
}

export function useComments(wbpId: string) {
  return useQuery<CommentWithAuthor[], ApiError>({
    queryKey: queryKeys.comments(wbpId),
    queryFn: () => fetchJson<CommentWithAuthor[]>(`/api/comments?wbpId=${encodeURIComponent(wbpId)}`),
    ...LIVE_FAST,
  });
}

export function useApprovals(wbpId: string) {
  return useQuery<ApprovalWithMembers[], ApiError>({
    queryKey: queryKeys.approvals(wbpId),
    queryFn: () => fetchJson<ApprovalWithMembers[]>(`/api/approvals?wbpId=${encodeURIComponent(wbpId)}`),
    ...LIVE_FAST,
  });
}
