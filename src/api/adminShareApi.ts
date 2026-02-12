/**
 * 805. 관리자 - 파일 공유 관리 API Client
 *
 * Base: /v1/admin/shares
 *
 * API:
 *  GET    /v1/admin/shares                              전체 공유 현황 조회
 *  GET    /v1/admin/shares/:id                          공유 상세 조회
 *  PATCH  /v1/admin/shares/:id/block                    공유 차단
 *  PATCH  /v1/admin/shares/:id/unblock                  차단 해제
 *  GET    /v1/admin/shares/files/:fileId                특정 파일의 공유 목록 조회
 *  PATCH  /v1/admin/shares/files/:fileId/block-all      특정 파일의 모든 공유 일괄 차단
 *  PATCH  /v1/admin/shares/files/:fileId/unblock-all    특정 파일의 모든 공유 일괄 차단 해제
 *  PATCH  /v1/admin/shares/external-users/:userId/block-all  특정 외부 사용자의 모든 공유 일괄 차단
 */
import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: '/v1',
  headers: { 'Content-Type': 'application/json' },
});

// ─── 타입 정의 ───

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 공유 목록 필터 쿼리 (관리자) */
export interface AdminShareFilterQuery extends PaginationQuery {
  /** 공유자 이름 (부분 일치) */
  ownerName?: string;
  /** 공유자 부서 (부분 일치) */
  ownerDepartment?: string;
  /** 공유받은 사람 이름 (부분 일치) */
  recipientName?: string;
  /** 공유받은 사람 부서 (부분 일치) */
  recipientDepartment?: string;
  /** 파일명 (부분 일치) */
  fileName?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** 파일 정보 (중첩용) */
export interface ShareFileInfo {
  /** 파일 ID (UUID) */
  fileId: string;
  /** 파일명 */
  fileName: string;
  /** 파일 크기 (bytes) */
  fileSize: number;
  /** MIME 타입 */
  mimeType: string;
  /** 파일 생성자(업로더) ID (UUID) */
  createdBy: string;
}

/** 외부 사용자 정보 (중첩용) */
export interface ShareExternalUserInfo {
  /** 외부 사용자 ID (UUID) */
  externalUserId: string;
  /** 이름 */
  name: string;
  /** 소속(회사) */
  company?: string;
  /** 부서 */
  department?: string;
}

/** 공유 목록 아이템 (전체 현황 조회용 - 관리자) */
export interface AdminShareListItem {
  id: string;
  ownerId: string;
  /** 공유자 이름 */
  ownerName: string;
  /** 공유자 부서 */
  ownerDepartment?: string;
  fileInfo: ShareFileInfo;
  externalUser: ShareExternalUserInfo;
  permissions: string[];
  currentViewCount: number;
  currentDownloadCount: number;
  expiresAt?: string;
  isBlocked: boolean;
  isRevoked: boolean;
  createdAt: string;
}

/** 공유 상세 (관리자용) */
export interface AdminShareDetail {
  id: string;
  ownerId: string;
  fileInfo: ShareFileInfo;
  externalUser: ShareExternalUserInfo;
  permissions: string[];
  maxViewCount?: number;
  currentViewCount: number;
  maxDownloadCount?: number;
  currentDownloadCount: number;
  expiresAt?: string;
  isBlocked: boolean;
  blockedAt?: string;
  blockedBy?: string;
  isRevoked: boolean;
  createdAt: string;
  updatedAt?: string;
}

/** 공유 차단/해제 응답 */
export interface ShareBlockResponse {
  id: string;
  isBlocked: boolean;
  blockedAt?: string;
  blockedBy?: string;
}

/** 일괄 차단 응답 */
export interface BulkBlockResponse {
  blockedCount: number;
}

/** 일괄 차단 해제 응답 */
export interface BulkUnblockResponse {
  unblockedCount: number;
}

// ─── API 호출 래퍼 ───

async function apiRequest<T>(
  method: 'GET' | 'PATCH',
  url: string,
  token: string,
  params?: Record<string, unknown>,
): Promise<T> {
  try {
    const response = await api.request<T>({
      method,
      url,
      params: method === 'GET' ? params : undefined,
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message: string | string[]; error: string }>;
      const message = axiosError.response?.data?.message;
      const errorMessage = Array.isArray(message) ? message.join(', ') : message || axiosError.message;
      throw new Error(errorMessage);
    }
    throw error;
  }
}

// ─── API 함수들 ───

export const adminShareApi = {
  /**
   * 전체 공유 현황 조회 (필터링 지원)
   * GET /v1/admin/shares
   */
  getAll: (token: string, query?: AdminShareFilterQuery): Promise<PaginatedResponse<AdminShareListItem>> => {
    const params: Record<string, unknown> = {};
    // 페이지네이션
    if (query?.page) params.page = query.page;
    if (query?.pageSize) params.pageSize = query.pageSize;
    if (query?.sortBy) params.sortBy = query.sortBy;
    if (query?.sortOrder) params.sortOrder = query.sortOrder;
    // 필터
    if (query?.ownerName) params.ownerName = query.ownerName;
    if (query?.ownerDepartment) params.ownerDepartment = query.ownerDepartment;
    if (query?.recipientName) params.recipientName = query.recipientName;
    if (query?.recipientDepartment) params.recipientDepartment = query.recipientDepartment;
    if (query?.fileName) params.fileName = query.fileName;
    return apiRequest<PaginatedResponse<AdminShareListItem>>('GET', '/admin/shares', token, params);
  },

  /**
   * 공유 상세 조회
   * GET /v1/admin/shares/:id
   */
  getById: (token: string, id: string): Promise<AdminShareDetail> =>
    apiRequest<AdminShareDetail>('GET', `/admin/shares/${id}`, token),

  /**
   * 공유 차단
   * PATCH /v1/admin/shares/:id/block
   */
  block: (token: string, id: string): Promise<ShareBlockResponse> =>
    apiRequest<ShareBlockResponse>('PATCH', `/admin/shares/${id}/block`, token),

  /**
   * 차단 해제
   * PATCH /v1/admin/shares/:id/unblock
   */
  unblock: (token: string, id: string): Promise<ShareBlockResponse> =>
    apiRequest<ShareBlockResponse>('PATCH', `/admin/shares/${id}/unblock`, token),

  /**
   * 특정 파일의 공유 목록 조회
   * GET /v1/admin/shares/files/:fileId
   */
  getByFile: (token: string, fileId: string): Promise<AdminShareDetail[]> =>
    apiRequest<AdminShareDetail[]>('GET', `/admin/shares/files/${fileId}`, token),

  /**
   * 특정 파일의 모든 공유 일괄 차단
   * PATCH /v1/admin/shares/files/:fileId/block-all
   */
  blockAllByFile: (token: string, fileId: string): Promise<BulkBlockResponse> =>
    apiRequest<BulkBlockResponse>('PATCH', `/admin/shares/files/${fileId}/block-all`, token),

  /**
   * 특정 파일의 모든 공유 일괄 차단 해제
   * PATCH /v1/admin/shares/files/:fileId/unblock-all
   */
  unblockAllByFile: (token: string, fileId: string): Promise<BulkUnblockResponse> =>
    apiRequest<BulkUnblockResponse>('PATCH', `/admin/shares/files/${fileId}/unblock-all`, token),

  /**
   * 특정 외부 사용자의 모든 공유 일괄 차단
   * PATCH /v1/admin/shares/external-users/:userId/block-all
   */
  blockAllByExternalUser: (token: string, userId: string): Promise<BulkBlockResponse> =>
    apiRequest<BulkBlockResponse>('PATCH', `/admin/shares/external-users/${userId}/block-all`, token),
};
