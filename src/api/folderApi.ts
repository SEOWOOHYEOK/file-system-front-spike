/**
 * Folder API Client
 * 210.폴더 API
 */
import axios, { AxiosError } from 'axios';
import type {
  FolderInfoResponse,
  FolderContentsResponse,
  GetFolderContentsQuery,
  CreateFolderRequest,
  CreateFolderResponse,
  RenameFolderRequest,
  RenameFolderResponse,
  MoveFolderRequest,
  MoveFolderResponse,
  DeleteFolderResponse,
  FileApiLogEntry,
  SearchQuery,
  SearchResponse,
  SearchHistoryResponse,
  DeleteAllSearchHistoryResponse,
} from '../types/file.types';

const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API 로그 콜백
let logCallback: ((log: FileApiLogEntry) => void) | null = null;

export function setFolderLogCallback(callback: ((log: FileApiLogEntry) => void) | null) {
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
// 210.폴더 API
// ============================================

export const folderApi = {
  /**
   * 폴더 생성
   * POST /v1/folders
   */
  create: (token: string, request: CreateFolderRequest): Promise<CreateFolderResponse> =>
    apiCall<CreateFolderResponse>('POST', '/folders', token, request),

  /**
   * 루트 폴더 정보 조회
   * GET /v1/folders/root
   */
  getRoot: (token: string): Promise<FolderInfoResponse> =>
    apiCall<FolderInfoResponse>('GET', '/folders/root', token),

  /**
   * 폴더 정보 조회
   * GET /v1/folders/:folderId
   */
  getInfo: (token: string, folderId: string): Promise<FolderInfoResponse> =>
    apiCall<FolderInfoResponse>('GET', `/folders/${folderId}`, token),

  /**
   * 폴더 내용 조회 (하위 폴더/파일)
   * GET /v1/folders/:folderId/contents
   */
  getContents: (
    token: string,
    folderId: string,
    query?: GetFolderContentsQuery
  ): Promise<FolderContentsResponse> =>
    apiCall<FolderContentsResponse>(
      'GET',
      `/folders/${folderId}/contents`,
      token,
      undefined,
      query as Record<string, unknown>
    ),

  /**
   * 폴더명 변경
   * PUT /v1/folders/:folderId/rename
   */
  rename: (
    token: string,
    folderId: string,
    request: RenameFolderRequest
  ): Promise<RenameFolderResponse> =>
    apiCall<RenameFolderResponse>('PUT', `/folders/${folderId}/rename`, token, request),

  /**
   * 폴더 이동
   * POST /v1/folders/:folderId/move
   */
  move: (
    token: string,
    folderId: string,
    request: MoveFolderRequest
  ): Promise<MoveFolderResponse> =>
    apiCall<MoveFolderResponse>('POST', `/folders/${folderId}/move`, token, request),

  /**
   * 폴더 삭제 (휴지통으로 이동)
   * DELETE /v1/folders/:folderId
   */
  delete: (token: string, folderId: string): Promise<DeleteFolderResponse> =>
    apiCall<DeleteFolderResponse>('DELETE', `/folders/${folderId}`, token),

  /**
   * 파일/폴더 검색
   * GET /v1/folders/search
   */
  search: (token: string, query: SearchQuery): Promise<SearchResponse> =>
    apiCall<SearchResponse>('GET', '/folders/search', token, undefined, query as unknown as Record<string, unknown>),

  // ============================================
  // 검색 내역 API
  // ============================================

  /**
   * 검색 내역 조회
   * GET /v1/folders/search/history
   */
  getSearchHistory: (
    token: string,
    params?: { page?: number; pageSize?: number }
  ): Promise<SearchHistoryResponse> =>
    apiCall<SearchHistoryResponse>(
      'GET',
      '/folders/search/history',
      token,
      undefined,
      params as Record<string, unknown>
    ),

  /**
   * 검색 내역 단건 삭제
   * DELETE /v1/folders/search/history/:historyId
   */
  deleteSearchHistory: (token: string, historyId: string): Promise<void> =>
    apiCall<void>('DELETE', `/folders/search/history/${historyId}`, token),

  /**
   * 검색 내역 전체 삭제
   * DELETE /v1/folders/search/history
   */
  deleteAllSearchHistory: (token: string): Promise<DeleteAllSearchHistoryResponse> =>
    apiCall<DeleteAllSearchHistoryResponse>('DELETE', '/folders/search/history', token),
};

export default folderApi;
