# 805. 관리자 - 파일 공유 관리 - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `805.관리자 - 파일 공유 관리` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증 및 권한](#2-인증-및-권한)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [API 상세 - 전체 공유 현황 조회](#4-api-상세---전체-공유-현황-조회)
5. [API 상세 - 공유 상세 조회](#5-api-상세---공유-상세-조회)
6. [API 상세 - 공유 차단](#6-api-상세---공유-차단)
7. [API 상세 - 차단 해제](#7-api-상세---차단-해제)
8. [API 상세 - 특정 파일의 공유 목록 조회](#8-api-상세---특정-파일의-공유-목록-조회)
9. [API 상세 - 특정 파일의 모든 공유 일괄 차단](#9-api-상세---특정-파일의-모든-공유-일괄-차단)
10. [API 상세 - 특정 파일의 모든 공유 일괄 차단 해제](#10-api-상세---특정-파일의-모든-공유-일괄-차단-해제)
11. [API 상세 - 특정 외부 사용자의 모든 공유 일괄 차단](#11-api-상세---특정-외부-사용자의-모든-공유-일괄-차단)
12. [에러 처리](#12-에러-처리)
13. [cURL 테스트](#13-curl-테스트)

---

## 1. API 개요

| Method | Path | 설명 | 필요 권한 |
|--------|------|------|-----------|
| `GET` | `/v1/admin/shares` | 전체 공유 현황 조회 (필터링 지원) | `FILE_SHARE_READ` |
| `GET` | `/v1/admin/shares/:id` | 공유 상세 조회 | `FILE_SHARE_READ` |
| `PATCH` | `/v1/admin/shares/:id/block` | 공유 차단 | `FILE_SHARE_DELETE` |
| `PATCH` | `/v1/admin/shares/:id/unblock` | 차단 해제 | `FILE_SHARE_DELETE` |
| `GET` | `/v1/admin/shares/files/:fileId` | 특정 파일의 공유 목록 조회 | `FILE_SHARE_READ` |
| `PATCH` | `/v1/admin/shares/files/:fileId/block-all` | 특정 파일의 모든 공유 일괄 차단 | `FILE_SHARE_DELETE` |
| `PATCH` | `/v1/admin/shares/files/:fileId/unblock-all` | 특정 파일의 모든 공유 일괄 차단 해제 | `FILE_SHARE_DELETE` |
| `PATCH` | `/v1/admin/shares/external-users/:userId/block-all` | 특정 외부 사용자의 모든 공유 일괄 차단 | `FILE_SHARE_DELETE` |

---

## 2. 인증 및 권한

모든 API는 **JWT Bearer Token** + **관리자 권한**이 필요합니다.

```typescript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
};
```

> 토큰은 로그인 API (`POST /v1/auth/login`)로 발급받습니다.

### 필요 권한

| 권한 | 설명 | 해당 API |
|------|------|----------|
| `FILE_SHARE_READ` | 공유 조회 (기본) | 모든 API (컨트롤러 레벨 가드) |
| `FILE_SHARE_DELETE` | 공유 차단/해제 | 차단, 해제, 일괄 차단/해제 API |

---

## 3. TypeScript 타입 정의

프론트엔드 프로젝트에 그대로 복사해서 사용하세요.

```typescript
// types/share-admin.ts

// ─── 페이지네이션 공통 ───

export interface PaginationQuery {
  /** 페이지 번호 (기본값: 1) */
  page?: number;
  /** 페이지 크기 (기본값: 20, 최대: 100) */
  pageSize?: number;
  /** 정렬 기준 필드 (기본값: createdAt) */
  sortBy?: string;
  /** 정렬 순서 */
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ─── 파일 정보 (중첩용) ───

export interface ShareFileInfo {
  /** 파일 ID (UUID) */
  fileId: string;
  /** 파일명 */
  fileName: string;
  /** 파일 크기 (bytes) */
  fileSize: number;
  /** MIME 타입 */
  mimeType: string;
  /** 파일 생성자(업로더) ID (UUID) */
  createdBy: string;
}

// ─── 외부 사용자 정보 (중첩용) ───

export interface ShareExternalUserInfo {
  /** 외부 사용자 ID (UUID) */
  externalUserId: string;
  /** 이름 */
  name: string;
  /** 소속(회사) */
  company?: string;
  /** 부서 */
  department?: string;
}

// ─── 공유 목록 필터 쿼리 (관리자) ───

export interface AdminShareFilterQuery extends PaginationQuery {
  /** 공유자 이름 (부분 일치) */
  ownerName?: string;
  /** 공유자 부서 (부분 일치) */
  ownerDepartment?: string;
  /** 공유받은 사람 이름 (부분 일치) */
  recipientName?: string;
  /** 공유받은 사람 부서 (부분 일치) */
  recipientDepartment?: string;
  /** 파일명 (부분 일치) */
  fileName?: string;
}

// ─── 공유 목록 아이템 (전체 현황 조회용 - 관리자) ───

export interface AdminShareListItem {
  /** 공유 ID (UUID) */
  id: string;
  /** 소유자(공유자) ID (UUID) */
  ownerId: string;
  /** 공유자 이름 */
  ownerName: string;
  /** 공유자 부서 */
  ownerDepartment?: string;
  /** 파일 정보 */
  fileInfo: ShareFileInfo;
  /** 외부 사용자 정보 */
  externalUser: ShareExternalUserInfo;
  /** 권한 목록 */
  permissions: string[];
  /** 현재 뷰 횟수 */
  currentViewCount: number;
  /** 현재 다운로드 횟수 */
  currentDownloadCount: number;
  /** 만료일시 (ISO 8601, 무기한이면 undefined) */
  expiresAt?: string;
  /** 차단 여부 */
  isBlocked: boolean;
  /** 취소 여부 */
  isRevoked: boolean;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
}

// ─── 공유 상세 (관리자용) ───

export interface AdminShareDetail {
  /** 공유 ID (UUID) */
  id: string;
  /** 소유자(공유자) ID (UUID) */
  ownerId: string;
  /** 파일 정보 */
  fileInfo: ShareFileInfo;
  /** 외부 사용자 정보 */
  externalUser: ShareExternalUserInfo;
  /** 권한 목록 */
  permissions: string[];
  /** 최대 뷰 횟수 (무제한이면 undefined) */
  maxViewCount?: number;
  /** 현재 뷰 횟수 */
  currentViewCount: number;
  /** 최대 다운로드 횟수 (무제한이면 undefined) */
  maxDownloadCount?: number;
  /** 현재 다운로드 횟수 */
  currentDownloadCount: number;
  /** 만료일시 (ISO 8601, 무기한이면 undefined) */
  expiresAt?: string;
  /** 차단 여부 */
  isBlocked: boolean;
  /** 차단일시 (ISO 8601) - 차단된 경우만 존재 */
  blockedAt?: string;
  /** 차단자 ID (UUID) - 차단된 경우만 존재 */
  blockedBy?: string;
  /** 취소 여부 */
  isRevoked: boolean;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
  /** 수정일시 (ISO 8601) */
  updatedAt?: string;
}

// ─── 공유 차단/해제 응답 ───

export interface ShareBlockResponse {
  /** 공유 ID (UUID) */
  id: string;
  /** 차단 여부 */
  isBlocked: boolean;
  /** 차단일시 (ISO 8601) - 차단된 경우만 존재 */
  blockedAt?: string;
  /** 차단자 ID (UUID) - 차단된 경우만 존재 */
  blockedBy?: string;
}

// ─── 일괄 차단 응답 ───

export interface BulkBlockResponse {
  /** 차단된 공유 수 */
  blockedCount: number;
}

// ─── 일괄 차단 해제 응답 ───

export interface BulkUnblockResponse {
  /** 차단 해제된 공유 수 */
  unblockedCount: number;
}
```

---

## 4. API 상세 - 전체 공유 현황 조회 (필터링 지원)

관리자가 시스템 내 전체 공유 현황을 **필터링** + 페이지네이션으로 조회합니다.

각 공유 아이템에 **공유자 정보**(이름, 부서), **파일 정보**(파일명, 파일크기, MIME 타입, 생성자 ID), **외부 사용자 정보**(이름, 소속, 부서)가 포함됩니다.

### 요청

```
GET /v1/admin/shares
```

**Query 파라미터 - 페이지네이션**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~100) |
| `sortBy` | `string` | X | `createdAt` | 정렬 기준 필드 (`createdAt`, `fileName`, `ownerName`, `recipientName`, `isBlocked`) |
| `sortOrder` | `'asc' \| 'desc'` | X | `desc` | 정렬 순서 |

**Query 파라미터 - 필터 (모두 선택 사항, 부분 일치 검색)**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `ownerName` | `string` | 공유자 이름 | `홍길동` |
| `ownerDepartment` | `string` | 공유자 부서 | `개발팀` |
| `recipientName` | `string` | 공유받은 사람 이름 | `김철수` |
| `recipientDepartment` | `string` | 공유받은 사람 부서 | `협력업체A` |
| `fileName` | `string` | 파일명 | `설계문서` |

> 필터 조건은 AND로 결합됩니다. 여러 필터를 동시에 사용하면 모든 조건을 만족하는 결과만 반환됩니다.
>
> 필터를 하나도 지정하지 않으면 전체 공유 현황이 반환됩니다 (기존 동작과 동일).

**요청 URL 예시**

```
# 공유자 이름으로 검색
GET /v1/admin/shares?ownerName=홍길동

# 공유받은 사람 부서 + 파일명 복합 필터
GET /v1/admin/shares?recipientDepartment=협력업체A&fileName=설계문서

# 공유자 부서 + 정렬 + 페이지네이션
GET /v1/admin/shares?ownerDepartment=개발팀&sortBy=createdAt&sortOrder=desc&page=1&pageSize=10
```

### 응답 예시

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "ownerId": "880e8400-e29b-41d4-a716-446655440006",
      "ownerName": "박영희",
      "ownerDepartment": "개발팀",
      "fileInfo": {
        "fileId": "550e8400-e29b-41d4-a716-446655440001",
        "fileName": "설계문서.pdf",
        "fileSize": 1048576,
        "mimeType": "application/pdf",
        "createdBy": "880e8400-e29b-41d4-a716-446655440006"
      },
      "externalUser": {
        "externalUserId": "550e8400-e29b-41d4-a716-446655440002",
        "name": "홍길동",
        "company": "협력업체A",
        "department": "기술팀"
      },
      "permissions": ["VIEW", "DOWNLOAD"],
      "currentViewCount": 3,
      "currentDownloadCount": 1,
      "isBlocked": false,
      "isRevoked": false,
      "createdAt": "2026-02-10T09:00:00.000Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440004",
      "ownerId": "880e8400-e29b-41d4-a716-446655440006",
      "ownerName": "박영희",
      "ownerDepartment": "개발팀",
      "fileInfo": {
        "fileId": "550e8400-e29b-41d4-a716-446655440001",
        "fileName": "회의록_2026Q1.docx",
        "fileSize": 524288,
        "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "createdBy": "880e8400-e29b-41d4-a716-446655440006"
      },
      "externalUser": {
        "externalUserId": "770e8400-e29b-41d4-a716-446655440005",
        "name": "김철수",
        "company": "협력업체B",
        "department": "개발팀"
      },
      "permissions": ["VIEW"],
      "currentViewCount": 10,
      "currentDownloadCount": 0,
      "isBlocked": true,
      "isRevoked": false,
      "createdAt": "2026-02-08T14:30:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 50,
  "totalPages": 3,
  "hasNext": true,
  "hasPrev": false
}
```

> `ownerName` — 공유를 생성한 내부 사용자의 이름입니다.
>
> `ownerDepartment` — 공유자의 소속 부서입니다. 부서가 없는 경우 응답에 포함되지 않을 수 있습니다.
>
> `fileInfo` — 공유 대상 파일의 메타데이터. `createdBy`는 파일 업로더 ID입니다.
>
> `externalUser` — 공유 대상 외부 사용자 정보. `company`, `department`는 등록되지 않은 경우 응답에 포함되지 않을 수 있습니다.

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
async function getAllPublicShares(
  query?: AdminShareFilterQuery
): Promise<PaginatedResponse<AdminShareListItem>> {
  const params = new URLSearchParams();

  // 페이지네이션
  if (query?.page) params.set('page', String(query.page));
  if (query?.pageSize) params.set('pageSize', String(query.pageSize));
  if (query?.sortBy) params.set('sortBy', query.sortBy);
  if (query?.sortOrder) params.set('sortOrder', query.sortOrder);

  // 필터
  if (query?.ownerName) params.set('ownerName', query.ownerName);
  if (query?.ownerDepartment) params.set('ownerDepartment', query.ownerDepartment);
  if (query?.recipientName) params.set('recipientName', query.recipientName);
  if (query?.recipientDepartment) params.set('recipientDepartment', query.recipientDepartment);
  if (query?.fileName) params.set('fileName', query.fileName);

  const response = await fetch(`/v1/admin/shares?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

---

## 5. API 상세 - 공유 상세 조회

특정 공유의 상세 정보를 조회합니다. 관리자만 접근 가능합니다.

**파일 정보**(파일명, 파일크기, MIME 타입, 생성자 ID)와 **외부 사용자 정보**(이름, 소속, 부서)가 포함됩니다.

### 요청

```
GET /v1/admin/shares/:id
```

**Path 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 공유 ID | `550e8400-e29b-41d4-a716-446655440003` |

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "ownerId": "880e8400-e29b-41d4-a716-446655440006",
  "fileInfo": {
    "fileId": "550e8400-e29b-41d4-a716-446655440001",
    "fileName": "설계문서.pdf",
    "fileSize": 1048576,
    "mimeType": "application/pdf",
    "createdBy": "880e8400-e29b-41d4-a716-446655440006"
  },
  "externalUser": {
    "externalUserId": "550e8400-e29b-41d4-a716-446655440002",
    "name": "홍길동",
    "company": "협력업체A",
    "department": "기술팀"
  },
  "permissions": ["VIEW", "DOWNLOAD"],
  "maxViewCount": 10,
  "currentViewCount": 5,
  "maxDownloadCount": 5,
  "currentDownloadCount": 2,
  "expiresAt": "2026-03-15T23:59:59.000Z",
  "isBlocked": false,
  "isRevoked": false,
  "createdAt": "2026-02-10T09:00:00.000Z",
  "updatedAt": "2026-02-11T15:30:00.000Z"
}
```

> `fileInfo` — 공유 대상 파일의 메타데이터. `createdBy`는 파일 업로더 ID입니다.
>
> `externalUser` — 공유 대상 외부 사용자 정보. `company`, `department`는 등록되지 않은 경우 응답에 포함되지 않을 수 있습니다.
>
> `maxViewCount`, `maxDownloadCount`, `expiresAt`은 제한이 설정된 경우에만 값이 존재합니다.
>
> `blockedAt`, `blockedBy`는 차단 상태(`isBlocked: true`)일 때만 값이 존재합니다.

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | 공유를 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
async function getPublicShareById(id: string): Promise<AdminShareDetail> {
  const response = await fetch(`/v1/admin/shares/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

---

## 6. API 상세 - 공유 차단

특정 공유를 차단합니다.

- 외부 사용자가 해당 공유를 통해 파일에 접근할 수 없습니다.
- 차단 일시와 차단자 정보가 기록됩니다.
- 이미 취소된 공유는 차단할 필요가 없습니다.
- 차단된 공유는 unblock API로 해제할 수 있습니다.

### 요청

```
PATCH /v1/admin/shares/:id/block
```

**Path 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 차단할 공유 ID | `550e8400-e29b-41d4-a716-446655440003` |

> 요청 Body 없음

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "isBlocked": true,
  "blockedAt": "2026-02-12T10:30:00.000Z",
  "blockedBy": "990e8400-e29b-41d4-a716-446655440007"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | 공유를 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
async function blockShare(id: string): Promise<ShareBlockResponse> {
  const response = await fetch(`/v1/admin/shares/${id}/block`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

---

## 7. API 상세 - 차단 해제

차단된 공유를 해제합니다.

- 외부 사용자가 다시 파일에 접근할 수 있습니다.
- 차단 일시와 차단자 정보가 초기화됩니다.

### 요청

```
PATCH /v1/admin/shares/:id/unblock
```

**Path 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `id` | `string (UUID)` | 차단 해제할 공유 ID | `550e8400-e29b-41d4-a716-446655440003` |

> 요청 Body 없음

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "isBlocked": false
}
```

> 차단 해제 시 `blockedAt`, `blockedBy` 필드가 `null`이 되어 응답에 포함되지 않습니다.

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |
| `404` | 공유를 찾을 수 없음 | ID 확인 |

### fetch 예시

```typescript
async function unblockShare(id: string): Promise<ShareBlockResponse> {
  const response = await fetch(`/v1/admin/shares/${id}/unblock`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

---

## 8. API 상세 - 특정 파일의 공유 목록 조회

특정 파일에 대한 모든 공유 목록을 조회합니다.

각 아이템에 **파일 정보**와 **외부 사용자 정보**가 포함됩니다.

### 요청

```
GET /v1/admin/shares/files/:fileId
```

**Path 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `fileId` | `string (UUID)` | 파일 ID | `550e8400-e29b-41d4-a716-446655440001` |

### 응답 예시

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "ownerId": "880e8400-e29b-41d4-a716-446655440006",
    "fileInfo": {
      "fileId": "550e8400-e29b-41d4-a716-446655440001",
      "fileName": "설계문서.pdf",
      "fileSize": 1048576,
      "mimeType": "application/pdf",
      "createdBy": "880e8400-e29b-41d4-a716-446655440006"
    },
    "externalUser": {
      "externalUserId": "550e8400-e29b-41d4-a716-446655440002",
      "name": "홍길동",
      "company": "협력업체A",
      "department": "기술팀"
    },
    "permissions": ["VIEW", "DOWNLOAD"],
    "maxViewCount": 10,
    "currentViewCount": 5,
    "maxDownloadCount": 5,
    "currentDownloadCount": 2,
    "expiresAt": "2026-03-15T23:59:59.000Z",
    "isBlocked": false,
    "isRevoked": false,
    "createdAt": "2026-02-10T09:00:00.000Z",
    "updatedAt": "2026-02-11T15:30:00.000Z"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440004",
    "ownerId": "880e8400-e29b-41d4-a716-446655440006",
    "fileInfo": {
      "fileId": "550e8400-e29b-41d4-a716-446655440001",
      "fileName": "설계문서.pdf",
      "fileSize": 1048576,
      "mimeType": "application/pdf",
      "createdBy": "880e8400-e29b-41d4-a716-446655440006"
    },
    "externalUser": {
      "externalUserId": "770e8400-e29b-41d4-a716-446655440005",
      "name": "김철수",
      "company": "협력업체B",
      "department": "개발팀"
    },
    "permissions": ["VIEW"],
    "currentViewCount": 8,
    "currentDownloadCount": 0,
    "isBlocked": true,
    "blockedAt": "2026-02-11T10:00:00.000Z",
    "blockedBy": "990e8400-e29b-41d4-a716-446655440007",
    "isRevoked": false,
    "createdAt": "2026-02-08T14:30:00.000Z",
    "updatedAt": "2026-02-11T10:00:00.000Z"
  }
]
```

> 응답은 배열 형태입니다 (페이지네이션 없음). 해당 파일에 대한 모든 공유가 반환됩니다.
>
> 같은 파일에 대한 공유이므로 `fileInfo`는 동일하고, `externalUser`가 공유 대상별로 다릅니다.

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
async function getSharesByFile(fileId: string): Promise<AdminShareDetail[]> {
  const response = await fetch(`/v1/admin/shares/files/${fileId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

---

## 9. API 상세 - 특정 파일의 모든 공유 일괄 차단

특정 파일에 대한 모든 활성 공유를 일괄 차단합니다.

**사용 시나리오:**
- 보안 이슈로 인해 파일 접근을 긴급 차단해야 할 때
- 파일 내용에 문제가 발견되어 모든 외부 접근을 막아야 할 때

> 이미 취소된 공유는 영향받지 않습니다.

### 요청

```
PATCH /v1/admin/shares/files/:fileId/block-all
```

**Path 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `fileId` | `string (UUID)` | 파일 ID | `550e8400-e29b-41d4-a716-446655440001` |

> 요청 Body 없음

### 응답 예시

```json
{
  "blockedCount": 5
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
async function blockAllSharesByFile(fileId: string): Promise<BulkBlockResponse> {
  const response = await fetch(`/v1/admin/shares/files/${fileId}/block-all`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

---

## 10. API 상세 - 특정 파일의 모든 공유 일괄 차단 해제

특정 파일에 대한 모든 차단된 공유를 일괄 해제합니다.

### 요청

```
PATCH /v1/admin/shares/files/:fileId/unblock-all
```

**Path 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `fileId` | `string (UUID)` | 파일 ID | `550e8400-e29b-41d4-a716-446655440001` |

> 요청 Body 없음

### 응답 예시

```json
{
  "unblockedCount": 5
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
async function unblockAllSharesByFile(fileId: string): Promise<BulkUnblockResponse> {
  const response = await fetch(`/v1/admin/shares/files/${fileId}/unblock-all`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

---

## 11. API 상세 - 특정 외부 사용자의 모든 공유 일괄 차단

특정 외부 사용자에게 공유된 모든 파일을 일괄 차단합니다.

**사용 시나리오:**
- 외부 사용자 계정이 침해되었을 때
- 외부 사용자와의 협력 관계가 종료되었을 때
- 보안 감사에서 문제가 발견되었을 때

> 계정 비활성화와 별개로 공유 차단이 필요합니다.

### 요청

```
PATCH /v1/admin/shares/external-users/:userId/block-all
```

**Path 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `userId` | `string (UUID)` | 외부 사용자 ID | `550e8400-e29b-41d4-a716-446655440002` |

> 요청 Body 없음

### 응답 예시

```json
{
  "blockedCount": 12
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 관리자 권한 필요 | 권한 확인 |

### fetch 예시

```typescript
async function blockAllSharesByExternalUser(userId: string): Promise<BulkBlockResponse> {
  const response = await fetch(`/v1/admin/shares/external-users/${userId}/block-all`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}
```

---

## 12. 에러 처리

### 공통 HTTP 상태 코드

| 코드 | 의미 | 프론트엔드 대응 |
|------|------|----------------|
| `200` | 성공 | 정상 처리 |
| `400` | 요청 유효성 실패 | 필드별 에러 메시지 표시 |
| `401` | 인증 만료/없음 | 로그인 페이지로 리다이렉트 |
| `403` | 권한 없음 | "권한이 없습니다" 표시 |
| `404` | 리소스 없음 | "공유를 찾을 수 없습니다" 표시 |
| `500` | 서버 오류 | "서버 오류가 발생했습니다" 표시 |

### Validation 에러 응답 형식 (400)

```json
{
  "statusCode": 400,
  "message": [
    "Validation failed (uuid is expected)"
  ],
  "error": "Bad Request"
}
```

> `message`는 배열로 올 수 있습니다. 각 항목을 필드별로 매핑하여 표시하세요.

### 에러 처리 유틸리티

```typescript
interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
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

## 13. cURL 테스트

```bash
# 토큰 발급 (로그인)
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "password"}' | jq -r '.accessToken')

# 1. 전체 공유 현황 조회 (필터 없음)
curl -X GET "http://localhost:3000/v1/admin/shares?page=1&pageSize=20&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" | jq

# 1-1. 공유자 이름으로 필터
curl -X GET "http://localhost:3000/v1/admin/shares?ownerName=홍길동" \
  -H "Authorization: Bearer $TOKEN" | jq

# 1-2. 공유받은 사람 부서 + 파일명 복합 필터
curl -X GET "http://localhost:3000/v1/admin/shares?recipientDepartment=협력업체A&fileName=설계문서" \
  -H "Authorization: Bearer $TOKEN" | jq

# 1-3. 공유자 부서 필터 + 정렬
curl -X GET "http://localhost:3000/v1/admin/shares?ownerDepartment=개발팀&sortBy=ownerName&sortOrder=asc&page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN" | jq

# 2. 공유 상세 조회
curl -X GET http://localhost:3000/v1/admin/shares/550e8400-e29b-41d4-a716-446655440003 \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. 공유 차단
curl -X PATCH http://localhost:3000/v1/admin/shares/550e8400-e29b-41d4-a716-446655440003/block \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. 차단 해제
curl -X PATCH http://localhost:3000/v1/admin/shares/550e8400-e29b-41d4-a716-446655440003/unblock \
  -H "Authorization: Bearer $TOKEN" | jq

# 5. 특정 파일의 공유 목록 조회
curl -X GET http://localhost:3000/v1/admin/shares/files/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer $TOKEN" | jq

# 6. 특정 파일의 모든 공유 일괄 차단
curl -X PATCH http://localhost:3000/v1/admin/shares/files/550e8400-e29b-41d4-a716-446655440001/block-all \
  -H "Authorization: Bearer $TOKEN" | jq

# 7. 특정 파일의 모든 공유 일괄 차단 해제
curl -X PATCH http://localhost:3000/v1/admin/shares/files/550e8400-e29b-41d4-a716-446655440001/unblock-all \
  -H "Authorization: Bearer $TOKEN" | jq

# 8. 특정 외부 사용자의 모든 공유 일괄 차단
curl -X PATCH http://localhost:3000/v1/admin/shares/external-users/550e8400-e29b-41d4-a716-446655440002/block-all \
  -H "Authorization: Bearer $TOKEN" | jq
```
