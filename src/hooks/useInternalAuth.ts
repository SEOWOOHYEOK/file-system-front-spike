/**
 * useInternalAuth - 내부 SSO 인증 훅 (500~600 API용)
 */
import { useState, useCallback, useEffect } from 'react';
import { authApi } from '../api/adminApi';
import type { InternalAuthState, InternalUser, SSOToken } from '../types/admin.types';

const STORAGE_KEY = 'dms_internal_auth';

interface StoredAuth {
  token: string;
  user: InternalUser;
  ssoToken: SSOToken;
}

export function useInternalAuth() {
  const [auth, setAuth] = useState<InternalAuthState>({
    isAuthenticated: false,
    token: null,
    user: null,
    ssoToken: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  // 로컬 스토리지에서 인증 정보 복원
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: StoredAuth = JSON.parse(stored);
        setAuth({
          isAuthenticated: true,
          token: parsed.token,
          user: parsed.user,
          ssoToken: parsed.ssoToken,
        });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // 로그인
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(email, password);
      
      const newAuth: InternalAuthState = {
        isAuthenticated: true,
        token: response.token,
        user: response.user,
        ssoToken: response.ssoToken,
      };
      
      setAuth(newAuth);
      
      // 로컬 스토리지에 저장
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        token: response.token,
        user: response.user,
        ssoToken: response.ssoToken,
      }));
      
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 로그아웃
  const logout = useCallback(() => {
    setAuth({
      isAuthenticated: false,
      token: null,
      user: null,
      ssoToken: null,
    });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 토큰 갱신
  const refresh = useCallback(async () => {
    if (!auth.ssoToken?.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    setIsLoading(true);
    try {
      const response = await authApi.refreshToken(auth.ssoToken.refreshToken);
      
      const newAuth: InternalAuthState = {
        isAuthenticated: true,
        token: response.token,
        user: response.user,
        ssoToken: response.ssoToken,
      };
      
      setAuth(newAuth);
      
      // 로컬 스토리지 업데이트
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        token: response.token,
        user: response.user,
        ssoToken: response.ssoToken,
      }));
      
      return response;
    } finally {
      setIsLoading(false);
    }
  }, [auth.ssoToken?.refreshToken]);

  return {
    auth,
    login,
    logout,
    refresh,
    isLoading,
  };
}
