/**
 * 인증 API 타입 정의
 * POST /v2/auth/login, refresh-token
 */

// ─── 공통 ───

export type UserType = 'internal' | 'external';

export interface UserInfo {
  /** 사용자 ID (UUID) */
  id: string;
  /** 직원 번호 */
  employeeNumber: string;
  /** 이름 */
  name?: string;
  /** 이메일 */
  email?: string;
  /** 역할 */
  role: string;
}

// ─── 로그인 ───

export interface LoginRequest {
  /** 이메일 (필수) */
  email: string;
  /** 비밀번호 (필수) */
  password: string;
}

export interface LoginResponse {
  success: boolean;
  /** SSO 액세스 토큰 */
  accessToken: string;
  /** SSO 리프레시 토큰 */
  refreshToken: string;
  /** SSO 리프레시 토큰 만료 시각 */
  refreshTokenExpiresAt: string;
  /** 액세스 토큰 만료 시간 (초) */
  expiresIn: number;
  /** 사용자 정보 */
  user: UserInfo;
}

// ─── 토큰 갱신 ───

export interface RefreshTokenRequest {
  /** SSO 리프레시 토큰 (필수) */
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  /** 새 SSO 액세스 토큰 */
  accessToken: string;
  /** SSO 리프레시 토큰 만료 시각 */
  refreshTokenExpiresAt: string;
  /** 액세스 토큰 만료 시간 (초) */
  expiresIn: number;
  /** 갱신된 역할 */
  role: string;
}

// ─── 에러 응답 ───

export type AuthErrorCode =
  | 'INVALID_REFRESH_TOKEN'
  | 'REFRESH_TOKEN_EXPIRED'
  | 'TOKEN_REUSE_DETECTED'
  | 'TOKEN_REVOKED';

export interface AuthErrorResponse {
  /** 에러 코드 */
  error: string;
  /** 에러 메시지 (한국어) */
  message: string;
  /** HTTP 상태 코드 */
  statusCode: number;
}

// ─── 인증 상태 (프론트엔드) ───

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  userType: UserType | null;
  expiresAt: number | null;
}

// ─── 인증 컨텍스트 ───

export interface AuthContextValue {
  /** 인증 상태 */
  auth: AuthState;
  /** SSO 로그인 */
  login: (email: string, password: string) => Promise<LoginResponse>;
  /** 로그아웃 */
  logout: () => Promise<void>;
  /** 토큰 갱신 */
  refresh: () => Promise<RefreshTokenResponse>;
  /** 로딩 상태 */
  isLoading: boolean;
}
