/**
 * Trash API Client
 * 220.휴지통 API
 *
 * 3개 API만 사용:
 *   GET    /v1/trash                      - 휴지통 목록 조회
 *   DELETE /v1/trash/{trashMetadataId}     - 영구삭제
 *   POST   /v1/trash/restore/execute       - 복원 실행
 */
import axios, { AxiosError } from 'axios';
import type {
  TrashListQuery,
  TrashListResponse,
  RestoreExecuteRequest,
  RestoreExecuteResponse,
  PurgeResponse,
  FileApiLogEntry,
} from '../types/file.types';

const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API 로그 콜백
let logCallback: ((log: FileApiLogEntry) => void) | null = null;

export function setTrashLogCallback(callback: ((log: FileApiLogEntry) => void) | null) {
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
  const logEntry: FileApiLogEntry = {
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
// 220.휴지통 API
// ============================================

export const trashApi = {
  /**
   * 휴지통 목록 조회
   * GET /v1/trash
   */
  getList: (token: string, query?: TrashListQuery): Promise<TrashListResponse> =>
    apiCall<TrashListResponse>(
      'GET',
      '/trash',
      token,
      undefined,
      query as Record<string, unknown>
    ),

  /**
   * 복원 실행
   * POST /v1/trash/restore/execute
   */
  executeRestore: (
    token: string,
    request: RestoreExecuteRequest
  ): Promise<RestoreExecuteResponse> =>
    apiCall<RestoreExecuteResponse>('POST', '/trash/restore/execute', token, request),

  /**
   * 영구삭제
   * DELETE /v1/trash/{trashMetadataId}
   */
  purge: (token: string, trashMetadataId: string): Promise<PurgeResponse> =>
    apiCall<PurgeResponse>('DELETE', `/trash/${trashMetadataId}`, token),
};

export default trashApi;
