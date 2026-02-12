# 역할별 권한 매핑 관리 - 프론트엔드 연동 가이드

> **API 태그**: `809.관리자 - 역할별 권한 매핑 관리`  
> **Base URL**: `/v1/admin/role-permissions`  
> **인증 필요**: Bearer Token (JWT)  
> **최소 권한**: `ROLE_READ` (조회), `ROLE_WRITE` (추가/제거)

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [전체 역할별 권한 매트릭스 조회](#4-전체-역할별-권한-매트릭스-조회)
5. [특정 역할의 권한 목록 조회](#5-특정-역할의-권한-목록-조회)
6. [시스템 전체 권한 목록 조회 (카테고리별)](#6-시스템-전체-권한-목록-조회-카테고리별)
7. [역할에 권한 추가](#7-역할에-권한-추가)
8. [역할에서 권한 제거](#8-역할에서-권한-제거)
9. [에러 처리](#9-에러-처리)
10. [PermissionEnum 전체 목록](#10-permissionenum-전체-목록)
11. [cURL 테스트](#11-curl-테스트)

---

## 1. API 개요

| # | Method | Endpoint | 설명 | 필요 권한 |
|---|--------|----------|------|-----------|
| 1 | `GET` | `/v1/admin/role-permissions` | 전체 역할별 권한 매트릭스 조회 | `ROLE_READ` |
| 2 | `GET` | `/v1/admin/role-permissions/:roleId` | 특정 역할의 권한 목록 조회 | `ROLE_READ` |
| 3 | `GET` | `/v1/admin/role-permissions/permissions` | 시스템 전체 권한 목록 (카테고리별) | `ROLE_READ` |
| 4 | `POST` | `/v1/admin/role-permissions/:roleId/permissions` | 역할에 권한 추가 | `ROLE_WRITE` |
| 5 | `DELETE` | `/v1/admin/role-permissions/:roleId/permissions/:permissionCode` | 역할에서 권한 제거 | `ROLE_WRITE` |

---

## 2. 인증

모든 요청에 JWT Bearer Token을 포함해야 합니다.

```typescript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
};
```

> **참고**: `ROLE_READ` 권한이 없으면 모든 API에서 `403 Forbidden`이 반환됩니다.  
> 권한 추가/제거는 추가로 `ROLE_WRITE` 권한이 필요합니다.

---

## 3. TypeScript 타입 정의

아래 타입을 프로젝트에 복사하여 사용하세요.

```typescript
// ── 공통 응답 타입 ──────────────────────────────

/** 권한 정보 */
interface Permission {
  /** 권한 코드 (예: 'FILE_READ') */
  code: string;
  /** 권한 설명 (예: '파일 조회/검색') */
  description: string;
}

/** 역할별 권한 매핑 정보 */
interface RolePermissionResponse {
  /** 역할 ID (UUID) */
  roleId: string;
  /** 역할 이름 (예: 'ADMIN', 'MANAGER', 'USER', 'GUEST') */
  roleName: string;
  /** 역할 설명 (예: '관리자') */
  roleDescription: string;
  /** 해당 역할에 부여된 권한 목록 */
  permissions: Permission[];
}

/** 카테고리별 권한 그룹 */
interface PermissionCategory {
  /** 카테고리 이름 (예: 'File Management') */
  category: string;
  /** 해당 카테고리의 권한 목록 */
  permissions: Permission[];
}

// ── 요청 타입 ───────────────────────────────────

/** 역할에 권한 추가 요청 */
interface AddPermissionRequest {
  /** 추가할 권한 코드 (PermissionEnum 값) */
  permissionCode: PermissionEnum;
}

// ── PermissionEnum ──────────────────────────────

enum PermissionEnum {
  // User Management
  USER_READ = 'USER_READ',
  USER_WRITE = 'USER_WRITE',

  // Role Management
  ROLE_READ = 'ROLE_READ',
  ROLE_WRITE = 'ROLE_WRITE',

  // Audit & Monitoring
  AUDIT_READ = 'AUDIT_READ',
  AUDIT_EXPORT = 'AUDIT_EXPORT',
  SYSTEM_MONITOR = 'SYSTEM_MONITOR',
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
  SYNC_MANAGE = 'SYNC_MANAGE',

  // File Management
  FILE_READ = 'FILE_READ',
  FILE_WRITE = 'FILE_WRITE',
  FILE_DELETE = 'FILE_DELETE',
  FILE_UPLOAD = 'FILE_UPLOAD',
  FILE_DOWNLOAD = 'FILE_DOWNLOAD',
  FILE_MOVE = 'FILE_MOVE',

  // File Request/Approval Workflow
  FILE_MOVE_REQUEST = 'FILE_MOVE_REQUEST',
  FILE_MOVE_APPROVE = 'FILE_MOVE_APPROVE',
  FILE_DELETE_REQUEST = 'FILE_DELETE_REQUEST',
  FILE_DELETE_APPROVE = 'FILE_DELETE_APPROVE',

  // Trash & Recovery
  TRASH_READ = 'TRASH_READ',
  FILE_PURGE = 'FILE_PURGE',
  FILE_RESTORE = 'FILE_RESTORE',

  // Share Management
  FILE_SHARE_CREATE = 'FILE_SHARE_CREATE',
  FILE_SHARE_READ = 'FILE_SHARE_READ',
  FILE_SHARE_DELETE = 'FILE_SHARE_DELETE',
  FILE_SHARE_DIRECT = 'FILE_SHARE_DIRECT',
  FILE_SHARE_REQUEST = 'FILE_SHARE_REQUEST',
  FILE_SHARE_APPROVE = 'FILE_SHARE_APPROVE',
  SHARE_LOG_READ = 'SHARE_LOG_READ',

  // External Share Access
  EXTERNAL_SHARE_READ = 'EXTERNAL_SHARE_READ',
  EXTERNAL_SHARE_VIEW = 'EXTERNAL_SHARE_VIEW',
  EXTERNAL_SHARE_DOWNLOAD = 'EXTERNAL_SHARE_DOWNLOAD',

  // Folder Management
  FOLDER_READ = 'FOLDER_READ',
  FOLDER_WRITE = 'FOLDER_WRITE',
  FOLDER_DELETE = 'FOLDER_DELETE',
}

// ── 에러 응답 타입 ──────────────────────────────

interface ErrorResponse {
  /** HTTP 상태 코드 */
  statusCode: number;
  /** 숫자 에러 코드 */
  errorCode: number;
  /** 내부 식별자 */
  internalCode: string;
  /** 에러 메시지 (한국어) */
  message: string;
}
```

---

## 4. 전체 역할별 권한 매트릭스 조회

시스템에 등록된 모든 역할(Admin, Manager, User, Guest)과 각 역할에 부여된 권한 목록을 한번에 조회합니다. 관리 화면에서 권한 매트릭스 테이블을 그릴 때 사용합니다.

### 요청

```
GET /v1/admin/role-permissions
```

파라미터 없음.

### fetch 예시

```typescript
async function fetchAllRolePermissions(): Promise<RolePermissionResponse[]> {
  const response = await fetch('/v1/admin/role-permissions', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### 응답 예시

```json
[
  {
    "roleId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "roleName": "ADMIN",
    "roleDescription": "관리자",
    "permissions": [
      { "code": "USER_READ", "description": "사용자 조회" },
      { "code": "USER_WRITE", "description": "사용자 생성/수정" },
      { "code": "ROLE_READ", "description": "역할 조회" },
      { "code": "ROLE_WRITE", "description": "역할 생성/수정" },
      { "code": "FILE_READ", "description": "파일 조회/검색" },
      { "code": "FILE_WRITE", "description": "파일 수정" }
    ]
  },
  {
    "roleId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "roleName": "MANAGER",
    "roleDescription": "매니저",
    "permissions": [
      { "code": "FILE_READ", "description": "파일 조회/검색" },
      { "code": "FILE_WRITE", "description": "파일 수정" },
      { "code": "FILE_UPLOAD", "description": "파일 업로드/상태 조회/취소/재시도" }
    ]
  },
  {
    "roleId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "roleName": "USER",
    "roleDescription": "사용자",
    "permissions": [
      { "code": "FILE_READ", "description": "파일 조회/검색" },
      { "code": "FILE_UPLOAD", "description": "파일 업로드/상태 조회/취소/재시도" }
    ]
  },
  {
    "roleId": "d4e5f6a7-b8c9-0123-defa-234567890123",
    "roleName": "GUEST",
    "roleDescription": "게스트",
    "permissions": [
      { "code": "EXTERNAL_SHARE_READ", "description": "공유 파일 목록/상세 조회" },
      { "code": "EXTERNAL_SHARE_VIEW", "description": "공유 파일 뷰어 (인라인 표시)" },
      { "code": "EXTERNAL_SHARE_DOWNLOAD", "description": "공유 파일 다운로드" }
    ]
  }
]
```

### 응답 코드

| 상태 코드 | 설명 |
|-----------|------|
| `200` | 역할별 권한 매트릭스 반환 |
| `401` | 인증 실패 (토큰 없음/만료) |
| `403` | `ROLE_READ` 권한 없음 |

---

## 5. 특정 역할의 권한 목록 조회

역할 ID로 해당 역할에 부여된 권한 목록을 조회합니다.

### 요청

```
GET /v1/admin/role-permissions/:roleId
```

| 파라미터 | 위치 | 타입 | 필수 | 설명 |
|----------|------|------|------|------|
| `roleId` | Path | `string (UUID)` | O | 역할 ID |

### fetch 예시

```typescript
async function fetchRolePermissions(roleId: string): Promise<RolePermissionResponse> {
  const response = await fetch(`/v1/admin/role-permissions/${roleId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw error;
  }

  return response.json();
}
```

### 응답 예시

```json
{
  "roleId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "roleName": "ADMIN",
  "roleDescription": "관리자",
  "permissions": [
    { "code": "USER_READ", "description": "사용자 조회" },
    { "code": "USER_WRITE", "description": "사용자 생성/수정" },
    { "code": "ROLE_READ", "description": "역할 조회" },
    { "code": "ROLE_WRITE", "description": "역할 생성/수정" },
    { "code": "AUDIT_READ", "description": "DMS 이벤트 및 API 로그 조회" },
    { "code": "FILE_READ", "description": "파일 조회/검색" },
    { "code": "FILE_WRITE", "description": "파일 수정" },
    { "code": "FILE_DELETE", "description": "파일 삭제" },
    { "code": "FILE_UPLOAD", "description": "파일 업로드/상태 조회/취소/재시도" },
    { "code": "FILE_DOWNLOAD", "description": "파일 다운로드/미리보기" }
  ]
}
```

### 응답 코드

| 상태 코드 | 에러 코드 | 설명 |
|-----------|-----------|------|
| `200` | - | 역할 권한 정보 반환 |
| `400` | - | `roleId`가 UUID 형식이 아닌 경우 |
| `401` | - | 인증 실패 |
| `403` | - | `ROLE_READ` 권한 없음 |
| `404` | `7002` `ROLE_NOT_FOUND` | 역할을 찾을 수 없음 |

---

## 6. 시스템 전체 권한 목록 조회 (카테고리별)

시스템에 등록된 전체 권한 목록을 카테고리별로 그룹핑하여 조회합니다. 역할에 권한을 추가할 때 선택 가능한 권한 목록을 보여주는 데 사용합니다.

### 요청

```
GET /v1/admin/role-permissions/permissions
```

파라미터 없음.

### fetch 예시

```typescript
async function fetchAllPermissions(): Promise<PermissionCategory[]> {
  const response = await fetch('/v1/admin/role-permissions/permissions', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
```

### 응답 예시

```json
[
  {
    "category": "User Management",
    "permissions": [
      { "code": "USER_READ", "description": "사용자 조회" },
      { "code": "USER_WRITE", "description": "사용자 생성/수정" }
    ]
  },
  {
    "category": "Role Management",
    "permissions": [
      { "code": "ROLE_READ", "description": "역할 조회" },
      { "code": "ROLE_WRITE", "description": "역할 생성/수정" }
    ]
  },
  {
    "category": "Audit & Monitoring",
    "permissions": [
      { "code": "AUDIT_READ", "description": "DMS 이벤트 및 API 로그 조회" },
      { "code": "AUDIT_EXPORT", "description": "로그 내보내기" },
      { "code": "SYSTEM_MONITOR", "description": "NAS 상태 조회 및 동기화 현황" },
      { "code": "SYSTEM_CONFIG", "description": "저장 용량 임계치 정책 설정" },
      { "code": "SYNC_MANAGE", "description": "NAS 동기화 파일 관제" }
    ]
  },
  {
    "category": "File Request/Approval",
    "permissions": [
      { "code": "FILE_MOVE_REQUEST", "description": "파일 이동 요청/취소/목록 조회" },
      { "code": "FILE_MOVE_APPROVE", "description": "파일 이동 요청 승인/반려" },
      { "code": "FILE_DELETE_REQUEST", "description": "파일 삭제 요청/취소/목록 조회" },
      { "code": "FILE_DELETE_APPROVE", "description": "파일 삭제 요청 승인/반려" }
    ]
  },
  {
    "category": "File Management",
    "permissions": [
      { "code": "FILE_READ", "description": "파일 조회/검색" },
      { "code": "FILE_WRITE", "description": "파일 수정" },
      { "code": "FILE_DELETE", "description": "파일 삭제" },
      { "code": "FILE_UPLOAD", "description": "파일 업로드/상태 조회/취소/재시도" },
      { "code": "FILE_DOWNLOAD", "description": "파일 다운로드/미리보기" },
      { "code": "FILE_MOVE", "description": "파일 직접 이동" }
    ]
  },
  {
    "category": "Trash & Recovery",
    "permissions": [
      { "code": "TRASH_READ", "description": "삭제 목록 조회" },
      { "code": "FILE_PURGE", "description": "파일 영구 삭제" },
      { "code": "FILE_RESTORE", "description": "파일 복구" }
    ]
  },
  {
    "category": "Share Management",
    "permissions": [
      { "code": "FILE_SHARE_CREATE", "description": "파일 공유 생성/설정" },
      { "code": "FILE_SHARE_READ", "description": "파일 공유 조회" },
      { "code": "FILE_SHARE_DELETE", "description": "파일 공유 삭제/해제" },
      { "code": "FILE_SHARE_DIRECT", "description": "파일 공유 직접 생성 (자동승인)" },
      { "code": "FILE_SHARE_REQUEST", "description": "파일 공유 요청 (승인 필요)" },
      { "code": "FILE_SHARE_APPROVE", "description": "외부 공유 요청 승인/반려" },
      { "code": "SHARE_LOG_READ", "description": "외부 공유 접근 로그 조회" }
    ]
  },
  {
    "category": "External Share Access",
    "permissions": [
      { "code": "EXTERNAL_SHARE_READ", "description": "공유 파일 목록/상세 조회" },
      { "code": "EXTERNAL_SHARE_VIEW", "description": "공유 파일 뷰어 (인라인 표시)" },
      { "code": "EXTERNAL_SHARE_DOWNLOAD", "description": "공유 파일 다운로드" }
    ]
  },
  {
    "category": "Folder Management",
    "permissions": [
      { "code": "FOLDER_READ", "description": "폴더 조회/트리/즐겨찾기" },
      { "code": "FOLDER_WRITE", "description": "폴더 생성/이동/이름 변경" },
      { "code": "FOLDER_DELETE", "description": "폴더 삭제" }
    ]
  }
]
```

### 카테고리 목록

| 카테고리 | 코드 Prefix | 설명 |
|----------|-------------|------|
| User Management | `USER_*` | 사용자 관리 |
| Role Management | `ROLE_*` | 역할 관리 |
| Audit & Monitoring | `AUDIT_*`, `SYSTEM_*`, `SYNC_*` | 감사/모니터링 |
| File Request/Approval | `FILE_*_REQUEST`, `FILE_*_APPROVE` | 파일 요청/승인 워크플로우 |
| File Management | `FILE_READ/WRITE/DELETE/UPLOAD/DOWNLOAD/MOVE` | 파일 기본 관리 |
| Trash & Recovery | `TRASH_*`, `FILE_PURGE`, `FILE_RESTORE` | 삭제/복구 |
| Share Management | `FILE_SHARE_*`, `SHARE_LOG_*` | 공유 관리 |
| External Share Access | `EXTERNAL_SHARE_*` | 외부 공유 접근 |
| Folder Management | `FOLDER_*` | 폴더 관리 |

### 응답 코드

| 상태 코드 | 설명 |
|-----------|------|
| `200` | 카테고리별 권한 목록 반환 |
| `401` | 인증 실패 |
| `403` | `ROLE_READ` 권한 없음 |

---

## 7. 역할에 권한 추가

특정 역할에 새로운 권한을 추가합니다. 추가 후 업데이트된 역할 정보를 반환합니다.

### 요청

```
POST /v1/admin/role-permissions/:roleId/permissions
```

| 파라미터 | 위치 | 타입 | 필수 | 설명 |
|----------|------|------|------|------|
| `roleId` | Path | `string (UUID)` | O | 역할 ID |
| `permissionCode` | Body | `PermissionEnum` | O | 추가할 권한 코드 |

### 요청 Body

```json
{
  "permissionCode": "FILE_READ"
}
```

### fetch 예시

```typescript
async function addPermissionToRole(
  roleId: string,
  permissionCode: PermissionEnum,
): Promise<RolePermissionResponse> {
  const response = await fetch(`/v1/admin/role-permissions/${roleId}/permissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ permissionCode }),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();

    if (error.errorCode === 7004) {
      // PERMISSION_ALREADY_ASSIGNED - 이미 부여된 권한
      alert('이미 해당 역할에 부여된 권한입니다.');
    } else if (error.errorCode === 7003) {
      // PERMISSION_NOT_FOUND - 존재하지 않는 권한 코드
      alert('유효하지 않은 권한 코드입니다.');
    } else if (error.errorCode === 7002) {
      // ROLE_NOT_FOUND - 역할 없음
      alert('역할을 찾을 수 없습니다.');
    }

    throw error;
  }

  return response.json();
}
```

### 응답 예시

```json
{
  "roleId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "roleName": "USER",
  "roleDescription": "사용자",
  "permissions": [
    { "code": "FILE_READ", "description": "파일 조회/검색" },
    { "code": "FILE_UPLOAD", "description": "파일 업로드/상태 조회/취소/재시도" },
    { "code": "FILE_DOWNLOAD", "description": "파일 다운로드/미리보기" }
  ]
}
```

### 응답 코드

| 상태 코드 | 에러 코드 | internalCode | 설명 |
|-----------|-----------|--------------|------|
| `201` | - | - | 권한 추가 완료 |
| `400` | - | - | `roleId`가 UUID 형식이 아니거나 `permissionCode`가 유효하지 않은 경우 |
| `401` | - | - | 인증 실패 |
| `403` | - | - | `ROLE_WRITE` 권한 없음 |
| `404` | `7002` | `ROLE_NOT_FOUND` | 역할을 찾을 수 없음 |
| `404` | `7003` | `PERMISSION_NOT_FOUND` | 권한을 찾을 수 없음 |
| `409` | `7004` | `PERMISSION_ALREADY_ASSIGNED` | 이미 해당 역할에 부여된 권한 |

---

## 8. 역할에서 권한 제거

특정 역할에서 권한을 제거합니다. 제거 후 업데이트된 역할 정보를 반환합니다.

### 요청

```
DELETE /v1/admin/role-permissions/:roleId/permissions/:permissionCode
```

| 파라미터 | 위치 | 타입 | 필수 | 설명 |
|----------|------|------|------|------|
| `roleId` | Path | `string (UUID)` | O | 역할 ID |
| `permissionCode` | Path | `PermissionEnum` | O | 제거할 권한 코드 (예: `FILE_READ`) |

### fetch 예시

```typescript
async function removePermissionFromRole(
  roleId: string,
  permissionCode: PermissionEnum,
): Promise<RolePermissionResponse> {
  const response = await fetch(
    `/v1/admin/role-permissions/${roleId}/permissions/${permissionCode}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error: ErrorResponse = await response.json();

    if (error.errorCode === 7005) {
      // PERMISSION_NOT_ASSIGNED - 부여되지 않은 권한
      alert('해당 역할에 부여되지 않은 권한입니다.');
    } else if (error.errorCode === 7002) {
      // ROLE_NOT_FOUND - 역할 없음
      alert('역할을 찾을 수 없습니다.');
    }

    throw error;
  }

  return response.json();
}
```

### 응답 예시

```json
{
  "roleId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "roleName": "USER",
  "roleDescription": "사용자",
  "permissions": [
    { "code": "FILE_READ", "description": "파일 조회/검색" },
    { "code": "FILE_UPLOAD", "description": "파일 업로드/상태 조회/취소/재시도" }
  ]
}
```

### 응답 코드

| 상태 코드 | 에러 코드 | internalCode | 설명 |
|-----------|-----------|--------------|------|
| `200` | - | - | 권한 제거 완료 |
| `400` | - | - | `roleId`가 UUID 형식이 아닌 경우 |
| `401` | - | - | 인증 실패 |
| `403` | - | - | `ROLE_WRITE` 권한 없음 |
| `404` | `7002` | `ROLE_NOT_FOUND` | 역할을 찾을 수 없음 |
| `404` | `7005` | `PERMISSION_NOT_ASSIGNED` | 해당 역할에 부여되지 않은 권한 |

---

## 9. 에러 처리

### 에러 응답 형식

모든 에러는 동일한 형식으로 반환됩니다:

```json
{
  "statusCode": 404,
  "errorCode": 7002,
  "internalCode": "ROLE_NOT_FOUND",
  "message": "역할을 찾을 수 없습니다."
}
```

### 이 API에서 발생 가능한 에러 코드

| 에러 코드 | internalCode | HTTP | 메시지 | 발생 시나리오 |
|-----------|--------------|------|--------|---------------|
| `7002` | `ROLE_NOT_FOUND` | 404 | 역할을 찾을 수 없습니다. | 존재하지 않는 `roleId`로 조회/추가/제거 |
| `7003` | `PERMISSION_NOT_FOUND` | 404 | 권한을 찾을 수 없습니다. | 존재하지 않는 `permissionCode`로 권한 추가 |
| `7004` | `PERMISSION_ALREADY_ASSIGNED` | 409 | 이미 해당 역할에 부여된 권한입니다. | 이미 부여된 권한을 다시 추가 |
| `7005` | `PERMISSION_NOT_ASSIGNED` | 404 | 해당 역할에 부여되지 않은 권한입니다. | 부여되지 않은 권한을 제거 |

### 공통 에러 처리 유틸리티

```typescript
class RolePermissionApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: number,
    public internalCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'RolePermissionApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json();
    throw new RolePermissionApiError(
      error.statusCode,
      error.errorCode,
      error.internalCode,
      error.message,
    );
  }
  return response.json();
}

// 사용 예시
try {
  const result = await addPermissionToRole(roleId, PermissionEnum.FILE_READ);
  console.log('권한 추가 완료:', result);
} catch (error) {
  if (error instanceof RolePermissionApiError) {
    switch (error.errorCode) {
      case 7002:
        showToast('역할을 찾을 수 없습니다.');
        break;
      case 7003:
        showToast('유효하지 않은 권한 코드입니다.');
        break;
      case 7004:
        showToast('이미 부여된 권한입니다.');
        break;
      case 7005:
        showToast('부여되지 않은 권한입니다.');
        break;
      default:
        showToast(`오류가 발생했습니다: ${error.message}`);
    }
  }
}
```

---

## 10. PermissionEnum 전체 목록

프론트엔드에서 권한 코드를 UI에 표시할 때 참고하세요.

### User Management

| 코드 | 설명 |
|------|------|
| `USER_READ` | 사용자 조회 |
| `USER_WRITE` | 사용자 생성/수정 |

### Role Management

| 코드 | 설명 |
|------|------|
| `ROLE_READ` | 역할 조회 |
| `ROLE_WRITE` | 역할 생성/수정 |

### Audit & Monitoring

| 코드 | 설명 |
|------|------|
| `AUDIT_READ` | DMS 이벤트 및 API 로그 조회 |
| `AUDIT_EXPORT` | 로그 내보내기 |
| `SYSTEM_MONITOR` | NAS 상태 조회 및 동기화 현황 |
| `SYSTEM_CONFIG` | 저장 용량 임계치 정책 설정 |
| `SYNC_MANAGE` | NAS 동기화 파일 관제 |

### File Management

| 코드 | 설명 |
|------|------|
| `FILE_READ` | 파일 조회/검색 |
| `FILE_WRITE` | 파일 수정 |
| `FILE_DELETE` | 파일 삭제 |
| `FILE_UPLOAD` | 파일 업로드/상태 조회/취소/재시도 |
| `FILE_DOWNLOAD` | 파일 다운로드/미리보기 |
| `FILE_MOVE` | 파일 직접 이동 |

### File Request/Approval Workflow

| 코드 | 설명 |
|------|------|
| `FILE_MOVE_REQUEST` | 파일 이동 요청/취소/목록 조회 |
| `FILE_MOVE_APPROVE` | 파일 이동 요청 승인/반려 |
| `FILE_DELETE_REQUEST` | 파일 삭제 요청/취소/목록 조회 |
| `FILE_DELETE_APPROVE` | 파일 삭제 요청 승인/반려 |

### Trash & Recovery

| 코드 | 설명 |
|------|------|
| `TRASH_READ` | 삭제 목록 조회 |
| `FILE_PURGE` | 파일 영구 삭제 |
| `FILE_RESTORE` | 파일 복구 |

### Share Management

| 코드 | 설명 |
|------|------|
| `FILE_SHARE_CREATE` | 파일 공유 생성/설정 |
| `FILE_SHARE_READ` | 파일 공유 조회 |
| `FILE_SHARE_DELETE` | 파일 공유 삭제/해제 |
| `FILE_SHARE_DIRECT` | 파일 공유 직접 생성 (자동승인) |
| `FILE_SHARE_REQUEST` | 파일 공유 요청 (승인 필요) |
| `FILE_SHARE_APPROVE` | 외부 공유 요청 승인/반려 |
| `SHARE_LOG_READ` | 외부 공유 접근 로그 조회 |

### External Share Access

| 코드 | 설명 |
|------|------|
| `EXTERNAL_SHARE_READ` | 공유 파일 목록/상세 조회 |
| `EXTERNAL_SHARE_VIEW` | 공유 파일 뷰어 (인라인 표시) |
| `EXTERNAL_SHARE_DOWNLOAD` | 공유 파일 다운로드 |

### Folder Management

| 코드 | 설명 |
|------|------|
| `FOLDER_READ` | 폴더 조회/트리/즐겨찾기 |
| `FOLDER_WRITE` | 폴더 생성/이동/이름 변경 |
| `FOLDER_DELETE` | 폴더 삭제 |

---

## 11. cURL 테스트

아래 명령어로 API를 직접 테스트할 수 있습니다.

### 환경 변수 설정

```bash
export TOKEN="your-jwt-token-here"
export BASE_URL="http://localhost:3000"
```

### 전체 역할별 권한 매트릭스 조회

```bash
curl -s "${BASE_URL}/v1/admin/role-permissions" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
```

### 특정 역할의 권한 목록 조회

```bash
curl -s "${BASE_URL}/v1/admin/role-permissions/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
```

### 시스템 전체 권한 목록 조회 (카테고리별)

```bash
curl -s "${BASE_URL}/v1/admin/role-permissions/permissions" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
```

### 역할에 권한 추가

```bash
curl -s -X POST "${BASE_URL}/v1/admin/role-permissions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/permissions" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"permissionCode": "FILE_READ"}' | jq .
```

### 역할에서 권한 제거

```bash
curl -s -X DELETE "${BASE_URL}/v1/admin/role-permissions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/permissions/FILE_READ" \
  -H "Authorization: Bearer ${TOKEN}" | jq .
```
