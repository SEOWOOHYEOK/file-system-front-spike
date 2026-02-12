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
  MySentShareItem,
  PublicShareResponse,
  RevokeShareResponse,
  ApproveReceivedRequestBody,
  RejectReceivedRequestBody,
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

// ─── 701. 보낸 공유 관리 ───

export const mySentShareApi = {
  getList: async (
    params?: MySentShareListParams,
  ): Promise<PaginatedResponse<MySentShareItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<MySentShareItem>>(
      '/file-shares-requests/my-sent',
      { params },
    );
    return data;
  },

  getDetail: async (id: string): Promise<PublicShareResponse> => {
    const { data } = await apiClient.get<PublicShareResponse>(
      `/file-shares-requests/my-sent/${id}`,
    );
    return data;
  },

  cancel: async (id: string): Promise<ShareRequestResponse | RevokeShareResponse> => {
    const { data } = await apiClient.post<ShareRequestResponse | RevokeShareResponse>(
      `/file-shares-requests/my-sent/${id}/cancel`,
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
