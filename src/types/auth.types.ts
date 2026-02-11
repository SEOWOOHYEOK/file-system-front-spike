/**
 * 인증 API 타입 정의
 * POST /v1/auth/login, refresh-token, logout, verify-token
 * (generate-token 테스트용 제외)
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
  /** JWT 액세스 토큰 (API 호출 시 Authorization 헤더에 사용) */
  accessToken: string;
  /** 리프레시 토큰 (토큰 갱신 시 사용, opaque 문자열) */
  refreshToken: string;
  /**
   * @deprecated accessToken과 동일 (하위 호환용, 향후 제거 예정)
   */
  token: string;
  /** 사용자 정보 */
  user: UserInfo;
  /** 사용자 타입 (내부/외부) */
  userType: UserType;
  /** 액세스 토큰 만료 시간 (초, 기본 1800 = 30분) */
  expiresIn: number;
}

// ─── 토큰 갱신 ───

export interface RefreshTokenRequest {
  /** DMS 리프레시 토큰 (필수) */
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  /** 새 JWT 액세스 토큰 */
  accessToken: string;
  /** 새 리프레시 토큰 (로테이션됨, 기존 토큰은 무효) */
  refreshToken: string;
  /** 액세스 토큰 만료 시간 (초) */
  expiresIn: number;
}

// ─── 로그아웃 ───

export interface LogoutResponse {
  success: boolean;
  message: string;
}

// ─── 토큰 검증 ───

export interface VerifyTokenRequest {
  /** 검증할 JWT 토큰 (필수) */
  token: string;
}

export interface VerifyTokenResponse {
  /** 토큰 유효 여부 */
  valid: boolean;
  /** 유효한 경우 payload 정보 */
  payload?: {
    /** 사용자 ID */
    sub: string;
    /** 사용자 타입 */
    type: UserType;
    /** 발급 시간 (Unix timestamp) */
    iat: number;
    /** 만료 시간 (Unix timestamp) */
    exp: number;
    [key: string]: unknown;
  };
  /** 검증 실패 시 오류 메시지 */
  error?: string;
  /** 만료 여부 */
  expired?: boolean;
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
  /** 토큰 검증 */
  verifyToken: (token: string) => Promise<VerifyTokenResponse>;
  /** 로딩 상태 */
  isLoading: boolean;
}
