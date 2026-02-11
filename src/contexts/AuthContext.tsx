/**
 * AuthContext - 인증 상태 관리 React Context
 *
 * 기능:
 * - localStorage 기반 토큰 저장/복원
 * - 선제적 토큰 갱신 (만료 1분 전 Silent Refresh)
 * - 인터셉터 토큰 갱신 이벤트 동기화
 * - 세션 만료 시 자동 로그아웃
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { authApi } from '../api/authApi';
import { tokenStorage } from '../api/apiClient';
import type {
  AuthState,
  AuthContextValue,
  LoginResponse,
  RefreshTokenResponse,
  VerifyTokenResponse,
  UserInfo,
  UserType,
} from '../types/auth.types';

// ─── 초기 상태 ───

const initialAuthState: AuthState = {
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  userType: null,
  expiresAt: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ───

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(initialAuthState);
  const [isLoading, setIsLoading] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── localStorage에서 인증 정보 복원 ──

  useEffect(() => {
    const accessToken = tokenStorage.getAccessToken();
    const refreshToken = tokenStorage.getRefreshToken();
    const expiresAt = tokenStorage.getExpiresAt();
    const user = tokenStorage.getUser() as UserInfo | null;
    const userType = tokenStorage.getUserType();

    if (accessToken && refreshToken && user) {
      // 토큰이 이미 만료된 경우 → 갱신 시도
      if (expiresAt && expiresAt < Date.now()) {
        doRefresh(refreshToken);
      } else {
        setAuth({
          isAuthenticated: true,
          accessToken,
          refreshToken,
          user,
          userType,
          expiresAt,
        });
      }
    } else {
      // 레거시 키 정리
      localStorage.removeItem('dms_internal_auth');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 선제적 토큰 갱신 스케줄링 (만료 1분 전) ──

  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const refreshAt = expiresAt - 60 * 1000; // 만료 1분 전
    const delay = refreshAt - Date.now();

    if (delay <= 0) {
      // 이미 갱신 시점 → 즉시 갱신
      const rt = tokenStorage.getRefreshToken();
      if (rt) doRefresh(rt);
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      const rt = tokenStorage.getRefreshToken();
      if (rt) doRefresh(rt);
    }, delay);
  }, []);

  // auth 상태가 바뀔 때 스케줄 갱신
  useEffect(() => {
    if (auth.isAuthenticated && auth.expiresAt) {
      scheduleRefresh(auth.expiresAt);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [auth.isAuthenticated, auth.expiresAt, scheduleRefresh]);

  // ── 인터셉터 이벤트 리스너 (토큰 갱신 / 세션 만료) ──

  useEffect(() => {
    const handleTokensRefreshed = (e: Event) => {
      const { accessToken, refreshToken, expiresIn } = (e as CustomEvent).detail;
      const expiresAt = Date.now() + expiresIn * 1000;

      setAuth((prev) => ({
        ...prev,
        accessToken,
        refreshToken,
        expiresAt,
      }));
    };

    const handleSessionExpired = () => {
      setAuth(initialAuthState);
    };

    window.addEventListener('auth:tokens-refreshed', handleTokensRefreshed);
    window.addEventListener('auth:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('auth:tokens-refreshed', handleTokensRefreshed);
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  // ── 토큰 갱신 (내부 헬퍼) ──

  async function doRefresh(refreshTokenValue: string) {
    try {
      const data = await authApi.refreshToken(refreshTokenValue);
      const expiresAt = Date.now() + data.expiresIn * 1000;

      tokenStorage.saveTokens(data.accessToken, data.refreshToken, data.expiresIn);

      setAuth((prev) => ({
        ...prev,
        isAuthenticated: true,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt,
      }));
    } catch {
      // 갱신 실패 → 로그아웃
      tokenStorage.clearAll();
      setAuth(initialAuthState);
    }
  }

  // ── 로그인 ──

  const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
    setIsLoading(true);
    try {
      const data = await authApi.login(email, password);
      const expiresAt = Date.now() + data.expiresIn * 1000;

      // 토큰 저장
      tokenStorage.saveTokens(data.accessToken, data.refreshToken, data.expiresIn);
      tokenStorage.saveUser(data.user, data.userType);

      // 상태 업데이트
      setAuth({
        isAuthenticated: true,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
        userType: data.userType,
        expiresAt,
      });

      return data;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── 로그아웃 ──

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // 서버 로그아웃 실패해도 로컬은 정리
    } finally {
      tokenStorage.clearAll();
      setAuth(initialAuthState);

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    }
  }, []);

  // ── 토큰 갱신 (외부 노출용) ──

  const refresh = useCallback(async (): Promise<RefreshTokenResponse> => {
    const rt = auth.refreshToken || tokenStorage.getRefreshToken();
    if (!rt) {
      throw new Error('리프레시 토큰이 없습니다.');
    }

    setIsLoading(true);
    try {
      const data = await authApi.refreshToken(rt);
      const expiresAt = Date.now() + data.expiresIn * 1000;

      tokenStorage.saveTokens(data.accessToken, data.refreshToken, data.expiresIn);

      setAuth((prev) => ({
        ...prev,
        isAuthenticated: true,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt,
      }));

      return data;
    } catch (error) {
      tokenStorage.clearAll();
      setAuth(initialAuthState);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [auth.refreshToken]);

  // ── 토큰 검증 ──

  const verifyToken = useCallback(async (token: string): Promise<VerifyTokenResponse> => {
    return authApi.verifyToken(token);
  }, []);

  // ─── Context Value ───

  const value: AuthContextValue = {
    auth,
    login,
    logout,
    refresh,
    verifyToken,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ───

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
