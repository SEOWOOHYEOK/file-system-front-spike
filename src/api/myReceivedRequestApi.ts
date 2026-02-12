/**
 * 702. 내가 받은 공유 요청 관리 API Client
 * 승인자(designatedApproverId)로 지정된 사용자가
 * 자신에게 할당된 공유 요청을 조회/승인/반려하는 API
 *
 * Base: /v1/file-shares-requests/received
 */
import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: '/v1',
  headers: { 'Content-Type': 'application/json' },
});

// ─── 타입 정의 ───

/** 공유 요청 상태 */
export type ShareRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';

/** 공유 대상 타입 */
export type ShareTargetType = 'INTERNAL_USER' | 'EXTERNAL_USER';

/** 공유 권한 타입 */
export type SharePermissionType = 'VIEW' | 'DOWNLOAD';

/** 공유 대상 */
export interface ShareTarget {
  type: ShareTargetType;
  userId: string;
}

/** 공유 권한 */
export interface Permission {
  type: SharePermissionType;
  maxDownloads?: number;
}

/** 파일 상세 정보 */
export interface FileDetail {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/** 내부 사용자 상세 정보 */
export interface InternalUserDetail {
  type: 'INTERNAL_USER';
  userId: string;
  name: string;
  email: string;
  department: string;
  position?: string;
}

/** 대상자 상세 정보 (사용자 정보 포함) */
export interface EnrichedShareTarget {
  type: ShareTargetType;
  userId: string;
  userDetail?: InternalUserDetail;
}

/** 받은 공유 요청 목록 조회 쿼리 파라미터 */
export interface ReceivedRequestQuery {
  status?: ShareRequestStatus;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 승인 요청 body */
export interface ApproveReceivedRequest {
  comment?: string;
}

/** 반려 요청 body */
export interface RejectReceivedRequest {
  comment: string;
}

/** 공유 요청 응답 (모든 엔드포인트 공통) */
export interface ShareRequestResponse {
  id: string;
  status: ShareRequestStatus;
  fileIds: string[];
  files?: FileDetail[];
  requesterId: string;
  requesterDetail?: InternalUserDetail;
  targets: ShareTarget[];
  targetDetails?: EnrichedShareTarget[];
  permission: Permission;
  startAt: string;
  endAt: string;
  reason: string;
  designatedApproverId: string;
  designatedApproverDetail?: InternalUserDetail;
  approverId?: string;
  approverDetail?: InternalUserDetail;
  decidedAt?: string;
  decisionComment?: string;
  isAutoApproved: boolean;
  publicShareIds: string[];
  requestedAt: string;
}

/** 페이지네이션 응답 */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ─── API 호출 래퍼 ───

async function apiCall<T>(
  method: string,
  url: string,
  token: string,
  data?: unknown,
  params?: Record<string, unknown>,
): Promise<T> {
  try {
    const response = await api.request<T>({
      method,
      url,
      data,
      params,
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

export const myReceivedRequestApi = {
  /**
   * 받은 공유 요청 목록 조회
   * GET /v1/file-shares-requests/received
   */
  getList: (
    token: string,
    query?: ReceivedRequestQuery,
  ): Promise<PaginatedResponse<ShareRequestResponse>> => {
    const params: Record<string, unknown> = {};
    if (query?.status) params.status = query.status;
    if (query?.page) params.page = query.page;
    if (query?.pageSize) params.pageSize = query.pageSize;
    if (query?.sortBy) params.sortBy = query.sortBy;
    if (query?.sortOrder) params.sortOrder = query.sortOrder;
    return apiCall<PaginatedResponse<ShareRequestResponse>>(
      'GET',
      '/file-shares-requests/received',
      token,
      undefined,
      params,
    );
  },

  /**
   * 받은 공유 요청 상세 조회
   * GET /v1/file-shares-requests/received/:id
   */
  getDetail: (
    token: string,
    id: string,
  ): Promise<ShareRequestResponse> =>
    apiCall<ShareRequestResponse>('GET', `/file-shares-requests/received/${id}`, token),

  /**
   * 받은 공유 요청 승인
   * POST /v1/file-shares-requests/received/:id/approve
   */
  approve: (
    token: string,
    id: string,
    data?: ApproveReceivedRequest,
  ): Promise<ShareRequestResponse> =>
    apiCall<ShareRequestResponse>(
      'POST',
      `/file-shares-requests/received/${id}/approve`,
      token,
      data || {},
    ),

  /**
   * 받은 공유 요청 반려
   * POST /v1/file-shares-requests/received/:id/reject
   */
  reject: (
    token: string,
    id: string,
    data: RejectReceivedRequest,
  ): Promise<ShareRequestResponse> =>
    apiCall<ShareRequestResponse>(
      'POST',
      `/file-shares-requests/received/${id}/reject`,
      token,
      data,
    ),
};
