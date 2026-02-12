/**
 * External Share API Client
 * 700.외부인증 & 710.외부접근 API 클라이언트
 */
import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ChangePasswordRequest,
  PaginationParams,
  PaginatedResponse,
  PublicShare,
  ShareDetailResponse,
  ApiLogEntry,
  ExtRangeDownloadOptions,
  ExtDownloadResponse,
  ExtContentRange,
  ExtDownloadProgress,
} from '../types/api.types';

// API Base URL (Vite proxy를 통해 백엔드로 전달)
const API_BASE = '/v1';

// API 로그 콜백
type LogCallback = (log: ApiLogEntry) => void;
let logCallback: LogCallback | null = null;

export const setLogCallback = (callback: LogCallback | null) => {
  logCallback = callback;
};

// Authorization 헤더 생성
const authHeader = (accessToken: string): AxiosRequestConfig => ({
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

// API 호출 래퍼 (로깅 포함)
async function apiCall<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  config?: AxiosRequestConfig,
  data?: unknown,
): Promise<AxiosResponse<T>> {
  const startTime = Date.now();
  const fullUrl = `${API_BASE}${url}`;
  
  try {
    let response: AxiosResponse<T>;
    
    switch (method) {
      case 'GET':
        response = await axios.get<T>(fullUrl, config);
        break;
      case 'POST':
        response = await axios.post<T>(fullUrl, data, config);
        break;
      case 'PATCH':
        response = await axios.patch<T>(fullUrl, data, config);
        break;
      case 'DELETE':
        response = await axios.delete<T>(fullUrl, config);
        break;
    }
    
    const duration = Date.now() - startTime;
    
    if (logCallback) {
      logCallback({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        method,
        url: fullUrl,
        status: response.status,
        duration,
        request: data,
        response: response.data,
      });
    }
    
    return response;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    
    if (axios.isAxiosError(error)) {
      if (logCallback) {
        logCallback({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          method,
          url: fullUrl,
          status: error.response?.status || 0,
          duration,
          request: data,
          response: error.response?.data,
          error: error.message,
        });
      }
    }
    
    throw error;
  }
}

// ============================================================
// 700.외부인증 API
// ============================================================

/**
 * 외부 사용자 로그인
 */
export const login = async (dto: LoginRequest): Promise<LoginResponse> => {
  const response = await apiCall<LoginResponse>('POST', '/ext-auth/login', {}, dto);
  return response.data;
};

/**
 * Access Token 갱신
 */
export const refreshToken = async (dto: RefreshTokenRequest): Promise<RefreshTokenResponse> => {
  const response = await apiCall<RefreshTokenResponse>('POST', '/ext-auth/refresh-token', {}, dto);
  return response.data;
};

/**
 * 로그아웃
 */
export const logout = async (accessToken: string): Promise<void> => {
  await apiCall<{ message: string }>('POST', '/ext-auth/logout', authHeader(accessToken), {});
};

/**
 * 비밀번호 변경
 */
export const changePassword = async (
  accessToken: string,
  dto: ChangePasswordRequest,
): Promise<void> => {
  await apiCall<{ message: string }>('PATCH', '/ext-auth/change-password', authHeader(accessToken), dto);
};

// ============================================================
// 710.외부접근 API
// ============================================================

/**
 * 나에게 공유된 파일 목록
 */
export const getMyShares = async (
  accessToken: string,
  params?: PaginationParams,
): Promise<PaginatedResponse<PublicShare>> => {
  const response = await apiCall<PaginatedResponse<PublicShare>>(
    'GET',
    '/file-shares-requests/me',
    { ...authHeader(accessToken), params },
  );
  return response.data;
};

/**
 * 공유 상세 조회 + 콘텐츠 토큰 발급
 */
export const getShareDetail = async (
  accessToken: string,
  shareId: string,
): Promise<ShareDetailResponse> => {
  const response = await apiCall<ShareDetailResponse>(
    'GET',
    `/file-shares-requests/${shareId}`,
    authHeader(accessToken),
  );
  return response.data;
};

/**
 * 파일 콘텐츠 조회 (뷰어용)
 */
export const getContent = async (
  accessToken: string,
  shareId: string,
  contentToken: string,
): Promise<Blob> => {
  const response = await axios.get(`${API_BASE}/file-shares-requests/${shareId}/content`, {
    ...authHeader(accessToken),
    params: { token: contentToken },
    responseType: 'blob',
  });
  return response.data;
};

/**
 * 파일 다운로드 (기본)
 */
export const downloadFile = async (
  accessToken: string,
  shareId: string,
  contentToken: string,
): Promise<{ blob: Blob; filename: string }> => {
  const response = await axios.get(`${API_BASE}/file-shares-requests/${shareId}/download`, {
    ...authHeader(accessToken),
    params: { token: contentToken },
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
};

// ============================================================
// 711.외부접근 다운로드 (Range Request 지원)
// ============================================================

/**
 * 파일 다운로드 (메타데이터 포함)
 * ETag, 체크섬 등 응답 헤더 정보를 포함하여 반환
 */
export const downloadFileWithMetadata = async (
  accessToken: string,
  shareId: string,
  contentToken: string,
): Promise<ExtDownloadResponse> => {
  const response = await axios.get(`${API_BASE}/file-shares-requests/${shareId}/download`, {
    ...authHeader(accessToken),
    params: { token: contentToken },
    responseType: 'blob',
  });

  // 파일명 추출
  const contentDisposition = response.headers['content-disposition'];
  let filename = 'download';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
    if (filenameMatch) {
      filename = decodeURIComponent(filenameMatch[1]);
    }
  }

  // ETag 추출
  const etagHeader = response.headers['etag'];
  const etag = etagHeader ? etagHeader.replace(/"/g, '') : undefined;

  // 체크섬 추출
  const checksum = response.headers['x-checksum-sha256'];

  // Content-Length
  const contentLength = parseInt(response.headers['content-length'] || '0');

  return {
    blob: response.data,
    filename,
    etag,
    checksum,
    totalSize: contentLength || response.data.size,
    isPartial: false,
  };
};

/**
 * 부분 다운로드 (Range 요청)
 */
export const downloadFileWithRange = async (
  accessToken: string,
  shareId: string,
  contentToken: string,
  options: ExtRangeDownloadOptions,
): Promise<ExtDownloadResponse> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  // Range 헤더 구성
  if (options.start !== undefined || options.end !== undefined) {
    const start = options.start ?? '';
    const end = options.end ?? '';
    headers['Range'] = `bytes=${start}-${end}`;
  }

  // If-Range 헤더
  if (options.ifRange) {
    headers['If-Range'] = `"${options.ifRange}"`;
  }

  const response = await axios.get(`${API_BASE}/file-shares-requests/${shareId}/download`, {
    headers,
    params: { token: contentToken },
    responseType: 'blob',
    validateStatus: (status) => status === 200 || status === 206 || status === 416,
  });

  // 416 처리
  if (response.status === 416) {
    throw new Error(`Range not satisfiable: ${response.headers['content-range'] || 'unknown'}`);
  }

  // 파일명 추출
  const contentDisposition = response.headers['content-disposition'];
  let filename = 'download';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
    if (filenameMatch) {
      filename = decodeURIComponent(filenameMatch[1]);
    }
  }

  // 메타데이터 추출
  const etagHeader = response.headers['etag'];
  const etag = etagHeader ? etagHeader.replace(/"/g, '') : undefined;
  const checksum = response.headers['x-checksum-sha256'];

  // Content-Range 파싱
  let contentRange: ExtContentRange | undefined;
  let totalSize = response.data.size;

  if (response.status === 206) {
    const contentRangeHeader = response.headers['content-range'];
    if (contentRangeHeader) {
      const match = contentRangeHeader.match(/bytes (\d+)-(\d+)\/(\d+)/);
      if (match) {
        contentRange = {
          start: parseInt(match[1]),
          end: parseInt(match[2]),
          total: parseInt(match[3]),
        };
        totalSize = contentRange.total;
      }
    }
  }

  return {
    blob: response.data,
    filename,
    etag,
    checksum,
    totalSize,
    isPartial: response.status === 206,
    contentRange,
  };
};

/**
 * 진행률 추적 다운로드
 */
export const downloadFileWithProgress = async (
  accessToken: string,
  shareId: string,
  contentToken: string,
  onProgress: (percent: number, downloadedBytes: number, totalBytes: number) => void,
): Promise<ExtDownloadResponse> => {
  const url = `${API_BASE}/file-shares-requests/${shareId}/download?token=${encodeURIComponent(contentToken)}`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  // 파일명 추출
  const contentDisposition = response.headers.get('content-disposition');
  let filename = 'download';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
    if (filenameMatch) {
      filename = decodeURIComponent(filenameMatch[1]);
    }
  }

  // 메타데이터 추출
  const etagHeader = response.headers.get('etag');
  const etag = etagHeader ? etagHeader.replace(/"/g, '') : undefined;
  const checksum = response.headers.get('x-checksum-sha256') || undefined;
  const contentLength = parseInt(response.headers.get('content-length') || '0');

  if (!response.body) {
    throw new Error('Response body is not readable');
  }

  // ReadableStream으로 진행률 추적
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    const percent = contentLength > 0 
      ? Math.round((receivedLength / contentLength) * 100) 
      : 0;
    onProgress(percent, receivedLength, contentLength);
  }

  const blob = new Blob(chunks);

  return {
    blob,
    filename,
    etag,
    checksum,
    totalSize: contentLength || blob.size,
    isPartial: false,
  };
};

/**
 * 이어받기 (Resume Download)
 * 주의: contentToken은 일회용이므로 이어받기 전에 새 토큰 발급 필요
 */
export const resumeDownload = async (
  accessToken: string,
  shareId: string,
  contentToken: string,
  progress: ExtDownloadProgress,
  onProgress?: (percent: number, downloadedBytes: number, totalBytes: number) => void,
): Promise<{ blob: Blob; isRestarted: boolean; etag: string; checksum?: string }> => {
  const url = `${API_BASE}/file-shares-requests/${shareId}/download?token=${encodeURIComponent(contentToken)}`;
  
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Range: `bytes=${progress.downloadedSize}-`,
  };

  if (progress.etag) {
    headers['If-Range'] = `"${progress.etag}"`;
  }

  const response = await fetch(url, { headers });

  const etagHeader = response.headers.get('etag');
  const etag = etagHeader ? etagHeader.replace(/"/g, '') : progress.etag;
  const checksum = response.headers.get('x-checksum-sha256') || undefined;

  // 200: 파일 변경됨 → 처음부터
  if (response.status === 200) {
    const contentLength = parseInt(response.headers.get('content-length') || '0');

    if (!response.body) {
      const blob = await response.blob();
      return { blob, isRestarted: true, etag, checksum };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedLength += value.length;
      if (onProgress) {
        const percent = contentLength > 0 
          ? Math.round((receivedLength / contentLength) * 100) 
          : 0;
        onProgress(percent, receivedLength, contentLength);
      }
    }

    return { blob: new Blob(chunks), isRestarted: true, etag, checksum };
  }

  // 206: 이어받기 성공
  if (response.status === 206) {
    const contentRangeHeader = response.headers.get('content-range');
    let totalSize = progress.totalSize;

    if (contentRangeHeader) {
      const match = contentRangeHeader.match(/bytes (\d+)-(\d+)\/(\d+)/);
      if (match) {
        totalSize = parseInt(match[3]);
      }
    }

    if (!response.body) {
      const newChunk = await response.blob();
      const allChunks = [...progress.chunks, newChunk];
      return { blob: new Blob(allChunks), isRestarted: false, etag, checksum };
    }

    const reader = response.body.getReader();
    const newChunks: Uint8Array[] = [];
    let receivedLength = progress.downloadedSize;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      newChunks.push(value);
      receivedLength += value.length;
      if (onProgress) {
        const percent = Math.round((receivedLength / totalSize) * 100);
        onProgress(percent, receivedLength, totalSize);
      }
    }

    const existingBlobs = progress.chunks;
    const newBlob = new Blob(newChunks);
    const allChunks = [...existingBlobs, newBlob];

    return { blob: new Blob(allChunks), isRestarted: false, etag, checksum };
  }

  if (response.status === 416) {
    throw new Error('Range not satisfiable - file may have changed');
  }

  throw new Error(`Unexpected response: ${response.status}`);
};

/**
 * 콘텐츠 조회 (메타데이터 포함, 뷰어용)
 */
export const getContentWithMetadata = async (
  accessToken: string,
  shareId: string,
  contentToken: string,
): Promise<ExtDownloadResponse> => {
  const response = await axios.get(`${API_BASE}/file-shares-requests/${shareId}/content`, {
    ...authHeader(accessToken),
    params: { token: contentToken },
    responseType: 'blob',
  });

  const etagHeader = response.headers['etag'];
  const etag = etagHeader ? etagHeader.replace(/"/g, '') : undefined;
  const checksum = response.headers['x-checksum-sha256'];
  const contentLength = parseInt(response.headers['content-length'] || '0');

  return {
    blob: response.data,
    filename: '',
    etag,
    checksum,
    totalSize: contentLength || response.data.size,
    isPartial: false,
  };
};

// Export all functions as object for convenience
export const externalShareApi = {
  login,
  refreshToken,
  logout,
  changePassword,
  getMyShares,
  getShareDetail,
  getContent,
  downloadFile,
  downloadFileWithMetadata,
  downloadFileWithRange,
  downloadFileWithProgress,
  resumeDownload,
  getContentWithMetadata,
  setLogCallback,
};
