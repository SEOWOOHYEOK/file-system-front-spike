/**
 * useAuth Hook
 * 외부 사용자 인증 상태 관리
 */
import { useState, useCallback } from 'react';
import { externalShareApi } from '../api/externalShareApi';
import type { LoginResponse } from '../types/api.types';

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: LoginResponse['user'] | null;
  expiresAt: Date | null;
}

export interface UseAuthReturn {
  auth: AuthState;
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isTokenExpired: () => boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  expiresAt: null,
};

export function useAuth(): UseAuthReturn {
  const [auth, setAuth] = useState<AuthState>(initialState);

  const login = useCallback(async (username: string, password: string): Promise<LoginResponse> => {
    const response = await externalShareApi.login({ username, password });
    
    const expiresAt = new Date(Date.now() + response.expiresIn * 1000);
    
    setAuth({
      isAuthenticated: true,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user,
      expiresAt,
    });
    
    return response;
  }, []);

  const logout = useCallback(async () => {
    if (auth.accessToken) {
      try {
        await externalShareApi.logout(auth.accessToken);
      } catch (error) {
        // 로그아웃 실패해도 로컬 상태는 초기화
        console.error('Logout error:', error);
      }
    }
    setAuth(initialState);
  }, [auth.accessToken]);

  const refresh = useCallback(async () => {
    if (!auth.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await externalShareApi.refreshToken({ refreshToken: auth.refreshToken });
    
    const expiresAt = new Date(Date.now() + response.expiresIn * 1000);
    
    setAuth((prev) => ({
      ...prev,
      accessToken: response.accessToken,
      expiresAt,
    }));
  }, [auth.refreshToken]);

  const isTokenExpired = useCallback(() => {
    if (!auth.expiresAt) return true;
    // 30초 버퍼
    return new Date() >= new Date(auth.expiresAt.getTime() - 30000);
  }, [auth.expiresAt]);

  return {
    auth,
    login,
    logout,
    refresh,
    isTokenExpired,
  };
}
