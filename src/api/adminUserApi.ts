/**
 * Admin User API Client
 * 관리자 사용자 관리 API (/v1/admin/users)
 */
import axios, { AxiosError } from 'axios';
import type {
  UserWithEmployee,
  UserWithRole,
  AssignRoleRequest,
  SyncResult,
  User,
  UserApiLogEntry,
} from '../types/user.types';

const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API 로그 콜백
let logCallback: ((log: UserApiLogEntry) => void) | null = null;

export function setAdminUserLogCallback(callback: ((log: UserApiLogEntry) => void) | null) {
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
  const logEntry: UserApiLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    method,
    url,
    status: 0,
    duration: 0,
    request: data || params,
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

/** Admin User 필터링 쿼리 파라미터 */
export interface AdminUserFilterQuery {
  employeeName?: string;
  employeeNumber?: string;
  status?: '재직중' | '휴직' | '퇴사';
}

export const adminUserApi = {
  /**
   * 전체 User 목록 조회 (Employee 정보 포함)
   * GET /v1/admin/users
   */
  getAll: (token: string, filter?: AdminUserFilterQuery): Promise<UserWithEmployee[]> =>
    apiCall<UserWithEmployee[]>(
      'GET',
      '/admin/users',
      token,
      undefined,
      filter as Record<string, unknown>
    ),

  /**
   * 특정 User 조회 (Role 포함)
   * GET /v1/admin/users/:id
   */
  getById: (token: string, id: string): Promise<UserWithRole> =>
    apiCall<UserWithRole>('GET', `/admin/users/${id}`, token),

  /**
   * User에게 Role 부여
   * PATCH /v1/admin/users/:id/role
   */
  assignRole: (token: string, userId: string, request: AssignRoleRequest): Promise<User> =>
    apiCall<User>('PATCH', `/admin/users/${userId}/role`, token, request),

  /**
   * User의 Role 제거
   * DELETE /v1/admin/users/:id/role
   */
  removeRole: (token: string, userId: string): Promise<User> =>
    apiCall<User>('DELETE', `/admin/users/${userId}/role`, token),

  /**
   * Employee → User 동기화
   * POST /v1/admin/users/sync
   */
  sync: (token: string): Promise<SyncResult> =>
    apiCall<SyncResult>('POST', '/admin/users/sync', token),
};

export default adminUserApi;
