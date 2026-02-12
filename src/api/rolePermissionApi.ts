/**
 * Role Permission API Client
 * 809.관리자 - 역할별 권한 매핑 관리
 */
import axios, { AxiosError } from 'axios';
import type {
  RolePermissionResponse,
  PermissionCategory,
  RolePermissionApiLogEntry,
} from '../types/role-permission.types';

const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API 로그 콜백
let logCallback: ((log: RolePermissionApiLogEntry) => void) | null = null;

export function setRolePermissionLogCallback(
  callback: ((log: RolePermissionApiLogEntry) => void) | null,
) {
  logCallback = callback;
}

// API 호출 래퍼
async function apiCall<T>(
  method: string,
  url: string,
  token?: string,
  data?: unknown,
): Promise<T> {
  const startTime = Date.now();
  const logEntry: RolePermissionApiLogEntry = {
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
// 809.관리자 - 역할별 권한 매핑 관리 API
// ============================================

export const rolePermissionApi = {
  /**
   * 전체 역할별 권한 매트릭스 조회
   * GET /v1/admin/role-permissions
   */
  getAll: (token: string): Promise<RolePermissionResponse[]> =>
    apiCall<RolePermissionResponse[]>('GET', '/admin/role-permissions', token),

  /**
   * 특정 역할의 권한 목록 조회
   * GET /v1/admin/role-permissions/:roleId
   */
  getByRoleId: (token: string, roleId: string): Promise<RolePermissionResponse> =>
    apiCall<RolePermissionResponse>('GET', `/admin/role-permissions/${roleId}`, token),

  /**
   * 시스템 전체 권한 목록 조회 (카테고리별)
   * GET /v1/admin/role-permissions/permissions
   */
  getAllPermissions: (token: string): Promise<PermissionCategory[]> =>
    apiCall<PermissionCategory[]>('GET', '/admin/role-permissions/permissions', token),

  /**
   * 역할에 권한 추가
   * POST /v1/admin/role-permissions/:roleId/permissions
   */
  addPermission: (
    token: string,
    roleId: string,
    permissionCode: string,
  ): Promise<RolePermissionResponse> =>
    apiCall<RolePermissionResponse>(
      'POST',
      `/admin/role-permissions/${roleId}/permissions`,
      token,
      { permissionCode },
    ),

  /**
   * 역할에서 권한 제거
   * DELETE /v1/admin/role-permissions/:roleId/permissions/:permissionCode
   */
  removePermission: (
    token: string,
    roleId: string,
    permissionCode: string,
  ): Promise<RolePermissionResponse> =>
    apiCall<RolePermissionResponse>(
      'DELETE',
      `/admin/role-permissions/${roleId}/permissions/${permissionCode}`,
      token,
    ),
};

export default rolePermissionApi;
