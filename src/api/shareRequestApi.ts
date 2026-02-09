/**
 * Share Request API Client
 * 700.공유요청 / 520.관리자-공유요청
 */
import axios, { AxiosError } from 'axios';
import type {
  CheckAvailabilityRequest,
  CheckAvailabilityResponse,
  CreateShareRequestRequest,
  ShareRequestResponse,
  ShareRequestSummary,
  ShareRequestAdminDetail,
  ApproveRequest,
  RejectRequest,
  BulkApproveRequest,
  BulkRejectRequest,
  BulkDecisionResponse,
  SharesByTargetResponse,
  SharesByFileResponse,
  PaginatedResponse,
  MyShareRequestListQuery,
  AdminShareRequestListQuery,
} from '../types/share-request.types';

const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API 호출 래퍼
async function apiCall<T>(
  method: string,
  url: string,
  token?: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  try {
    const response = await api.request<T>({
      method,
      url,
      data,
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
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

// ============================================
// 700.공유요청 - 요청자용 API
// ============================================

export const shareRequestApi = {
  /**
   * R-0: 가용성 확인
   * POST /v1/share-requests/check-availability
   */
  checkAvailability: (
    token: string,
    data: CheckAvailabilityRequest
  ): Promise<CheckAvailabilityResponse> =>
    apiCall<CheckAvailabilityResponse>('POST', '/share-requests/check-availability', token, data),

  /**
   * R-1: 공유 요청 생성
   * POST /v1/share-requests
   */
  create: (
    token: string,
    data: CreateShareRequestRequest
  ): Promise<ShareRequestResponse> =>
    apiCall<ShareRequestResponse>('POST', '/share-requests', token, data),

  /**
   * R-2: 내 공유 요청 목록
   * GET /v1/share-requests/my
   */
  getMyRequests: (
    token: string,
    query?: MyShareRequestListQuery
  ): Promise<PaginatedResponse<ShareRequestResponse>> =>
    apiCall<PaginatedResponse<ShareRequestResponse>>(
      'GET',
      '/share-requests/my',
      token,
      undefined,
      query as Record<string, unknown>
    ),

  /**
   * R-3: 내 공유 요청 상세 조회
   * GET /v1/share-requests/my/:id
   */
  getMyRequestDetail: (
    token: string,
    id: string
  ): Promise<ShareRequestResponse> =>
    apiCall<ShareRequestResponse>('GET', `/share-requests/my/${id}`, token),

  /**
   * R-4: 내 공유 요청 취소
   * POST /v1/share-requests/my/:id/cancel
   */
  cancelMyRequest: (
    token: string,
    id: string
  ): Promise<ShareRequestResponse> =>
    apiCall<ShareRequestResponse>('POST', `/share-requests/my/${id}/cancel`, token),
};

// ============================================
// 520.관리자-공유요청 - 관리자용 API
// ============================================

export const adminShareRequestApi = {
  /**
   * A-1: 상태별 카운트 조회
   * GET /v1/admin/share-requests/summary
   */
  getSummary: (token: string): Promise<ShareRequestSummary> =>
    apiCall<ShareRequestSummary>('GET', '/admin/share-requests/summary', token),

  /**
   * A-2: 공유 요청 목록 조회
   * GET /v1/admin/share-requests
   */
  getList: (
    token: string,
    query: AdminShareRequestListQuery
  ): Promise<PaginatedResponse<ShareRequestResponse>> => {
    const params: Record<string, unknown> = { ...query };
    return apiCall<PaginatedResponse<ShareRequestResponse>>(
      'GET',
      '/admin/share-requests',
      token,
      undefined,
      params
    );
  },

  /**
   * A-3: 공유 요청 상세 조회
   * GET /v1/admin/share-requests/:id
   */
  getDetail: (
    token: string,
    id: string
  ): Promise<ShareRequestAdminDetail> =>
    apiCall<ShareRequestAdminDetail>('GET', `/admin/share-requests/${id}`, token),

  /**
   * A-4: 단건 승인
   * POST /v1/admin/share-requests/:id/approve
   */
  approve: (
    token: string,
    id: string,
    data?: ApproveRequest
  ): Promise<ShareRequestResponse> =>
    apiCall<ShareRequestResponse>('POST', `/admin/share-requests/${id}/approve`, token, data || {}),

  /**
   * A-5: 단건 반려
   * POST /v1/admin/share-requests/:id/reject
   */
  reject: (
    token: string,
    id: string,
    data: RejectRequest
  ): Promise<ShareRequestResponse> =>
    apiCall<ShareRequestResponse>('POST', `/admin/share-requests/${id}/reject`, token, data),

  /**
   * A-6: 일괄 승인
   * POST /v1/admin/share-requests/bulk-approve
   */
  bulkApprove: (
    token: string,
    data: BulkApproveRequest
  ): Promise<BulkDecisionResponse> =>
    apiCall<BulkDecisionResponse>('POST', '/admin/share-requests/bulk-approve', token, data),

  /**
   * A-7: 일괄 반려
   * POST /v1/admin/share-requests/bulk-reject
   */
  bulkReject: (
    token: string,
    data: BulkRejectRequest
  ): Promise<BulkDecisionResponse> =>
    apiCall<BulkDecisionResponse>('POST', '/admin/share-requests/bulk-reject', token, data),

  /**
   * Q-1: 대상자별 공유 조회
   * GET /v1/admin/share-requests/by-target/:userId
   */
  getByTarget: (
    token: string,
    userId: string,
    query?: { page?: number; pageSize?: number }
  ): Promise<SharesByTargetResponse> =>
    apiCall<SharesByTargetResponse>(
      'GET',
      `/admin/share-requests/by-target/${userId}`,
      token,
      undefined,
      query as Record<string, unknown>
    ),

  /**
   * Q-2: 파일별 공유 조회
   * GET /v1/admin/share-requests/by-file/:fileId
   */
  getByFile: (
    token: string,
    fileId: string,
    query?: { page?: number; pageSize?: number }
  ): Promise<SharesByFileResponse> =>
    apiCall<SharesByFileResponse>(
      'GET',
      `/admin/share-requests/by-file/${fileId}`,
      token,
      undefined,
      query as Record<string, unknown>
    ),
};
