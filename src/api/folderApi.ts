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
  FileApiLogEntry,
  SearchQuery,
  SearchResponse,
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
   * 파일/폴더 검색
   * GET /v1/folders/search
   */
  search: (token: string, query: SearchQuery): Promise<SearchResponse> =>
    apiCall<SearchResponse>('GET', '/folders/search', token, undefined, query as unknown as Record<string, unknown>),
};

export default folderApi;
