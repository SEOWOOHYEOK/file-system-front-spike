/**
 * File Share API Client
 * 600.나의 권한 / 700.공유 요청 생성 / 701.보낸 공유 관리 / 702.받은 요청 관리
 */
import apiClient from './apiClient';
import type {
  MyPermissionResponse,
  PaginatedResponse,
  ShareTargetUser,
  ApproverResponse,
  CheckAvailabilityRequest,
  CheckAvailabilityResponse,
  CreateShareRequestRequest,
  ShareRequestResponse,
  MySentShareRequestItem,
  MySentShareItem,
  PublicShareResponse,
  RevokeShareResponse,
  ApproveReceivedRequestBody,
  RejectReceivedRequestBody,
  ShareRequestStatus,
} from '../types/file-share.types';

// ─── Query parameter interfaces ───

export interface SearchUsersParams {
  type?: 'INTERNAL' | 'EXTERNAL';
  name?: string;
  department?: string;
  email?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchApproversParams {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface MySentShareRequestListParams {
  status?: ShareRequestStatus;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MySentShareListParams {
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReceivedRequestListParams {
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── 600. 나의 권한 ───

export const permissionApi = {
  getMyPermissions: async (): Promise<MyPermissionResponse> => {
    const { data } = await apiClient.get<MyPermissionResponse>('/users/me/permissions');
    return data;
  },
};

// ─── 700. 공유 요청 생성 ───

export const fileShareRequestApi = {
  searchUsers: async (params?: SearchUsersParams): Promise<PaginatedResponse<ShareTargetUser>> => {
    const { data } = await apiClient.get<PaginatedResponse<ShareTargetUser>>(
      '/file-shares-requests/users',
      { params },
    );
    return data;
  },

  searchApprovers: async (
    params?: SearchApproversParams,
  ): Promise<PaginatedResponse<ApproverResponse>> => {
    const { data } = await apiClient.get<PaginatedResponse<ApproverResponse>>(
      '/file-shares-requests/approvers',
      { params },
    );
    return data;
  },

  checkAvailability: async (
    body: CheckAvailabilityRequest,
  ): Promise<CheckAvailabilityResponse> => {
    const { data } = await apiClient.post<CheckAvailabilityResponse>(
      '/file-shares-requests/requests/check-availability',
      body,
    );
    return data;
  },

  create: async (body: CreateShareRequestRequest): Promise<ShareRequestResponse> => {
    const { data } = await apiClient.post<ShareRequestResponse>(
      '/file-shares-requests/requests',
      body,
    );
    return data;
  },
};

// ─── 701-A. 내가 보낸 결제 요청 관리 (ShareRequest) ───
// API Guide: api-guide-701a-my-sent-share-request
// GET  /v1/file-shares-requests/my-sent-requests           → 결제 요청 목록 조회
// POST /v1/file-shares-requests/my-sent-requests/:id/cancel → 결제 요청 취소

export const mySentShareRequestApi = {
  /** 결제 요청 목록 조회 (status: PENDING | APPROVED | REJECTED | CANCELED) */
  getList: async (
    params?: MySentShareRequestListParams,
  ): Promise<PaginatedResponse<MySentShareRequestItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<MySentShareRequestItem>>(
      '/file-shares-requests/my-sent-requests',
      { params },
    );
    return data;
  },

  /** 결제 요청 취소 (PENDING → CANCELED) */
  cancel: async (id: string): Promise<ShareRequestResponse> => {
    const { data } = await apiClient.post<ShareRequestResponse>(
      `/file-shares-requests/my-sent-requests/${id}/cancel`,
    );
    return data;
  },
};

// ─── 701-B. 내가 보낸 공유 관리 (PublicShare) ───
// API Guide: api-guide-701b-my-sent-share
// GET  /v1/file-shares/my-shares          → 공유 목록 조회
// GET  /v1/file-shares/my-shares/:id      → 공유 상세 조회
// POST /v1/file-shares/my-shares/:id/revoke → 공유 철회

export const mySentShareApi = {
  /** 공유 목록 조회 (status: ACTIVE | REVOKED) */
  getList: async (
    params?: MySentShareListParams,
  ): Promise<PaginatedResponse<MySentShareItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<MySentShareItem>>(
      '/file-shares/my-shares',
      { params },
    );
    return data;
  },

  /** 공유 상세 조회 */
  getDetail: async (id: string): Promise<PublicShareResponse> => {
    const { data } = await apiClient.get<PublicShareResponse>(
      `/file-shares/my-shares/${id}`,
    );
    return data;
  },

  /** 공유 철회 (ACTIVE → REVOKED) */
  revoke: async (id: string): Promise<RevokeShareResponse> => {
    const { data } = await apiClient.post<RevokeShareResponse>(
      `/file-shares/my-shares/${id}/revoke`,
    );
    return data;
  },
};

// ─── 702. 받은 요청 관리 ───

export const receivedRequestApi = {
  getList: async (
    params?: ReceivedRequestListParams,
  ): Promise<PaginatedResponse<ShareRequestResponse>> => {
    const { data } = await apiClient.get<PaginatedResponse<ShareRequestResponse>>(
      '/file-shares-requests/received',
      { params },
    );
    return data;
  },

  getDetail: async (id: string): Promise<ShareRequestResponse> => {
    const { data } = await apiClient.get<ShareRequestResponse>(
      `/file-shares-requests/received/${id}`,
    );
    return data;
  },

  approve: async (
    id: string,
    body?: ApproveReceivedRequestBody,
  ): Promise<ShareRequestResponse> => {
    const { data } = await apiClient.post<ShareRequestResponse>(
      `/file-shares-requests/received/${id}/approve`,
      body ?? {},
    );
    return data;
  },

  reject: async (
    id: string,
    body: RejectReceivedRequestBody,
  ): Promise<ShareRequestResponse> => {
    const { data } = await apiClient.post<ShareRequestResponse>(
      `/file-shares-requests/received/${id}/reject`,
      body,
    );
    return data;
  },
};
