/**
 * 공유 Axios 인스턴스 + 인터셉터
 *
 * - 요청 인터셉터: 액세스 토큰 자동 첨부
 * - 응답 인터셉터: 401 시 토큰 갱신 후 재시도 (큐 패턴)
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { RefreshTokenResponse } from '../types/auth.types';

// ─── 토큰 스토리지 유틸리티 ───

const TOKEN_KEYS = {
  ACCESS_TOKEN: 'dms_access_token',
  REFRESH_TOKEN: 'dms_refresh_token',
  TOKEN_EXPIRES_AT: 'dms_token_expires_at',
  USER: 'dms_user',
  USER_TYPE: 'dms_user_type',
} as const;

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN),
  getRefreshToken: () => localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN),
  getExpiresAt: () => {
    const val = localStorage.getItem(TOKEN_KEYS.TOKEN_EXPIRES_AT);
    return val ? Number(val) : null;
  },
  getUser: () => {
    const val = localStorage.getItem(TOKEN_KEYS.USER);
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  },
  getUserType: () => localStorage.getItem(TOKEN_KEYS.USER_TYPE) as 'internal' | 'external' | null,

  saveTokens: (accessToken: string, refreshToken: string, expiresIn: number) => {
    localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken);
    const expiresAt = Date.now() + expiresIn * 1000;
    localStorage.setItem(TOKEN_KEYS.TOKEN_EXPIRES_AT, String(expiresAt));
  },

  /** accessToken + expiresAt만 갱신 (V2 refresh는 refreshToken을 로테이션하지 않음) */
  saveAccessToken: (accessToken: string, expiresIn: number) => {
    localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
    const expiresAt = Date.now() + expiresIn * 1000;
    localStorage.setItem(TOKEN_KEYS.TOKEN_EXPIRES_AT, String(expiresAt));
  },

  saveUser: (user: unknown, userType: string) => {
    localStorage.setItem(TOKEN_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEYS.USER_TYPE, userType);
  },

  clearAll: () => {
    Object.values(TOKEN_KEYS).forEach((key) => localStorage.removeItem(key));
    // 기존 레거시 키도 정리
    localStorage.removeItem('dms_internal_auth');
  },
};

// ─── Axios 인스턴스 ───

const apiClient = axios.create({
  baseURL: '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── 요청 인터셉터: 액세스 토큰 자동 첨부 ───

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── 응답 인터셉터: 401 시 토큰 갱신 후 재시도 ───

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401이고, refresh-token이나 login 요청이 아닌 경우
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('refresh-token') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // 이미 갱신 중이면 큐에 대기
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = tokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        // 갱신 요청은 별도의 axios 인스턴스로 (인터셉터 무한 루프 방지)
        const { data } = await axios.post<RefreshTokenResponse>(
          '/v2/auth/refresh-token',
          { refreshToken },
        );

        // accessToken만 갱신 (V2는 refreshToken을 로테이션하지 않음)
        tokenStorage.saveAccessToken(data.accessToken, data.expiresIn);

        // 토큰 갱신 이벤트 발행 (AuthContext에서 상태 동기화용)
        window.dispatchEvent(new CustomEvent('auth:tokens-refreshed', {
          detail: { accessToken: data.accessToken, expiresIn: data.expiresIn },
        }));

        // 대기 중인 요청들 처리
        processQueue(null, data.accessToken);

        // 원래 요청 재시도
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // 재로그인 필요
        tokenStorage.clearAll();

        // 인증 만료 이벤트 발행
        window.dispatchEvent(new CustomEvent('auth:session-expired'));

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
