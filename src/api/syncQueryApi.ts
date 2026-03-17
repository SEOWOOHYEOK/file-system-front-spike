/**
 * Sync Query API Client
 * 문서 모니터링 화면용 API (/v1/admin/sync-query/*)
 */
import apiClient from './apiClient';
import type {
  SyncQueryParams,
  SyncQuerySummaryResponse,
  SyncQueryEventListResponse,
  SyncQueryUploadersResponse,
} from '../types/sync-query.types';

function buildQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  return query.toString();
}

export const syncQueryApi = {
  /** 동기화 상태 요약 조회 */
  getSummary: async (params: SyncQueryParams = {}): Promise<SyncQuerySummaryResponse> => {
    const qs = buildQuery(params as Record<string, unknown>);
    const url = `/v1/admin/sync-query/summary${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<SyncQuerySummaryResponse>(url, { baseURL: '' });
    return data;
  },

  /** 동기화 이벤트 목록 조회 */
  getList: async (params: SyncQueryParams = {}): Promise<SyncQueryEventListResponse> => {
    const qs = buildQuery(params as Record<string, unknown>);
    const url = `/v1/admin/sync-query/list${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<SyncQueryEventListResponse>(url, { baseURL: '' });
    return data;
  },

  /** 업로더 목록 조회 */
  getUploaders: async (params: Pick<SyncQueryParams, 'fromDate' | 'toDate'> = {}): Promise<SyncQueryUploadersResponse> => {
    const qs = buildQuery(params as Record<string, unknown>);
    const url = `/v1/admin/sync-query/uploaders${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<SyncQueryUploadersResponse>(url, { baseURL: '' });
    return data;
  },
};
