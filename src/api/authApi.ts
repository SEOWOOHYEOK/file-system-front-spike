/**
 * Auth API Client
 * POST /v2/auth/login, refresh-token
 */
import axios from 'axios';
import { tokenStorage } from './apiClient';
import type {
  LoginResponse,
  RefreshTokenResponse,
} from '../types/auth.types';

export const authApi = {
  /**
   * V2 SSO 로그인
   * POST /v2/auth/login
   *
   * SSO 토큰을 직접 반환합니다.
   */
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await axios.post<LoginResponse>('/v2/auth/login', {
      email,
      password,
    });
    return data;
  },

  /**
   * V2 토큰 갱신
   * POST /v2/auth/refresh-token
   *
   * SSO refreshToken을 사용하여 새 accessToken을 발급받습니다.
   * refreshToken은 로테이션되지 않습니다.
   *
   * 참고: 인터셉터 순환 방지를 위해 별도 axios 인스턴스 사용
   */
  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    const { data } = await axios.post<RefreshTokenResponse>(
      '/v2/auth/refresh-token',
      { refreshToken },
    );
    return data;
  },

  /**
   * 로그아웃
   *
   * V2에는 logout 엔드포인트가 없으므로 클라이언트 측에서만 토큰 정리.
   * 실제 정리는 AuthContext에서 수행합니다.
   */
  logout: async (): Promise<void> => {
    tokenStorage.clearAll();
  },
};

export { tokenStorage };
export default authApi;
