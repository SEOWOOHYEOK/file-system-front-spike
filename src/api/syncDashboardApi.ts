/**
 * Sync Dashboard API Client
 * 동기화 대시보드 API (대시보드 요약 + 이벤트 목록)
 */
import axios, { AxiosError } from 'axios';
import type {
  SyncDashboardSummaryResponse,
  SyncDashboardEventsQuery,
  SyncDashboardEventsResponse,
} from '../types/sync-dashboard';

const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API 로그 콜백
export interface SyncDashboardLogEntry {
  id: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  request?: unknown;
  response?: unknown;
  error?: string;
  timestamp: Date;
}

let logCallback: ((log: SyncDashboardLogEntry) => void) | null = null;

export function setSyncDashboardLogCallback(callback: ((log: SyncDashboardLogEntry) => void) | null) {
  logCallback = callback;
}

// API 호출 래퍼
async function apiCall<T>(
  method: string,
  url: string,
  token?: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();
  const logEntry: SyncDashboardLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    method,
    url,
    status: 0,
    duration: 0,
    request: data || params,
    timestamp: new Date(),
  };

  try {
    const response = await api.request<T>({
      method,
      url,
      data,
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    logEntry.status = response.status;
    logEntry.duration = Date.now() - startTime;
    logEntry.response = response.data;

    if (logCallback) {
      logCallback(logEntry);
    }

    return response.data;
  } catch (error) {
    logEntry.duration = Date.now() - startTime;

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      logEntry.status = axiosError.response?.status || 0;
      logEntry.error = axiosError.message;
      logEntry.response = axiosError.response?.data;
    } else {
      logEntry.error = error instanceof Error ? error.message : 'Unknown error';
    }

    if (logCallback) {
      logCallback(logEntry);
    }

    throw error;
  }
}

// ============================================
// 동기화 대시보드 API
// ============================================

export const syncDashboardApi = {
  /**
   * 대시보드 요약 조회 (상태별 카운트)
   */
  getSummary: (token: string): Promise<SyncDashboardSummaryResponse> =>
    apiCall<SyncDashboardSummaryResponse>('GET', '/admin/sync/dashboard/summary', token),

  /**
   * 이벤트 목록 조회 (필터 + 페이지네이션)
   */
  getEvents: (token: string, query: SyncDashboardEventsQuery = {}): Promise<SyncDashboardEventsResponse> => {
    const params: Record<string, unknown> = {};
    if (query.status) params.status = query.status;
    if (query.eventType) params.eventType = query.eventType;
    if (query.targetType) params.targetType = query.targetType;
    if (query.userId) params.userId = query.userId;
    if (query.fromDate) params.fromDate = query.fromDate;
    if (query.toDate) params.toDate = query.toDate;
    if (query.page) params.page = query.page;
    if (query.pageSize) params.pageSize = query.pageSize;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sortOrder) params.sortOrder = query.sortOrder;

    return apiCall<SyncDashboardEventsResponse>(
      'GET',
      '/admin/sync/dashboard/events',
      token,
      undefined,
      params
    );
  },
};
