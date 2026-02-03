/**
 * User API Client
 * 300.사용자 API
 */
import axios, { AxiosError } from 'axios';
import type {
  User,
  UserWithEmployee,
  UserWithRole,
  UserFilterQuery,
  AssignRoleRequest,
  SyncResult,
  UserApiLogEntry,
  AddFavoriteRequest,
  FavoriteResponse,
  FavoriteTargetType,
  GetFavoritesQuery,
  RecentActivitiesQuery,
  RecentActivitiesResponse,
} from '../types/user.types';

const api = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API 로그 콜백
let logCallback: ((log: UserApiLogEntry) => void) | null = null;

export function setUserLogCallback(callback: ((log: UserApiLogEntry) => void) | null) {
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

// ============================================
// 300.사용자 API
// ============================================

export const userApi = {
  /**
   * 전체 User 목록 조회 (Employee 정보 포함 + 필터링)
   * GET /v1/users
   */
  getAll: (token: string, filter?: UserFilterQuery): Promise<UserWithEmployee[]> =>
    apiCall<UserWithEmployee[]>(
      'GET',
      '/users',
      token,
      undefined,
      filter as Record<string, unknown>
    ),

  /**
   * 특정 User 조회 (Role 포함)
   * GET /v1/users/:id
   */
  getById: (token: string, id: string): Promise<UserWithRole> =>
    apiCall<UserWithRole>('GET', `/users/${id}`, token),

  /**
   * User에게 Role 부여
   * PATCH /v1/users/:id/role
   */
  assignRole: (
    token: string,
    id: string,
    request: AssignRoleRequest
  ): Promise<User> =>
    apiCall<User>('PATCH', `/users/${id}/role`, token, request),

  /**
   * User의 Role 제거
   * DELETE /v1/users/:id/role
   */
  removeRole: (token: string, id: string): Promise<User> =>
    apiCall<User>('DELETE', `/users/${id}/role`, token),

  /**
   * Employee → User 동기화
   * POST /v1/users/sync
   */
  sync: (token: string): Promise<SyncResult> =>
    apiCall<SyncResult>('POST', '/users/sync', token),

  // ============================================
  // 310.즐겨찾기 API
  // ============================================

  /**
   * 즐겨찾기 등록
   * POST /v1/users/favorites
   */
  addFavorite: (token: string, request: AddFavoriteRequest): Promise<FavoriteResponse> =>
    apiCall<FavoriteResponse>('POST', '/users/favorites', token, request),

  /**
   * 즐겨찾기 해제
   * DELETE /v1/users/favorites/:targetType/:targetId
   */
  removeFavorite: (
    token: string,
    targetType: FavoriteTargetType,
    targetId: string
  ): Promise<{ message: string }> =>
    apiCall<{ message: string }>('DELETE', `/users/favorites/${targetType}/${targetId}`, token),

  /**
   * 즐겨찾기 목록 조회
   * GET /v1/users/favorites
   */
  getFavorites: (token: string, query?: GetFavoritesQuery): Promise<FavoriteResponse[]> =>
    apiCall<FavoriteResponse[]>(
      'GET',
      '/users/favorites',
      token,
      undefined,
      query as Record<string, unknown>
    ),

  /**
   * 최근 활동 조회
   * GET /v1/users/favorites/recent-activities
   */
  getRecentActivities: (
    token: string,
    query?: RecentActivitiesQuery
  ): Promise<RecentActivitiesResponse> =>
    apiCall<RecentActivitiesResponse>(
      'GET',
      '/users/favorites/recent-activities',
      token,
      undefined,
      query as Record<string, unknown>
    ),
};

export default userApi;
