/**
 * Role API Client
 * 310.역할 API
 */
import axios, { AxiosError } from 'axios';
import type {
  Role,
  CreateRoleRequest,
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

export function setRoleLogCallback(callback: ((log: UserApiLogEntry) => void) | null) {
  logCallback = callback;
}

// API 호출 래퍼
async function apiCall<T>(
  method: string,
  url: string,
  token?: string,
  data?: unknown
): Promise<T> {
  const startTime = Date.now();
  const logEntry: UserApiLogEntry = {
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
// 310.역할 API
// ============================================

export const roleApi = {
  /**
   * 역할 생성
   * POST /v1/roles
   */
  create: (token: string, request: CreateRoleRequest): Promise<Role> =>
    apiCall<Role>('POST', '/roles', token, request),

  /**
   * 전체 역할 목록 조회
   * GET /v1/roles
   */
  getAll: (token: string): Promise<Role[]> =>
    apiCall<Role[]>('GET', '/roles', token),

  /**
   * 역할 상세 조회
   * GET /v1/roles/:id
   */
  getById: (token: string, id: string): Promise<Role> =>
    apiCall<Role>('GET', `/roles/${id}`, token),

  /**
   * 역할 삭제
   * DELETE /v1/roles/:id
   */
  delete: (token: string, id: string): Promise<void> =>
    apiCall<void>('DELETE', `/roles/${id}`, token),
};

export default roleApi;
