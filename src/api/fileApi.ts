/**
 * File API Client
 * 200.파일 API
 */
import axios, { AxiosError } from 'axios';
import type {
  FileInfoResponse,
  UploadFileResponse,
  RenameFileRequest,
  RenameFileResponse,
  MoveFileRequest,
  MoveFileResponse,
  DeleteFileResponse,
  ConflictStrategy,
  FileApiLogEntry,
  InitiateMultipartRequest,
  InitiateMultipartResponse,
  UploadPartResponse,
  CompleteMultipartRequest,
  CompleteMultipartResponse,
  SessionStatusResponse,
  AbortSessionResponse,
  SyncEventStatusResponse,
  FileSyncStatusResponse,
} from '../types/file.types';

const api = axios.create({
  baseURL: '/v1',
});

// API 로그 콜백
let logCallback: ((log: FileApiLogEntry) => void) | null = null;

export function setFileLogCallback(callback: ((log: FileApiLogEntry) => void) | null) {
  logCallback = callback;
}

// API 호출 래퍼
async function apiCall<T>(
  method: string,
  url: string,
  token?: string,
  data?: unknown,
  config?: { headers?: Record<string, string>; responseType?: 'blob' | 'json' }
): Promise<T> {
  const startTime = Date.now();
  const logEntry: FileApiLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    method,
    url,
    status: 0,
    duration: 0,
    request: data,
    timestamp: new Date(),
  };

  try {
    const response = await api.request<T>({
      method,
      url,
      data,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(config?.headers || {}),
      },
      responseType: config?.responseType || 'json',
    });

    logEntry.status = response.status;
    logEntry.duration = Date.now() - startTime;
    logEntry.response = config?.responseType === 'blob' ? '[Blob Data]' : response.data;
    
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
// 200.파일 API
// ============================================

export const fileApi = {
  /**
   * 파일 업로드 (100MB 미만)
   * POST /v1/files/upload
   */
  upload: async (
    token: string,
    file: File,
    folderId: string,
    conflictStrategy?: ConflictStrategy
  ): Promise<UploadFileResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', folderId);
    if (conflictStrategy) {
      formData.append('conflictStrategy', conflictStrategy);
    }

    return apiCall<UploadFileResponse>(
      'POST',
      '/files/upload',
      token,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  /**
   * 다중 파일 업로드
   * POST /v1/files/upload/many
   */
  uploadMany: async (
    token: string,
    files: File[],
    folderId: string,
    conflictStrategy?: ConflictStrategy
  ): Promise<UploadFileResponse[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('folderId', folderId);
    if (conflictStrategy) {
      formData.append('conflictStrategy', conflictStrategy);
    }

    return apiCall<UploadFileResponse[]>(
      'POST',
      '/files/upload/many',
      token,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  /**
   * 파일 정보 조회
   * GET /v1/files/:fileId
   */
  getInfo: (token: string, fileId: string): Promise<FileInfoResponse> =>
    apiCall<FileInfoResponse>('GET', `/files/${fileId}`, token),

  /**
   * 파일 다운로드
   * GET /v1/files/:fileId/download
   * Returns: { blob: Blob, filename: string }
   */
  download: async (
    token: string,
    fileId: string
  ): Promise<{ blob: Blob; filename: string }> => {
    const response = await axios.get(`/v1/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    });

    // Content-Disposition에서 파일명 추출
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
      if (filenameMatch) {
        filename = decodeURIComponent(filenameMatch[1]);
      }
    }

    return { blob: response.data, filename };
  },

  /**
   * 파일명 변경
   * PUT /v1/files/:fileId/rename
   */
  rename: (
    token: string,
    fileId: string,
    request: RenameFileRequest
  ): Promise<RenameFileResponse> =>
    apiCall<RenameFileResponse>('PUT', `/files/${fileId}/rename`, token, request),

  /**
   * 파일 이동
   * POST /v1/files/:fileId/move
   */
  move: (
    token: string,
    fileId: string,
    request: MoveFileRequest
  ): Promise<MoveFileResponse> =>
    apiCall<MoveFileResponse>('POST', `/files/${fileId}/move`, token, request),

  /**
   * 파일 삭제 (휴지통 이동)
   * DELETE /v1/files/:fileId
   */
  delete: (token: string, fileId: string): Promise<DeleteFileResponse> =>
    apiCall<DeleteFileResponse>('DELETE', `/files/${fileId}`, token),

  // ============================================
  // 201.멀티파트 업로드 API
  // ============================================

  /**
   * 멀티파트 업로드 초기화
   * POST /v1/files/multipart/initiate
   */
  multipartInitiate: async (
    token: string,
    request: InitiateMultipartRequest
  ): Promise<InitiateMultipartResponse> =>
    apiCall<InitiateMultipartResponse>('POST', '/files/multipart/initiate', token, request),

  /**
   * 파트 업로드
   * PUT /v1/files/multipart/:sessionId/parts/:partNumber
   */
  multipartUploadPart: async (
    token: string,
    sessionId: string,
    partNumber: number,
    data: ArrayBuffer,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<UploadPartResponse> => {
    const startTime = Date.now();
    const logEntry: FileApiLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      method: 'PUT',
      url: `/files/multipart/${sessionId}/parts/${partNumber}`,
      status: 0,
      duration: 0,
      request: { sessionId, partNumber, size: data.byteLength },
      timestamp: new Date(),
    };

    try {
      const response = await axios.put<UploadPartResponse>(
        `/v1/files/multipart/${sessionId}/parts/${partNumber}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              onProgress(progressEvent.loaded, progressEvent.total);
            }
          },
        }
      );

      logEntry.status = response.status;
      logEntry.duration = Date.now() - startTime;
      logEntry.response = response.data;
      if (logCallback) logCallback(logEntry);

      return response.data;
    } catch (error) {
      logEntry.duration = Date.now() - startTime;
      if (axios.isAxiosError(error)) {
        logEntry.status = error.response?.status || 0;
        logEntry.error = error.message;
        logEntry.response = error.response?.data;
      } else {
        logEntry.error = error instanceof Error ? error.message : 'Unknown error';
      }
      if (logCallback) logCallback(logEntry);
      throw error;
    }
  },

  /**
   * 멀티파트 업로드 완료
   * POST /v1/files/multipart/:sessionId/complete
   */
  multipartComplete: async (
    token: string,
    sessionId: string,
    request?: CompleteMultipartRequest
  ): Promise<CompleteMultipartResponse> =>
    apiCall<CompleteMultipartResponse>('POST', `/files/multipart/${sessionId}/complete`, token, request),

  /**
   * 세션 상태 조회
   * GET /v1/files/multipart/:sessionId/status
   */
  multipartStatus: async (
    token: string,
    sessionId: string
  ): Promise<SessionStatusResponse> =>
    apiCall<SessionStatusResponse>('GET', `/files/multipart/${sessionId}/status`, token),

  /**
   * 업로드 취소
   * DELETE /v1/files/multipart/:sessionId
   */
  multipartAbort: async (
    token: string,
    sessionId: string
  ): Promise<AbortSessionResponse> =>
    apiCall<AbortSessionResponse>('DELETE', `/files/multipart/${sessionId}`, token),

  // ============================================
  // 250.동기화 API
  // ============================================

  /**
   * 동기화 이벤트 상태 조회
   * GET /v1/sync-events/:syncEventId
   */
  getSyncEventStatus: async (
    token: string,
    syncEventId: string
  ): Promise<SyncEventStatusResponse> =>
    apiCall<SyncEventStatusResponse>('GET', `/sync-events/${syncEventId}`, token),

  /**
   * 파일 동기화 상태 조회
   * GET /v1/files/:fileId/sync-status
   */
  getFileSyncStatus: async (
    token: string,
    fileId: string
  ): Promise<FileSyncStatusResponse> =>
    apiCall<FileSyncStatusResponse>('GET', `/files/${fileId}/sync-status`, token),
};

export default fileApi;
