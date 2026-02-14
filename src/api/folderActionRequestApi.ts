/**
 * Folder Action Request API Client
 * 폴더 작업 요청 (이동 요청 → 승인 → 실행) API
 */
import axios from 'axios';
import type {
  FolderActionRequestResponse,
  PaginatedFileActionResponse,
  CreateFolderMoveRequest,
  ApproveRequest,
  RejectRequest,
  BulkApproveRequest,
  BulkRejectRequest,
  FolderAdminRequestsQuery,
  StatusSummary,
  ApproverUser,
  MyRequestsQuery,
  FolderActionType,
} from '../types/file-action-request.types';

const api = axios.create({
  baseURL: '/v1',
});

/** 폴더 내 요청 목록 쿼리 (type은 FOLDER_MOVE만) */
type FolderMyRequestsQuery = Omit<MyRequestsQuery, 'type'> & {
  type?: FolderActionType;
};

// ============================================
// 요청자 API (일반 사용자)
// ============================================

export const folderActionRequestApi = {
  /**
   * 폴더 이동 요청 생성
   * POST /v1/folder-action-requests/move
   */
  createMoveRequest: async (
    token: string,
    data: CreateFolderMoveRequest,
  ): Promise<FolderActionRequestResponse> => {
    const response = await api.post('/folder-action-requests/move', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  /**
   * 내 폴더 요청 목록 조회
   * GET /v1/folder-action-requests/my
   */
  getMyRequests: async (
    token: string,
    query: FolderMyRequestsQuery = {},
  ): Promise<PaginatedFileActionResponse<FolderActionRequestResponse>> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    if (query.sortBy) params.set('sortBy', query.sortBy);
    if (query.sortOrder) params.set('sortOrder', query.sortOrder);
    if (query.status) params.set('status', query.status);
    if (query.type) params.set('type', query.type);
    if (query.role) params.set('role', query.role);

    const response = await api.get(`/folder-action-requests/my?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  /**
   * 승인자 후보 목록 조회
   * GET /v1/folder-action-requests/approvers
   */
  getApprovers: async (token: string): Promise<ApproverUser[]> => {
    const response = await api.get('/folder-action-requests/approvers', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  /**
   * 요청 상세 조회
   * GET /v1/folder-action-requests/:id
   */
  getRequestDetail: async (
    token: string,
    id: string,
  ): Promise<FolderActionRequestResponse | null> => {
    try {
      const response = await api.get(`/folder-action-requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * 요청 취소
   * POST /v1/folder-action-requests/:id/cancel
   */
  cancelRequest: async (
    token: string,
    id: string,
  ): Promise<FolderActionRequestResponse> => {
    const response = await api.post(`/folder-action-requests/${id}/cancel`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};

// ============================================
// 관리자 API (Manager/Admin)
// ============================================

export const folderActionRequestAdminApi = {
  /**
   * 전체 폴더 요청 목록 조회 (필터)
   * GET /v1/admin/folder-action-requests
   */
  getAllRequests: async (
    token: string,
    query: FolderAdminRequestsQuery = {},
  ): Promise<PaginatedFileActionResponse<FolderActionRequestResponse>> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });

    const response = await api.get(`/admin/folder-action-requests?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  /**
   * 상태별 요약
   * GET /v1/admin/folder-action-requests/summary
   */
  getSummary: async (token: string): Promise<StatusSummary> => {
    const response = await api.get('/admin/folder-action-requests/summary', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  /**
   * 내 승인 대기 목록
   * GET /v1/admin/folder-action-requests/my-pending
   */
  getMyPendingApprovals: async (
    token: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedFileActionResponse<FolderActionRequestResponse>> => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    const response = await api.get(`/admin/folder-action-requests/my-pending?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  /**
   * 요청 상세 조회 (Admin)
   * GET /v1/admin/folder-action-requests/:id
   */
  getRequestDetail: async (
    token: string,
    id: string,
  ): Promise<FolderActionRequestResponse | null> => {
    try {
      const response = await api.get(`/admin/folder-action-requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * 요청 승인
   * POST /v1/admin/folder-action-requests/:id/approve
   */
  approveRequest: async (
    token: string,
    id: string,
    data: ApproveRequest = {},
  ): Promise<FolderActionRequestResponse> => {
    const response = await api.post(`/admin/folder-action-requests/${id}/approve`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  /**
   * 요청 반려
   * POST /v1/admin/folder-action-requests/:id/reject
   */
  rejectRequest: async (
    token: string,
    id: string,
    data: RejectRequest,
  ): Promise<FolderActionRequestResponse> => {
    const response = await api.post(`/admin/folder-action-requests/${id}/reject`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  /**
   * 일괄 승인
   * POST /v1/admin/folder-action-requests/bulk-approve
   */
  bulkApprove: async (
    token: string,
    data: BulkApproveRequest,
  ): Promise<FolderActionRequestResponse[]> => {
    const response = await api.post('/admin/folder-action-requests/bulk-approve', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  /**
   * 일괄 반려
   * POST /v1/admin/folder-action-requests/bulk-reject
   */
  bulkReject: async (
    token: string,
    data: BulkRejectRequest,
  ): Promise<FolderActionRequestResponse[]> => {
    const response = await api.post('/admin/folder-action-requests/bulk-reject', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};
