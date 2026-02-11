/**
 * Auth API Client
 * POST /v1/auth/login, refresh-token, logout, verify-token
 */
import axios from 'axios';
import apiClient from './apiClient';
import { tokenStorage } from './apiClient';
import type {
  LoginResponse,
  RefreshTokenResponse,
  LogoutResponse,
  VerifyTokenResponse,
} from '../types/auth.types';

export const authApi = {
  /**
   * SSO 로그인
   * POST /v1/auth/login
   */
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    return data;
  },

  /**
   * 토큰 갱신 (토큰 로테이션)
   * POST /v1/auth/refresh-token
   *
   * 참고: 인터셉터 순환 방지를 위해 별도 axios 인스턴스 사용
   */
  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    const { data } = await axios.post<RefreshTokenResponse>(
      '/v1/auth/refresh-token',
      { refreshToken },
    );
    return data;
  },

  /**
   * 로그아웃
   * POST /v1/auth/logout
   * Authorization 헤더 필수
   */
  logout: async (accessToken?: string): Promise<LogoutResponse> => {
    const token = accessToken || tokenStorage.getAccessToken();
    const { data } = await apiClient.post<LogoutResponse>(
      '/auth/logout',
      undefined,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );
    return data;
  },

  /**
   * 토큰 검증
   * POST /v1/auth/verify-token
   */
  verifyToken: async (token: string): Promise<VerifyTokenResponse> => {
    const { data } = await apiClient.post<VerifyTokenResponse>(
      '/auth/verify-token',
      { token },
    );
    return data;
  },
};

export { tokenStorage };
export default authApi;
