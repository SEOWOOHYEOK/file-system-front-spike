/**
 * Admin API Client
 * 100.인증, 500.관리자, 510.관리자-공유, 520.관리자-외부사용자, 600.외부공유
 */
import axios, { AxiosError } from 'axios';
import type {
  LoginResponse,
  RefreshTokenResponse,
  CacheHealthResponse,
  NasHealthResponse,
  StorageConsistencyQuery,
  StorageConsistencyResponse,
  SyncEventsResponse,
  AdminSharesResponse,
  AdminShareDetailResponse,
  SharedFilesResponse,
  FileSharesResponse,
  ExternalUsersResponse,
  ExternalUser,
  CreateExternalUserDto,
  UpdateExternalUserDto,
  ResetPasswordResponse,
  CreateFileShareDto,
  FileShare,
  FileSharesListResponse,
  AvailableExternalUsersResponse,
  AdminApiLogEntry,
} from '../types/admin.types';

const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API 로그 콜백
let logCallback: ((log: AdminApiLogEntry) => void) | null = null;

export function setAdminLogCallback(callback: ((log: AdminApiLogEntry) => void) | null) {
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
  const logEntry: AdminApiLogEntry = {
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
// 100.인증 (Internal SSO Auth)
// ============================================

export const authApi = {
  /**
   * SSO 로그인
   */
  login: (email: string, password: string): Promise<LoginResponse> =>
    apiCall<LoginResponse>('POST', '/auth/login', undefined, { email, password }),

  /**
   * SSO 토큰 갱신
   */
  refreshToken: (refreshToken: string): Promise<RefreshTokenResponse> =>
    apiCall<RefreshTokenResponse>('POST', '/auth/refresh-token', undefined, { refreshToken }),
};

// ============================================
// 500.관리자 (Admin System)
// ============================================

export const adminSystemApi = {
  /**
   * 캐시 스토리지 연결 상태 확인
   */
  getCacheHealth: (token: string): Promise<CacheHealthResponse> =>
    apiCall<CacheHealthResponse>('GET', '/admin/cache/health-check', token),

  /**
   * NAS 스토리지 연결 상태 및 용량 확인
   */
  getNasHealth: (token: string): Promise<NasHealthResponse> =>
    apiCall<NasHealthResponse>('GET', '/admin/nas/health-check', token),

  /**
   * 스토리지 일관성 검증
   * DB와 실제 스토리지 간의 일관성을 확인합니다.
   */
  getStorageConsistency: (
    token: string,
    query?: StorageConsistencyQuery
  ): Promise<StorageConsistencyResponse> =>
    apiCall<StorageConsistencyResponse>(
      'GET',
      '/admin/storage/consistency',
      token,
      undefined,
      query as Record<string, unknown>
    ),

  /**
   * 동기화 이벤트 조회
   */
  getSyncEvents: (token: string): Promise<SyncEventsResponse> =>
    apiCall<SyncEventsResponse>('GET', '/admin/sync/events', token),
};

// ============================================
// 510.관리자-공유 (Admin Share Management)
// ============================================

export const adminShareApi = {
  /**
   * 전체 공유 현황 조회
   */
  getShares: (token: string): Promise<AdminSharesResponse> =>
    apiCall<AdminSharesResponse>('GET', '/admin/shares', token),

  /**
   * 공유 상세 조회
   */
  getShareDetail: (token: string, id: string): Promise<AdminShareDetailResponse> =>
    apiCall<AdminShareDetailResponse>('GET', `/admin/shares/${id}`, token),

  /**
   * 공유 차단
   */
  blockShare: (token: string, id: string): Promise<{ success: boolean }> =>
    apiCall<{ success: boolean }>('PATCH', `/admin/shares/${id}/block`, token),

  /**
   * 차단 해제
   */
  unblockShare: (token: string, id: string): Promise<{ success: boolean }> =>
    apiCall<{ success: boolean }>('PATCH', `/admin/shares/${id}/unblock`, token),

  /**
   * 공유된 파일 목록 조회
   */
  getSharedFiles: (token: string): Promise<SharedFilesResponse> =>
    apiCall<SharedFilesResponse>('GET', '/admin/shares/shared-files', token),

  /**
   * 특정 파일의 공유 목록
   */
  getFileShares: (token: string, fileId: string): Promise<FileSharesResponse> =>
    apiCall<FileSharesResponse>('GET', `/admin/shares/files/${fileId}`, token),

  /**
   * 특정 파일의 모든 공유 일괄 차단
   */
  blockAllFileShares: (token: string, fileId: string): Promise<{ success: boolean; count: number }> =>
    apiCall<{ success: boolean; count: number }>('PATCH', `/admin/shares/files/${fileId}/block-all`, token),

  /**
   * 특정 파일의 모든 공유 일괄 차단 해제
   */
  unblockAllFileShares: (token: string, fileId: string): Promise<{ success: boolean; count: number }> =>
    apiCall<{ success: boolean; count: number }>('PATCH', `/admin/shares/files/${fileId}/unblock-all`, token),

  /**
   * 특정 외부 사용자의 모든 공유 일괄 차단
   */
  blockAllUserShares: (token: string, userId: string): Promise<{ success: boolean; count: number }> =>
    apiCall<{ success: boolean; count: number }>('PATCH', `/admin/shares/external-users/${userId}/block-all`, token),
};

// ============================================
// 520.관리자-외부사용자 (Admin External User)
// ============================================

export const adminExternalUserApi = {
  /**
   * 외부 사용자 생성
   */
  create: (token: string, data: CreateExternalUserDto): Promise<ExternalUser> =>
    apiCall<ExternalUser>('POST', '/admin/external-users', token, data),

  /**
   * 외부 사용자 목록 조회
   */
  getList: (token: string): Promise<ExternalUsersResponse> =>
    apiCall<ExternalUsersResponse>('GET', '/admin/external-users', token),

  /**
   * 외부 사용자 상세 조회
   */
  getDetail: (token: string, id: string): Promise<ExternalUser> =>
    apiCall<ExternalUser>('GET', `/admin/external-users/${id}`, token),

  /**
   * 외부 사용자 정보 수정
   */
  update: (token: string, id: string, data: UpdateExternalUserDto): Promise<ExternalUser> =>
    apiCall<ExternalUser>('PATCH', `/admin/external-users/${id}`, token, data),

  /**
   * 계정 비활성화
   */
  deactivate: (token: string, id: string): Promise<{ success: boolean }> =>
    apiCall<{ success: boolean }>('PATCH', `/admin/external-users/${id}/deactivate`, token),

  /**
   * 계정 활성화
   */
  activate: (token: string, id: string): Promise<{ success: boolean }> =>
    apiCall<{ success: boolean }>('PATCH', `/admin/external-users/${id}/activate`, token),

  /**
   * 비밀번호 초기화
   */
  resetPassword: (token: string, id: string): Promise<ResetPasswordResponse> =>
    apiCall<ResetPasswordResponse>('POST', `/admin/external-users/${id}/reset-password`, token),
};

// ============================================
// 600.외부공유 (File Share)
// ============================================

export const fileShareApi = {
  /**
   * 파일 외부공유 생성
   */
  create: (token: string, data: CreateFileShareDto): Promise<FileShare> =>
    apiCall<FileShare>('POST', '/file-shares', token, data),

  /**
   * 내가 생성한 공유 목록
   */
  getMyShares: (token: string): Promise<FileSharesListResponse> =>
    apiCall<FileSharesListResponse>('GET', '/file-shares', token),

  /**
   * 공유 상세 조회
   */
  getDetail: (token: string, id: string): Promise<FileShare> =>
    apiCall<FileShare>('GET', `/file-shares/${id}`, token),

  /**
   * 공유 취소
   */
  delete: (token: string, id: string): Promise<{ success: boolean }> =>
    apiCall<{ success: boolean }>('DELETE', `/file-shares/${id}`, token),

  /**
   * 공유 가능한 외부 사용자 목록
   */
  getAvailableExternalUsers: (token: string): Promise<AvailableExternalUsersResponse> =>
    apiCall<AvailableExternalUsersResponse>('GET', '/external-users', token),
};

// Export all APIs
export const adminApi = {
  auth: authApi,
  system: adminSystemApi,
  share: adminShareApi,
  externalUser: adminExternalUserApi,
  fileShare: fileShareApi,
};

export default adminApi;
