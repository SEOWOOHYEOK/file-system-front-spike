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
    '/ext/shares',
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
    `/ext/shares/${shareId}`,
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
  const response = await axios.get(`${API_BASE}/ext/shares/${shareId}/content`, {
    ...authHeader(accessToken),
    params: { token: contentToken },
    responseType: 'blob',
  });
  return response.data;
};

/**
 * 파일 다운로드
 */
export const downloadFile = async (
  accessToken: string,
  shareId: string,
  contentToken: string,
): Promise<{ blob: Blob; filename: string }> => {
  const response = await axios.get(`${API_BASE}/ext/shares/${shareId}/download`, {
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
  setLogCallback,
};
