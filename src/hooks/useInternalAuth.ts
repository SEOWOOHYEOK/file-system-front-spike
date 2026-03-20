/**
 * useInternalAuth - 내부 SSO 인증 훅 (하위 호환 래퍼)
 *
 * AuthContext를 기반으로 기존 인터페이스를 유지합니다.
 * 모든 페이지에서 기존 auth.token, auth.user, auth.isAuthenticated 패턴을
 * 변경 없이 사용할 수 있습니다.
 */
import { useMemo } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import type { LoginResponse } from '../types/auth.types';

/** 하위 호환용 내부 사용자 타입 */
export interface InternalUser {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
}

/** 하위 호환용 SSO 토큰 타입 */
export interface SSOToken {
  accessToken: string;
  refreshToken: string;
}

/** 하위 호환용 인증 상태 */
export interface InternalAuthState {
  isAuthenticated: boolean;
  /** 액세스 토큰 (API 호출용) */
  token: string | null;
  /** 사용자 정보 */
  user: InternalUser | null;
  /** SSO 토큰 (accessToken + refreshToken) */
  ssoToken: SSOToken | null;
}

export function useInternalAuth() {
  const { auth, login: contextLogin, logout: contextLogout, refresh: contextRefresh, isLoading } = useAuthContext();

  // 하위 호환 형태로 매핑
  const compatAuth: InternalAuthState = useMemo(() => ({
    isAuthenticated: auth.isAuthenticated,
    token: auth.accessToken,
    user: auth.user
      ? {
          id: auth.user.id,
          employeeNumber: auth.user.employeeNumber,
          name: auth.user.name || '',
          email: auth.user.email || '',
        }
      : null,
    ssoToken: auth.accessToken && auth.refreshToken
      ? {
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
        }
      : null,
  }), [auth]);

  // 하위 호환 login: 기존 LoginResponse 형태로 반환
  const login = async (email: string, password: string) => {
    const data: LoginResponse = await contextLogin(email, password);
    return {
      success: data.success,
      token: data.accessToken,
      user: {
        id: data.user.id,
        employeeNumber: data.user.employeeNumber,
        name: data.user.name || '',
        email: data.user.email || '',
      },
      ssoToken: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      },
    };
  };

  const logout = async () => {
    await contextLogout();
  };

  const refresh = async () => {
    const data = await contextRefresh();
    return {
      success: data.success,
      token: data.accessToken,
      user: compatAuth.user!,
      ssoToken: {
        accessToken: data.accessToken,
        refreshToken: compatAuth.ssoToken?.refreshToken || '',
      },
    };
  };

  return {
    auth: compatAuth,
    login,
    logout,
    refresh,
    isLoading,
  };
}
