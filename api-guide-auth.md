# 인증 API - 프론트엔드 연동 가이드

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [POST /v1/auth/login — SSO 로그인](#4-post-v1authlogin--sso-로그인)
5. [POST /v1/auth/refresh-token — 토큰 갱신](#5-post-v1authrefresh-token--토큰-갱신)
6. [POST /v1/auth/logout — 로그아웃](#6-post-v1authlogout--로그아웃)
7. [POST /v1/auth/verify-token — 토큰 검증](#7-post-v1authverify-token--토큰-검증)
8. [POST /v1/auth/generate-token — 토큰 생성 (테스트용)](#8-post-v1authgenerate-token--토큰-생성-테스트용)
9. [토큰 갱신 플로우 (Silent Refresh)](#9-토큰-갱신-플로우-silent-refresh)
10. [에러 처리](#10-에러-처리)
11. [cURL 테스트](#11-curl-테스트)

---

## 1. API 개요

| # | Method | Endpoint | 인증 | 설명 |
|---|--------|----------|------|------|
| 1 | POST | `/v1/auth/login` | 불필요 | SSO 로그인 후 액세스 토큰 + 리프레시 토큰 발급 |
| 2 | POST | `/v1/auth/refresh-token` | 불필요 | 리프레시 토큰으로 새 액세스/리프레시 토큰 발급 (로테이션) |
| 3 | POST | `/v1/auth/logout` | Bearer Token | 로그아웃 (액세스 토큰 블랙리스트 + 리프레시 토큰 무효화) |
| 4 | POST | `/v1/auth/verify-token` | 불필요 | JWT 토큰 유효성 검증 |
| 5 | POST | `/v1/auth/generate-token` | 불필요 | 테스트용 JWT 토큰 생성 (만료 2개월) |

### 토큰 만료 정책

| 토큰 | 형식 | 내부 사용자 | 외부 사용자 |
|------|------|------------|------------|
| Access Token | JWT | 30분 | 30분 |
| Refresh Token | Opaque 문자열 | 14일 | 1일 |

---

## 2. 인증

인증이 필요한 API (`logout` 등)는 `Authorization` 헤더에 **액세스 토큰**을 포함해야 합니다.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**리프레시 토큰은 헤더가 아닌 요청 Body로 전달합니다.**

---

## 3. TypeScript 타입 정의

프론트엔드에서 복사하여 바로 사용할 수 있는 타입입니다.

```typescript
// ─── 공통 ───

type UserType = 'internal' | 'external';

interface UserInfo {
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

interface LoginRequest {
  /** 이메일 (필수) */
  email: string;
  /** 비밀번호 (필수) */
  password: string;
}

interface LoginResponse {
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

interface RefreshTokenRequest {
  /** DMS 리프레시 토큰 (필수) */
  refreshToken: string;
}

interface RefreshTokenResponse {
  success: boolean;
  /** 새 JWT 액세스 토큰 */
  accessToken: string;
  /** 새 리프레시 토큰 (로테이션됨, 기존 토큰은 무효) */
  refreshToken: string;
  /** 액세스 토큰 만료 시간 (초) */
  expiresIn: number;
}

// ─── 로그아웃 ───

interface LogoutResponse {
  success: boolean;
  message: string;
}

// ─── 토큰 검증 ───

interface VerifyTokenRequest {
  /** 검증할 JWT 토큰 (필수) */
  token: string;
}

interface VerifyTokenResponse {
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
    [key: string]: any;
  };
  /** 검증 실패 시 오류 메시지 */
  error?: string;
  /** 만료 여부 */
  expired?: boolean;
}

// ─── 토큰 생성 (테스트용) ───

interface GenerateTokenRequest {
  /** 직원 번호 (필수) */
  employeeNumber: string;
  /** 이름 (선택) */
  name?: string;
  /** 이메일 (선택) */
  email?: string;
  /** 추가 payload 데이터 (선택) */
  additionalData?: Record<string, any>;
}

interface GenerateTokenResponse {
  success: boolean;
  /** 생성된 JWT 토큰 */
  token: string;
  tokenInfo: {
    employeeNumber: string;
    name?: string;
    email?: string;
    /** 발급 시간 (ISO 8601) */
    issuedAt: string;
    /** 만료 시간 (ISO 8601) */
    expiresAt: string;
  };
  /** 사용 방법 예시 */
  usage: string;
}

// ─── 에러 응답 ───

interface AuthErrorResponse {
  /** 에러 코드 */
  error: string;
  /** 에러 메시지 (한국어) */
  message: string;
  /** HTTP 상태 코드 */
  statusCode: number;
}
```

---

## 4. POST /v1/auth/login — SSO 로그인

SSO를 통해 로그인하고 DMS-API 액세스 토큰과 리프레시 토큰을 발급받습니다.

### 요청

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `email` | string (email) | O | 이메일 주소 |
| `password` | string | O | 비밀번호 |

### fetch 예시

```typescript
async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '로그인 실패');
  }

  return response.json();
}
```

### 성공 응답 (200)

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBl...",
  "refreshToken": "dGhpcyBpcyBhIG9wYXF1ZSByZWZyZXNoIHRva2VuIHN0cmluZw...",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBl...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "employeeNumber": "EMP001",
    "name": "홍길동",
    "email": "user@example.com"
  },
  "userType": "internal",
  "expiresIn": 1800
}
```

> **참고:** `token` 필드는 `accessToken`과 동일한 값입니다. 하위 호환용이며 향후 제거됩니다. 새 코드에서는 `accessToken`을 사용하세요.

### 로그인 후 토큰 저장 예시

```typescript
const result = await login('user@example.com', 'password123');

// 액세스 토큰 → API 호출에 사용
localStorage.setItem('accessToken', result.accessToken);

// 리프레시 토큰 → 토큰 갱신에 사용
localStorage.setItem('refreshToken', result.refreshToken);

// 만료 시간 저장 (자동 갱신 스케줄링용)
const expiresAt = Date.now() + result.expiresIn * 1000;
localStorage.setItem('tokenExpiresAt', String(expiresAt));
```

### 에러 응답

| 상태 코드 | 상황 | 설명 |
|-----------|------|------|
| 401 | 인증 실패 | 이메일 또는 비밀번호 오류 |

---

## 5. POST /v1/auth/refresh-token — 토큰 갱신

리프레시 토큰을 사용하여 새로운 액세스 토큰과 리프레시 토큰을 발급받습니다.

**중요:** 토큰 로테이션이 적용됩니다. 응답으로 받은 **새 리프레시 토큰을 반드시 저장**하고, 이전 리프레시 토큰은 더 이상 사용할 수 없습니다.

### 요청

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `refreshToken` | string | O | DMS 리프레시 토큰 |

### fetch 예시

```typescript
async function refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
  const response = await fetch('/v1/auth/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    // 리프레시 토큰 만료/무효 → 재로그인 필요
    if (response.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('세션 만료. 다시 로그인하세요.');
    }
    throw new Error(error.message || '토큰 갱신 실패');
  }

  return response.json();
}
```

### 성공 응답 (200)

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBl...",
  "refreshToken": "bmV3IG9wYXF1ZSByZWZyZXNoIHRva2VuIGFmdGVyIHJvdGF0aW9u...",
  "expiresIn": 1800
}
```

### 갱신 후 토큰 업데이트 예시

```typescript
const result = await refreshAccessToken(localStorage.getItem('refreshToken')!);

// 반드시 새 토큰으로 교체
localStorage.setItem('accessToken', result.accessToken);
localStorage.setItem('refreshToken', result.refreshToken);

const expiresAt = Date.now() + result.expiresIn * 1000;
localStorage.setItem('tokenExpiresAt', String(expiresAt));
```

### 에러 응답

| 상태 코드 | error 코드 | 설명 | 프론트엔드 대응 |
|-----------|-----------|------|----------------|
| 401 | `INVALID_REFRESH_TOKEN` | 유효하지 않은 리프레시 토큰 | 재로그인 |
| 401 | `REFRESH_TOKEN_EXPIRED` | 리프레시 토큰 만료 | 재로그인 |
| 401 | `TOKEN_REUSE_DETECTED` | 이미 사용된 토큰 재사용 (보안 위협 감지) | 즉시 재로그인 + 사용자에게 보안 알림 |
| 401 | `TOKEN_REVOKED` | 관리자 또는 로그아웃으로 무효화된 토큰 | 재로그인 |

---

## 6. POST /v1/auth/logout — 로그아웃

현재 세션을 종료합니다. 액세스 토큰은 블랙리스트에 추가되고, 해당 사용자의 모든 리프레시 토큰이 무효화됩니다.

### 인증

`Authorization: Bearer {accessToken}` 필수

### fetch 예시

```typescript
async function logout(): Promise<void> {
  const accessToken = localStorage.getItem('accessToken');

  await fetch('/v1/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  // 로컬 토큰 삭제
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tokenExpiresAt');

  window.location.href = '/login';
}
```

### 성공 응답 (200)

```json
{
  "success": true,
  "message": "로그아웃되었습니다."
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| 401 | 인증 실패 (토큰 없음/만료/블랙리스트) |

---

## 7. POST /v1/auth/verify-token — 토큰 검증

JWT 토큰의 유효성을 검증하고 payload를 반환합니다.

### 요청

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `token` | string | O | 검증할 JWT 토큰 |

### fetch 예시

```typescript
async function verifyToken(token: string): Promise<VerifyTokenResponse> {
  const response = await fetch('/v1/auth/verify-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  return response.json();
}
```

### 성공 응답 — 유효한 토큰 (200)

```json
{
  "valid": true,
  "payload": {
    "sub": "550e8400-e29b-41d4-a716-446655440000",
    "type": "internal",
    "iat": 1706000000,
    "exp": 1706001800
  }
}
```

### 성공 응답 — 만료된 토큰 (200)

```json
{
  "valid": false,
  "expired": true,
  "error": "토큰이 만료되었습니다."
}
```

### 성공 응답 — 무효한 토큰 (200)

```json
{
  "valid": false,
  "error": "유효하지 않은 토큰입니다."
}
```

---

## 8. POST /v1/auth/generate-token — 토큰 생성 (테스트용)

만료시간 2개월의 JWT 토큰을 생성합니다. **개발/테스트 전용이며 리프레시 토큰은 발급되지 않습니다.**

### 요청

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `employeeNumber` | string | O | 직원 번호 |
| `name` | string | - | 이름 |
| `email` | string | - | 이메일 |
| `additionalData` | object | - | 추가 payload 데이터 |

### fetch 예시

```typescript
async function generateToken(employeeNumber: string): Promise<GenerateTokenResponse> {
  const response = await fetch('/v1/auth/generate-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeNumber }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '토큰 생성 실패');
  }

  return response.json();
}
```

### 성공 응답 (200)

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenInfo": {
    "employeeNumber": "TEST001",
    "name": "테스트 사용자",
    "email": "test@example.com",
    "issuedAt": "2025-02-11T10:00:00.000Z",
    "expiresAt": "2025-04-12T10:00:00.000Z"
  },
  "usage": "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 에러 응답

| 상태 코드 | 설명 |
|-----------|------|
| 400 | 토큰 생성 실패 (직원 번호 오류 등) |

---

## 9. 토큰 갱신 플로우 (Silent Refresh)

프론트엔드에서 액세스 토큰이 만료되기 전에 자동으로 갱신하는 전체 플로우입니다.

### 추천 구현: Axios Interceptor

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const api = axios.create({ baseURL: '/v1' });

// ─── 요청 인터셉터: 액세스 토큰 자동 첨부 ───
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── 응답 인터셉터: 401 시 토큰 갱신 후 재시도 ───
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401이고, refresh-token이나 login 요청이 아닌 경우
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('refresh-token') &&
      !originalRequest.url?.includes('login')
    ) {
      if (isRefreshing) {
        // 이미 갱신 중이면 큐에 대기
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post<RefreshTokenResponse>(
          '/v1/auth/refresh-token',
          { refreshToken },
        );

        // 새 토큰 저장
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem(
          'tokenExpiresAt',
          String(Date.now() + data.expiresIn * 1000),
        );

        // 대기 중인 요청들 처리
        processQueue(null, data.accessToken);

        // 원래 요청 재시도
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // 재로그인 필요
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
```

### 선제적 갱신 (만료 1분 전)

```typescript
function scheduleTokenRefresh() {
  const expiresAt = Number(localStorage.getItem('tokenExpiresAt'));
  if (!expiresAt) return;

  // 만료 1분 전에 갱신
  const refreshAt = expiresAt - 60 * 1000;
  const delay = refreshAt - Date.now();

  if (delay <= 0) {
    // 이미 갱신 시점 → 즉시 갱신
    doRefresh();
    return;
  }

  setTimeout(async () => {
    await doRefresh();
    // 갱신 후 다음 스케줄 등록
    scheduleTokenRefresh();
  }, delay);
}

async function doRefresh() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return;

  try {
    const response = await fetch('/v1/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) throw new Error('Refresh failed');

    const data: RefreshTokenResponse = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('tokenExpiresAt', String(Date.now() + data.expiresIn * 1000));
  } catch {
    localStorage.clear();
    window.location.href = '/login';
  }
}

// 로그인 성공 후 호출
scheduleTokenRefresh();
```

---

## 10. 에러 처리

### 인증 관련 에러 코드

| error 코드 | HTTP | 설명 | 대응 |
|-----------|------|------|------|
| `INVALID_REFRESH_TOKEN` | 401 | 유효하지 않은 리프레시 토큰 | 재로그인 |
| `REFRESH_TOKEN_EXPIRED` | 401 | 리프레시 토큰 만료 | 재로그인 |
| `TOKEN_REUSE_DETECTED` | 401 | 이미 사용된 리프레시 토큰 재사용 (보안 위협) | 즉시 재로그인 + 보안 경고 표시 |
| `TOKEN_REVOKED` | 401 | 토큰 무효화됨 (로그아웃/관리자) | 재로그인 |

### 에러 응답 형식

```json
{
  "error": "REFRESH_TOKEN_EXPIRED",
  "message": "리프레시 토큰이 만료되었습니다. 다시 로그인하세요.",
  "statusCode": 401
}
```

### 에러 처리 유틸리티

```typescript
function handleAuthError(error: AuthErrorResponse): void {
  switch (error.error) {
    case 'TOKEN_REUSE_DETECTED':
      // 보안 위협 → 모든 토큰 삭제 + 경고
      localStorage.clear();
      alert('보안 위협이 감지되었습니다. 다시 로그인해 주세요.');
      window.location.href = '/login';
      break;

    case 'REFRESH_TOKEN_EXPIRED':
    case 'INVALID_REFRESH_TOKEN':
    case 'TOKEN_REVOKED':
      // 세션 만료 → 재로그인
      localStorage.clear();
      window.location.href = '/login';
      break;

    default:
      console.error('인증 오류:', error.message);
  }
}
```

---

## 11. cURL 테스트

### 로그인

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 토큰 갱신

```bash
curl -X POST http://localhost:3000/v1/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "여기에_리프레시_토큰_입력"
  }'
```

### 로그아웃

```bash
curl -X POST http://localhost:3000/v1/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 여기에_액세스_토큰_입력"
```

### 토큰 검증

```bash
curl -X POST http://localhost:3000/v1/auth/verify-token \
  -H "Content-Type: application/json" \
  -d '{
    "token": "여기에_JWT_토큰_입력"
  }'
```

### 토큰 생성 (테스트용)

```bash
curl -X POST http://localhost:3000/v1/auth/generate-token \
  -H "Content-Type: application/json" \
  -d '{
    "employeeNumber": "TEST001",
    "name": "테스트 사용자",
    "email": "test@example.com"
  }'
```
