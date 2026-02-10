# User 관리 (Admin) - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `100.Admin - User 관리` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [API 상세 - 전체 User 목록 조회](#4-api-상세---전체-user-목록-조회)
5. [API 상세 - 특정 User 조회 (Role 포함)](#5-api-상세---특정-user-조회-role-포함)
6. [API 상세 - User에게 Role 부여](#6-api-상세---user에게-role-부여)
7. [API 상세 - User의 Role 제거](#7-api-상세---user의-role-제거)
8. [API 상세 - Employee → User 동기화](#8-api-상세---employee--user-동기화)
9. [Enum 값 정리](#9-enum-값-정리)
10. [에러 처리](#10-에러-처리)
11. [cURL 테스트](#11-curl-테스트)

---

## 1. API 개요

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/v1/admin/users` | 전체 User 목록 조회 (Employee 정보 포함) | Bearer |
| `GET` | `/v1/admin/users/:id` | 특정 User 조회 (Role 포함) | Bearer |
| `PATCH` | `/v1/admin/users/:id/role` | User에게 Role 부여 | Bearer |
| `DELETE` | `/v1/admin/users/:id/role` | User의 Role 제거 | Bearer |
| `POST` | `/v1/admin/users/sync` | Employee → User 동기화 실행 | Bearer |

> 모든 API는 **관리자 전용**입니다.

---

## 2. 인증

모든 API는 JWT Bearer Token이 필요합니다.

```typescript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
};
```

> 토큰은 로그인 API (`POST /v1/auth/login`)로 발급받습니다.

---

## 3. TypeScript 타입 정의

프론트엔드 프로젝트에 그대로 복사해서 사용하세요.

```typescript
// types/user-admin.ts

// ─── Enum 타입 ───

/** 재직 상태 */
type EmployeeStatus = '재직중' | '휴직' | '퇴사';

// ─── 요청 타입 ───

/** PATCH /v1/admin/users/:id/role 요청 */
export interface AssignRoleRequest {
  /** 부여할 Role의 ID (UUID) */
  roleId: string;
}

/** GET /v1/admin/users 쿼리 파라미터 */
export interface UserFilterQuery {
  /** 직원 이름 (부분 일치) */
  employeeName?: string;
  /** 사번 (부분 일치) */
  employeeNumber?: string;
  /** 재직 상태 */
  status?: EmployeeStatus;
}

// ─── 응답 타입 ───

/** 부서-직책 정보 */
export interface DepartmentPosition {
  /** 부서 ID (UUID) */
  departmentId: string;
  /** 부서명 */
  departmentName: string;
  /** 직책 ID (UUID) */
  positionId: string;
  /** 직책명 */
  positionTitle: string;
  /** 관리자 여부 */
  isManager: boolean;
}

/** Employee 정보 (User 목록 응답 내 중첩) */
export interface EmployeeInfo {
  /** 사번 */
  employeeNumber: string;
  /** 이름 */
  name: string;
  /** 이메일 */
  email?: string;
  /** 전화번호 */
  phoneNumber?: string;
  /** 입사일 (ISO 8601) */
  hireDate: string;
  /** 재직 상태 */
  status: EmployeeStatus;
  /** 부서-직책 목록 */
  departmentPositions: DepartmentPosition[];
}

/** GET /v1/admin/users 응답 아이템 */
export interface UserWithEmployeeResponse {
  /** User ID (UUID) */
  id: string;
  /** 활성화 여부 */
  isActive: boolean;
  /** Role ID (UUID) — 미할당 시 null */
  roleId: string | null;
  /** Employee 정보 — Employee 없는 경우 null */
  employee: EmployeeInfo | null;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 수정일시 (ISO 8601) */
  updatedAt: string;
}

/** Role 정보 (User 상세 응답 내 중첩) */
export interface RoleInfo {
  /** Role ID (UUID) */
  id: string;
  /** Role 이름 (예: "Admin", "Manager", "User") */
  name: string;
  /** 권한 코드 목록 */
  permissions: string[];
}

/** GET /v1/admin/users/:id 응답 */
export interface UserWithRoleResponse {
  /** User ID (UUID) */
  id: string;
  /** 활성화 여부 */
  isActive: boolean;
  /** Role 정보 — 미할당 시 null */
  role: RoleInfo | null;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 수정일시 (ISO 8601) */
  updatedAt: string;
}

/** PATCH/DELETE /v1/admin/users/:id/role 응답 */
export interface UserResponse {
  /** User ID (UUID) */
  id: string;
  /** Role ID (UUID) — 미할당 시 null */
  roleId: string | null;
  /** 활성화 여부 */
  isActive: boolean;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 수정일시 (ISO 8601) */
  updatedAt: string;
}

/** POST /v1/admin/users/sync 응답 */
export interface SyncResult {
  /** 새로 생성된 User 수 */
  created: number;
  /** 재활성화된 User 수 */
  activated: number;
  /** 비활성화된 User 수 */
  deactivated: number;
  /** 생성 건너뛴 수 (퇴사 상태 신규) */
  skipped: number;
  /** 변경 없는 User 수 */
  unchanged: number;
  /** 총 처리 시간 (ms) */
  processingTimeMs: number;
}
```

---

## 4. API 상세 - 전체 User 목록 조회

전체 User 목록을 Employee 정보(이름, 사번, 부서, 직책)와 함께 조회합니다.
이름/사번/재직상태로 필터링할 수 있습니다.

### 요청

```
GET /v1/admin/users
```

#### Query 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `employeeName` | `string` | X | - | 이름 (부분 일치, 대소문자 무시) |
| `employeeNumber` | `string` | X | - | 사번 (부분 일치, 대소문자 무시) |
| `status` | `EmployeeStatus` | X | - | 재직 상태 (`재직중`, `휴직`, `퇴사`) |

### 요청 예시

```
GET /v1/admin/users?employeeName=김&status=재직중
```

### 응답 예시

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "isActive": true,
    "roleId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "employee": {
      "employeeNumber": "EMP001",
      "name": "김민영",
      "email": "kim.minyoung@lumir.space",
      "phoneNumber": "010-1234-5678",
      "hireDate": "2023-03-01",
      "status": "재직중",
      "departmentPositions": [
        {
          "departmentId": "d1e2f3a4-b5c6-7890-abcd-ef1234567890",
          "departmentName": "경영지원실",
          "positionId": "p1q2r3s4-t5u6-7890-abcd-ef1234567890",
          "positionTitle": "사원",
          "isManager": false
        }
      ]
    },
    "createdAt": "2025-01-15T09:00:00.000Z",
    "updatedAt": "2025-02-10T14:30:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "isActive": true,
    "roleId": null,
    "employee": {
      "employeeNumber": "EMP002",
      "name": "김민찬",
      "email": "kim.minchan@lumir.space",
      "phoneNumber": "010-2345-6789",
      "hireDate": "2024-01-15",
      "status": "재직중",
      "departmentPositions": [
        {
          "departmentId": "d1e2f3a4-b5c6-7890-abcd-ef1234567890",
          "departmentName": "경영지원실",
          "positionId": "p1q2r3s4-t5u6-7890-abcd-ef1234567890",
          "positionTitle": "사원",
          "isManager": false
        }
      ]
    },
    "createdAt": "2025-01-15T09:00:00.000Z",
    "updatedAt": "2025-01-15T09:00:00.000Z"
  }
]
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
/** User 목록 조회 (필터 선택적) */
async function fetchUsers(filter?: UserFilterQuery): Promise<UserWithEmployeeResponse[]> {
  const params = new URLSearchParams();
  if (filter?.employeeName) params.set('employeeName', filter.employeeName);
  if (filter?.employeeNumber) params.set('employeeNumber', filter.employeeNumber);
  if (filter?.status) params.set('status', filter.status);

  const query = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(`/v1/admin/users${query}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data: UserWithEmployeeResponse[] = await response.json();
  return data;
}
```

---

## 5. API 상세 - 특정 User 조회 (Role 포함)

특정 User의 상세 정보를 Role 정보(이름, 권한 목록)와 함께 조회합니다.
Role이 없는 활성 사용자의 경우, 기본 "User" 역할이 자동 할당됩니다.

### 요청

```
GET /v1/admin/users/:id
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 조회할 User ID | `550e8400-e29b-41d4-a716-446655440001` |

### 응답 예시

**Role이 있는 경우:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "isActive": true,
  "role": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Manager",
    "permissions": [
      "FILE_READ",
      "FILE_WRITE",
      "FILE_DELETE",
      "FOLDER_READ",
      "FOLDER_WRITE",
      "SHARE_CREATE",
      "SHARE_MANAGE"
    ]
  },
  "createdAt": "2025-01-15T09:00:00.000Z",
  "updatedAt": "2025-02-10T14:30:00.000Z"
}
```

**Role이 없는 경우 (비활성 사용자):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "isActive": false,
  "role": null,
  "createdAt": "2025-01-15T09:00:00.000Z",
  "updatedAt": "2025-02-10T14:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | User를 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
/** 특정 User 상세 조회 */
async function fetchUserById(userId: string): Promise<UserWithRoleResponse> {
  const response = await fetch(`/v1/admin/users/${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 404) {
      // User를 찾을 수 없음
    }
    throw new Error(error.message);
  }

  const data: UserWithRoleResponse = await response.json();
  return data;
}
```

---

## 6. API 상세 - User에게 Role 부여

특정 User에게 Role을 부여합니다.
비활성(퇴사/휴직) 상태의 User에게는 Role을 부여할 수 없습니다.

### 요청

```
PATCH /v1/admin/users/:id/role
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 대상 User ID | `550e8400-e29b-41d4-a716-446655440001` |

#### Body

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `roleId` | `string` | O | 부여할 Role의 ID (UUID) | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |

### 요청 예시

```json
{
  "roleId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "roleId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "isActive": true,
  "createdAt": "2025-01-15T09:00:00.000Z",
  "updatedAt": "2025-02-10T15:00:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 비활성 User에게 Role 부여 불가 | User 활성 상태 확인 |
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | User 또는 Role을 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
/** User에게 Role 부여 */
async function assignRole(userId: string, roleId: string): Promise<UserResponse> {
  const response = await fetch(`/v1/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roleId }),
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 400) {
      // 비활성 User — UI에서 "비활성 사용자에게 Role을 부여할 수 없습니다" 표시
    }
    if (response.status === 404) {
      // User 또는 Role이 존재하지 않음
    }
    throw new Error(error.message);
  }

  const data: UserResponse = await response.json();
  return data;
}
```

---

## 7. API 상세 - User의 Role 제거

특정 User에게 부여된 Role을 제거합니다.

### 요청

```
DELETE /v1/admin/users/:id/role
```

#### Path 파라미터

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 대상 User ID | `550e8400-e29b-41d4-a716-446655440001` |

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "roleId": null,
  "isActive": true,
  "createdAt": "2025-01-15T09:00:00.000Z",
  "updatedAt": "2025-02-10T15:05:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | User를 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
/** User의 Role 제거 */
async function removeRole(userId: string): Promise<UserResponse> {
  const response = await fetch(`/v1/admin/users/${userId}/role`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 404) {
      // User를 찾을 수 없음
    }
    throw new Error(error.message);
  }

  const data: UserResponse = await response.json();
  return data;
}
```

---

## 8. API 상세 - Employee → User 동기화

Employee 데이터를 기반으로 User를 일괄 동기화합니다.
신규 재직중 Employee → User 생성, 퇴사/휴직 → 비활성화, 복직 → 재활성화를 처리합니다.

### 요청

```
POST /v1/admin/users/sync
```

> Body 없음

### 응답 예시

```json
{
  "created": 3,
  "activated": 1,
  "deactivated": 2,
  "skipped": 0,
  "unchanged": 45,
  "processingTimeMs": 128
}
```

### 동기화 규칙

| 상황 | 처리 | 결과 필드 |
|------|------|-----------|
| 신규 재직중 Employee (User 없음) | User 생성 (isActive: true, roleId: null) | `created` |
| 신규 퇴사/휴직 Employee (User 없음) | User 생성 안 함 | `skipped` |
| 기존 User의 Employee 퇴사/휴직 | User 비활성화 (isActive: false) | `deactivated` |
| 기존 User의 Employee 복직 | User 재활성화 (isActive: true) | `activated` |
| 상태 변경 없음 | 아무 처리 안 함 | `unchanged` |

> **참고:** 기존 Role은 동기화 시 유지됩니다.

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
/** Employee → User 동기화 실행 */
async function syncUsers(): Promise<SyncResult> {
  const response = await fetch('/v1/admin/users/sync', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data: SyncResult = await response.json();
  return data;
}
```

---

## 9. Enum 값 정리

### EmployeeStatus (재직 상태)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `재직중` | 현재 근무 중 | 🟢 재직중 |
| `휴직` | 휴직 상태 | 🟡 휴직 |
| `퇴사` | 퇴사 완료 | 🔴 퇴사 |

> 쿼리 파라미터에서 `status` 필터로 사용됩니다. 값 그대로 전달하세요.

---

## 10. 에러 처리

### 공통 HTTP 상태 코드

| 코드 | 의미 | 프론트엔드 대응 |
|------|------|----------------|
| `200` | 성공 | 정상 처리 |
| `400` | 요청 유효성 실패 | 필드별 에러 메시지 표시 |
| `401` | 인증 만료/없음 | 로그인 페이지로 리다이렉트 |
| `403` | 권한 없음 | "권한이 없습니다" 표시 |
| `404` | 리소스 없음 | "찾을 수 없습니다" 표시 |
| `500` | 서버 오류 | "서버 오류가 발생했습니다" 표시 |

### Validation 에러 응답 형식 (400)

```json
{
  "statusCode": 400,
  "message": [
    "roleId must be a string"
  ],
  "error": "Bad Request"
}
```

> `message`는 배열로 올 수 있습니다. 각 항목을 필드별로 매핑하여 표시하세요.

### 비즈니스 에러 응답 형식

```json
{
  "statusCode": 400,
  "errorCode": "USER_INACTIVE_ROLE_ASSIGN",
  "message": "비활성 사용자에게 Role을 부여할 수 없습니다",
  "context": {
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "roleId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

### 에러 처리 유틸리티

```typescript
interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  errorCode?: string;
  context?: Record<string, any>;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json();

    if (response.status === 401) {
      // 토큰 만료 → 로그인 페이지로
      redirectToLogin();
    }

    throw error;
  }

  return response.json();
}
```

---

## 11. cURL 테스트

```bash
# 토큰 발급 (로그인)
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@lumir.space", "password": "password"}' | jq -r '.accessToken')

# 1. 전체 User 목록 조회
curl -X GET "http://localhost:3000/v1/admin/users" \
  -H "Authorization: Bearer $TOKEN" | jq

# 2. 이름으로 필터링 조회
curl -X GET "http://localhost:3000/v1/admin/users?employeeName=김&status=재직중" \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. 특정 User 조회 (Role 포함)
curl -X GET "http://localhost:3000/v1/admin/users/550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. User에게 Role 부여
curl -X PATCH "http://localhost:3000/v1/admin/users/550e8400-e29b-41d4-a716-446655440001/role" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roleId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}' | jq

# 5. User의 Role 제거
curl -X DELETE "http://localhost:3000/v1/admin/users/550e8400-e29b-41d4-a716-446655440001/role" \
  -H "Authorization: Bearer $TOKEN" | jq

# 6. Employee → User 동기화
curl -X POST "http://localhost:3000/v1/admin/users/sync" \
  -H "Authorization: Bearer $TOKEN" | jq
```
