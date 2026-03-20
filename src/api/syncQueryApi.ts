/**
 * Sync Query API Client
 * 문서 모니터링 화면용 API (/v1/admin/sync-query/*)
 *
 * apiClient.baseURL = '/v1' → URL에서 /v1 제외
 */
import apiClient from './apiClient';
import type {
  SyncQueryParams,
  SyncQuerySummaryResponse,
  SyncQueryEventListResponse,
  SyncQueryUploadersResponse,
} from '../types/sync-query.types';

function buildQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export const syncQueryApi = {
  /** 동기화 상태 요약 조회 */
  async getSummary(params: SyncQueryParams = {}): Promise<SyncQuerySummaryResponse> {
    const { data } = await apiClient.get<SyncQuerySummaryResponse>(
      `/admin/sync-query/summary${buildQuery(params as Record<string, unknown>)}`,
    );
    return data;
  },

  /** 동기화 이벤트 목록 조회 */
  async getList(params: SyncQueryParams = {}): Promise<SyncQueryEventListResponse> {
    const { data } = await apiClient.get<SyncQueryEventListResponse>(
      `/admin/sync-query/list${buildQuery(params as Record<string, unknown>)}`,
    );
    return data;
  },

  /** 업로더 목록 조회 */
  async getUploaders(params: Pick<SyncQueryParams, 'fromDate' | 'toDate'> = {}): Promise<SyncQueryUploadersResponse> {
    const { data } = await apiClient.get<SyncQueryUploadersResponse>(
      `/admin/sync-query/uploaders${buildQuery(params as Record<string, unknown>)}`,
    );
    return data;
  },
};
