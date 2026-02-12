# 폴더 API - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `210.폴더` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [API 상세 - 폴더 생성](#4-api-상세---폴더-생성)
5. [API 상세 - 루트 폴더 정보 조회](#5-api-상세---루트-폴더-정보-조회)
6. [API 상세 - 폴더 정보 조회](#6-api-상세---폴더-정보-조회)
7. [API 상세 - 폴더 내용 조회](#7-api-상세---폴더-내용-조회)
8. [API 상세 - 폴더명 변경](#8-api-상세---폴더명-변경)
9. [API 상세 - 폴더 이동](#9-api-상세---폴더-이동)
10. [API 상세 - 폴더 삭제 (휴지통 이동)](#10-api-상세---폴더-삭제-휴지통-이동)
11. [API 상세 - 파일/폴더 검색](#11-api-상세---파일폴더-검색)
12. [API 상세 - 내 검색 내역 조회](#12-api-상세---내-검색-내역-조회)
13. [API 상세 - 검색 내역 단건 삭제](#13-api-상세---검색-내역-단건-삭제)
14. [API 상세 - 전체 검색 내역 삭제](#14-api-상세---전체-검색-내역-삭제)
15. [Enum 값 정리](#enum-값-정리)
16. [에러 처리](#에러-처리)
17. [cURL 테스트](#curl-테스트)

---

## 1. API 개요

| Method | Path | 설명 | 인증 | 권한 |
|--------|------|------|------|------|
| `POST` | `/v1/folders` | 폴더 생성 | Bearer | `FOLDER_UPLOAD` |
| `GET` | `/v1/folders/root` | 루트 폴더 정보 조회 | Bearer | `FOLDER_READ` |
| `GET` | `/v1/folders/:folderId` | 폴더 정보 조회 | Bearer | `FOLDER_READ` |
| `GET` | `/v1/folders/:folderId/contents` | 폴더 내용 조회 (하위 폴더/파일) | Bearer | `FOLDER_READ` |
| `PUT` | `/v1/folders/:folderId/rename` | 폴더명 변경 | Bearer | `FOLDER_WRITE` |
| `POST` | `/v1/folders/:folderId/move` | 폴더 이동 | Bearer | `FOLDER_MOVE` |
| `DELETE` | `/v1/folders/:folderId` | 폴더 삭제 (휴지통 이동) | Bearer | `FOLDER_DELETE` |
| `GET` | `/v1/folders/search` | 파일/폴더 검색 | Bearer | `FOLDER_READ` |
| `GET` | `/v1/folders/search/history` | 내 검색 내역 조회 | Bearer | `FOLDER_READ` |
| `DELETE` | `/v1/folders/search/history/:historyId` | 검색 내역 단건 삭제 | Bearer | `FOLDER_READ` |
| `DELETE` | `/v1/folders/search/history` | 전체 검색 내역 삭제 | Bearer | `FOLDER_READ` |

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
// types/folder.ts

// ─── Enum 타입 ───

/** 폴더 상태 */
type FolderState = 'ACTIVE' | 'TRASHED' | 'DELETED';

/** 폴더 스토리지 가용 상태 */
type FolderAvailabilityStatus = 'AVAILABLE' | 'SYNCING' | 'MOVING' | 'ERROR';

/** 정렬 기준 */
type SortBy = 'name' | 'type' | 'createdAt' | 'updatedAt' | 'size';

/** 정렬 순서 */
type SortOrder = 'asc' | 'desc';

/** 검색 결과 타입 */
type SearchResultType = 'file' | 'folder';

/** 검색 내역 타입 */
type SearchHistoryType = 'all' | 'file' | 'folder';

/** 파일 PENDING 작업 타입 */
type PendingActionType = 'MOVE' | 'DELETE';

// ─── 요청 타입 ───

/** POST /v1/folders 요청 - 폴더 생성 */
export interface CreateFolderRequest {
  /** 폴더 이름 */
  name: string;
  /** 상위 폴더 ID (null = 루트에 생성) */
  parentId: string | null;
}

/** PUT /v1/folders/:folderId/rename 요청 - 폴더명 변경 */
export interface RenameFolderRequest {
  /** 새 폴더명 */
  newName: string;
}

/** POST /v1/folders/:folderId/move 요청 - 폴더 이동 */
export interface MoveFolderRequest {
  /** 이동 대상 상위 폴더 ID */
  targetParentId: string;
}

/** GET /v1/folders/:folderId/contents 쿼리 파라미터 */
export interface GetFolderContentsQuery {
  /** 정렬 기준 (기본: name) */
  sortBy?: SortBy;
  /** 정렬 순서 (기본: asc) */
  sortOrder?: SortOrder;
  /** 페이지 번호 (1부터, 기본: 1) */
  page?: number;
  /** 페이지 크기 (1~100, 기본: 50) */
  pageSize?: number;
}

/** GET /v1/folders/search 쿼리 파라미터 */
export interface SearchQuery {
  /** 검색 키워드 (최소 2자, 필수) */
  keyword: string;
  /** 검색 대상 타입 (미지정 시 전체 검색) */
  type?: SearchResultType;
  /** 파일 MIME 타입 필터 (부분 일치, 예: 'image', 'application/pdf') */
  mimeType?: string;
  /** 등록자 이름으로 검색 (부분 일치) */
  createdBy?: string;
  /** 등록 기간 시작일 (ISO 8601) */
  createdAtFrom?: string;
  /** 등록 기간 종료일 (ISO 8601) */
  createdAtTo?: string;
  /** 정렬 기준 (기본: updatedAt) */
  sortBy?: SortBy;
  /** 정렬 순서 (기본: desc) */
  sortOrder?: SortOrder;
  /** 페이지 번호 */
  page?: number;
  /** 페이지 크기 (1~100, 기본: 50) */
  pageSize?: number;
}

/** GET /v1/folders/search/history 쿼리 파라미터 */
export interface SearchHistoryQuery {
  /** 페이지 번호 (1부터, 기본: 1) */
  page?: number;
  /** 페이지 크기 (1~50, 기본: 20) */
  pageSize?: number;
}

// ─── 응답 타입 ───

/** 폴더 스토리지 상태 */
export interface FolderStorageStatus {
  nas: FolderAvailabilityStatus | null;
}

/** 파일 스토리지 상태 */
export interface FileStorageStatus {
  cache: string | null;
  nas: string | null;
}

/** POST /v1/folders 응답 - 폴더 생성 */
export interface CreateFolderResponse {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  storageStatus: FolderStorageStatus;
  createdAt: string; // ISO 8601
}

/** GET /v1/folders/root, GET /v1/folders/:folderId 응답 - 폴더 정보 */
export interface FolderInfoResponse {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  state: FolderState;
  storageStatus: FolderStorageStatus;
  /** 직계 파일 수 */
  fileCount: number;
  /** 직계 폴더 수 */
  folderCount: number;
  /** 하위 전체 파일 크기 합 (bytes) */
  totalSize: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** 브레드크럼 아이템 */
export interface BreadcrumbItem {
  id: string;
  name: string;
}

/** 하위 폴더 목록 아이템 */
export interface FolderListItem {
  id: string;
  name: string;
  path: string;
  storageStatus: FolderStorageStatus;
  fileCount: number;
  folderCount: number;
  /** 폴더 등록자 ID */
  createdBy: string | null;
  updatedAt: string; // ISO 8601
}

/** PENDING 작업 요청 요약 */
export interface PendingActionRequestSummary {
  id: string;
  type: PendingActionType;
  status: 'PENDING';
  requestedAt: string; // ISO 8601
}

/** 하위 파일 목록 아이템 */
export interface FileListItemInFolder {
  id: string;
  name: string;
  /** 파일 크기 (bytes) */
  size: number;
  mimeType: string;
  storageStatus: FileStorageStatus;
  /** 파일 등록자 ID */
  createdBy: string | null;
  updatedAt: string; // ISO 8601
  /** 해당 파일에 대한 PENDING 작업 요청 (없으면 null) */
  pendingActionRequest: PendingActionRequestSummary | null;
}

/** 페이지네이션 정보 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** GET /v1/folders/:folderId/contents 응답 - 폴더 내용 */
export interface FolderContentsResponse {
  folderId: string;
  path: string;
  breadcrumbs: BreadcrumbItem[];
  folders: FolderListItem[];
  files: FileListItemInFolder[];
  pagination: PaginationInfo;
}

/** PUT /v1/folders/:folderId/rename 응답 - 폴더명 변경 */
export interface RenameFolderResponse {
  id: string;
  name: string;
  path: string;
  storageStatus: FolderStorageStatus;
  updatedAt: string; // ISO 8601
}

/** POST /v1/folders/:folderId/move 응답 - 폴더 이동 */
export interface MoveFolderResponse {
  id: string;
  name: string;
  parentId: string;
  path: string;
  /** 이동이 건너뛰어진 경우 true */
  skipped?: boolean;
  /** 건너뛴 사유 */
  reason?: string | null;
  storageStatus: FolderStorageStatus;
  updatedAt: string; // ISO 8601
}

/** DELETE /v1/folders/:folderId 응답 - 폴더 삭제 */
export interface DeleteFolderResponse {
  id: string;
  name: string;
  state: 'TRASHED';
  trashedAt: string; // ISO 8601
}

/** 검색 결과 - 폴더 */
export interface SearchFolderItem {
  id: string;
  name: string;
  type: 'folder';
  /** 폴더의 전체 경로 */
  path: string;
  /** 상위 폴더 ID */
  parentId: string | null;
  updatedAt: string; // ISO 8601
}

/** 검색 결과 - 파일 */
export interface SearchFileItem {
  id: string;
  name: string;
  type: 'file';
  /** 파일이 위치한 폴더의 경로 */
  path: string;
  /** 파일이 속한 폴더 ID */
  folderId: string;
  /** 파일 크기 (bytes) */
  size: number;
  mimeType: string;
  /** 등록자 ID */
  createdBy?: string;
  /** 등록자 이름 */
  createdByName?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** 검색 결과 아이템 (유니온 타입) */
export type SearchResultItem = SearchFolderItem | SearchFileItem;

/** GET /v1/folders/search 응답 - 검색 */
export interface SearchResponse {
  results: SearchResultItem[];
  pagination: PaginationInfo;
  keyword: string;
}

/** 검색 내역 아이템 */
export interface SearchHistoryItem {
  id: string;
  keyword: string;
  searchType: SearchHistoryType;
  filters: Record<string, any> | null;
  resultCount: number;
  searchedAt: string; // ISO 8601
}

/** GET /v1/folders/search/history 응답 - 검색 내역 */
export interface SearchHistoryResponse {
  items: SearchHistoryItem[];
  pagination: PaginationInfo;
}

/** DELETE /v1/folders/search/history 응답 - 전체 삭제 */
export interface DeleteAllSearchHistoryResponse {
  deletedCount: number;
}
```

---

## 4. API 상세 - 폴더 생성

새 폴더를 생성합니다. `parentId`를 `null`로 설정하면 루트에 폴더가 생성됩니다.

### 요청

```
POST /v1/folders
```

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `name` | `string` | O | 폴더 이름 | `"New Folder"` |
| `parentId` | `string \| null` | O | 상위 폴더 ID (null = 루트) | `"folder_parent123"` |

### 요청 예시

```json
{
  "name": "2026년 프로젝트",
  "parentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 응답 예시

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "2026년 프로젝트",
  "parentId": "550e8400-e29b-41d4-a716-446655440000",
  "path": "/문서/2026년 프로젝트",
  "storageStatus": {
    "nas": "SYNCING"
  },
  "createdAt": "2026-02-12T10:00:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 잘못된 폴더명 | 입력값 검증 |
| `404` | 상위 폴더를 찾을 수 없음 | parentId 확인 |
| `409` | 동일한 이름의 폴더가 이미 존재함 | 이름 변경 안내 |

### fetch 예시

```typescript
const response = await fetch('/v1/folders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: '2026년 프로젝트',
    parentId: '550e8400-e29b-41d4-a716-446655440000',
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: CreateFolderResponse = await response.json();
```

---

## 5. API 상세 - 루트 폴더 정보 조회

루트 폴더의 상세 정보를 조회합니다. 기본 정보, 직계 파일/폴더 수, 하위 전체 파일 크기 합계를 포함합니다.

### 요청

```
GET /v1/folders/root
```

파라미터 없음.

### 응답 예시

```json
{
  "id": "root-folder-uuid",
  "name": "Root",
  "parentId": null,
  "path": "/",
  "state": "ACTIVE",
  "storageStatus": {
    "nas": "AVAILABLE"
  },
  "fileCount": 15,
  "folderCount": 3,
  "totalSize": 52428800,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2026-02-10T14:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `404` | 루트 폴더를 찾을 수 없음 | 시스템 관리자에게 문의 |

### fetch 예시

```typescript
const response = await fetch('/v1/folders/root', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: FolderInfoResponse = await response.json();
```

---

## 6. API 상세 - 폴더 정보 조회

특정 폴더의 상세 정보를 조회합니다. 기본 정보, 직계 파일/폴더 수, 하위 전체 파일 크기 합계를 포함합니다.

### 요청

```
GET /v1/folders/:folderId
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `folderId` | `string (UUID)` | 폴더 ID | `550e8400-e29b-41d4-a716-446655440000` |

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "문서",
  "parentId": "root-folder-uuid",
  "path": "/문서",
  "state": "ACTIVE",
  "storageStatus": {
    "nas": "AVAILABLE"
  },
  "fileCount": 15,
  "folderCount": 3,
  "totalSize": 52428800,
  "createdAt": "2025-06-15T09:00:00.000Z",
  "updatedAt": "2026-02-10T14:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `404` | 폴더를 찾을 수 없음 | folderId 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/folders/${folderId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: FolderInfoResponse = await response.json();
```

---

## 7. API 상세 - 폴더 내용 조회

폴더 내의 하위 폴더와 파일 목록을 조회합니다. 정렬, 페이지네이션을 지원합니다.

### 요청

```
GET /v1/folders/:folderId/contents
```

**Path 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `folderId` | `string (UUID)` | 폴더 ID | `550e8400-e29b-41d4-a716-446655440000` |

**Query 파라미터**

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `sortBy` | `SortBy` | X | `name` | 정렬 기준 (name, type, createdAt, updatedAt, size) |
| `sortOrder` | `SortOrder` | X | `asc` | 정렬 순서 (asc, desc) |
| `page` | `number` | X | `1` | 페이지 번호 (1부터 시작) |
| `pageSize` | `number` | X | `50` | 페이지 크기 (1~100) |

### 응답 예시

```json
{
  "folderId": "550e8400-e29b-41d4-a716-446655440000",
  "path": "/문서",
  "breadcrumbs": [
    { "id": "root-folder-uuid", "name": "Root" },
    { "id": "550e8400-e29b-41d4-a716-446655440000", "name": "문서" }
  ],
  "folders": [
    {
      "id": "folder-001-uuid",
      "name": "2026년 회의록",
      "path": "/문서/2026년 회의록",
      "storageStatus": {
        "nas": "AVAILABLE"
      },
      "fileCount": 12,
      "folderCount": 0,
      "createdBy": "user-uuid-001",
      "updatedAt": "2026-02-10T14:30:00.000Z"
    }
  ],
  "files": [
    {
      "id": "file-001-uuid",
      "name": "프로젝트 계획서.docx",
      "size": 102400,
      "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "storageStatus": {
        "cache": "AVAILABLE",
        "nas": "AVAILABLE"
      },
      "createdBy": "user-uuid-002",
      "updatedAt": "2026-02-11T09:15:00.000Z",
      "pendingActionRequest": null
    },
    {
      "id": "file-002-uuid",
      "name": "보고서.pdf",
      "size": 2048000,
      "mimeType": "application/pdf",
      "storageStatus": {
        "cache": null,
        "nas": "AVAILABLE"
      },
      "createdBy": "user-uuid-001",
      "updatedAt": "2026-02-08T16:00:00.000Z",
      "pendingActionRequest": {
        "id": "action-req-uuid",
        "type": "MOVE",
        "status": "PENDING",
        "requestedAt": "2026-02-12T08:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 125,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 잘못된 쿼리 파라미터 | sortBy, sortOrder, page, pageSize 값 확인 |
| `404` | 폴더를 찾을 수 없음 | folderId 확인 |

### fetch 예시

```typescript
const params = new URLSearchParams({
  sortBy: 'name',
  sortOrder: 'asc',
  page: '1',
  pageSize: '50',
});

const response = await fetch(`/v1/folders/${folderId}/contents?${params}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: FolderContentsResponse = await response.json();
```

---

## 8. API 상세 - 폴더명 변경

폴더의 이름을 변경합니다. 동일한 이름의 폴더가 존재하면 에러가 발생합니다.

### 요청

```
PUT /v1/folders/:folderId/rename
```

**Path 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `folderId` | `string (UUID)` | 폴더 ID | `550e8400-e29b-41d4-a716-446655440000` |

**Body**

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `newName` | `string` | O | 새 폴더명 | `"변경된 폴더명"` |

### 요청 예시

```json
{
  "newName": "2026년 보고서"
}
```

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "2026년 보고서",
  "path": "/문서/2026년 보고서",
  "storageStatus": {
    "nas": "SYNCING"
  },
  "updatedAt": "2026-02-12T10:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 잘못된 폴더명 | 입력값 검증 |
| `404` | 폴더를 찾을 수 없음 | folderId 확인 |
| `409` | 동일한 이름의 폴더가 이미 존재함 | 이름 변경 안내 |

### fetch 예시

```typescript
const response = await fetch(`/v1/folders/${folderId}/rename`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    newName: '2026년 보고서',
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: RenameFolderResponse = await response.json();
```

---

## 9. API 상세 - 폴더 이동

폴더를 다른 위치로 이동합니다. 자신의 하위 폴더로는 이동할 수 없으며, 하위 파일/폴더도 함께 이동됩니다.

### 요청

```
POST /v1/folders/:folderId/move
```

**Path 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `folderId` | `string (UUID)` | 이동할 폴더 ID | `550e8400-e29b-41d4-a716-446655440000` |

**Body**

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| `targetParentId` | `string` | O | 이동 대상 상위 폴더 ID | `"folder_target123"` |

### 요청 예시

```json
{
  "targetParentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "문서",
  "parentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "path": "/아카이브/문서",
  "skipped": false,
  "reason": null,
  "storageStatus": {
    "nas": "SYNCING"
  },
  "updatedAt": "2026-02-12T11:00:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 잘못된 요청 (자기 자신의 하위로 이동 등) | 이동 대상 확인 |
| `404` | 폴더 또는 대상 폴더를 찾을 수 없음 | ID 확인 |
| `409` | 동일한 이름의 폴더가 이미 존재함 (ERROR 전략) | 이름 변경 후 재시도 |

### fetch 예시

```typescript
const response = await fetch(`/v1/folders/${folderId}/move`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    targetParentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  }),
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: MoveFolderResponse = await response.json();
```

---

## 10. API 상세 - 폴더 삭제 (휴지통 이동)

폴더를 휴지통으로 이동합니다. 영구삭제가 아닌 휴지통 이동이며, 하위 파일/폴더가 있으면 실행되지 않습니다.

### 요청

```
DELETE /v1/folders/:folderId
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `folderId` | `string (UUID)` | 삭제할 폴더 ID | `550e8400-e29b-41d4-a716-446655440000` |

### 응답 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "문서",
  "state": "TRASHED",
  "trashedAt": "2026-02-12T11:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 하위 파일/폴더가 있어 삭제할 수 없음 | 하위 항목 먼저 삭제 |
| `404` | 폴더를 찾을 수 없음 | folderId 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/folders/${folderId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: DeleteFolderResponse = await response.json();
```

---

## 11. API 상세 - 파일/폴더 검색

키워드로 파일명, 폴더명을 검색합니다. 파일 전용 고급 필터(mimeType, 등록자, 등록 기간)를 지원합니다.

> **참고**: 고급 필터(`mimeType`, `createdBy`, `createdAtFrom`, `createdAtTo`)는 `type=folder`로 검색할 때는 적용되지 않습니다.

### 요청

```
GET /v1/folders/search
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `keyword` | `string` | O | - | 검색 키워드 (최소 2자) |
| `type` | `'file' \| 'folder'` | X | 전체 | 검색 대상 타입 |
| `mimeType` | `string` | X | - | 파일 유형 필터 (부분 일치) |
| `createdBy` | `string` | X | - | 등록자 이름으로 검색 (부분 일치) |
| `createdAtFrom` | `string` | X | - | 등록 기간 시작일 (ISO 8601) |
| `createdAtTo` | `string` | X | - | 등록 기간 종료일 (ISO 8601) |
| `sortBy` | `SortBy` | X | `updatedAt` | 정렬 기준 |
| `sortOrder` | `SortOrder` | X | `desc` | 정렬 순서 |
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `50` | 페이지 크기 (1~100) |

### 응답 예시

```json
{
  "results": [
    {
      "id": "file-001-uuid",
      "name": "2026년 회의록.docx",
      "type": "file",
      "path": "/문서/회의",
      "folderId": "folder-uuid",
      "size": 102400,
      "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "createdBy": "user-uuid-001",
      "createdByName": "홍길동",
      "createdAt": "2026-01-20T09:00:00.000Z",
      "updatedAt": "2026-02-10T14:30:00.000Z"
    },
    {
      "id": "folder-002-uuid",
      "name": "회의록 모음",
      "type": "folder",
      "path": "/문서/회의록 모음",
      "parentId": "parent-uuid",
      "updatedAt": "2026-02-08T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 125,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "keyword": "회의록"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 잘못된 검색 파라미터 (키워드 2자 미만 등) | 입력값 검증 |

### fetch 예시

```typescript
const params = new URLSearchParams({
  keyword: '회의록',
  type: 'file',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  page: '1',
  pageSize: '50',
});

const response = await fetch(`/v1/folders/search?${params}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: SearchResponse = await response.json();
```

---

## 12. API 상세 - 내 검색 내역 조회

현재 로그인한 사용자의 검색 기록을 최신순으로 조회합니다. 동일한 키워드/검색타입으로 재검색 시 기존 내역이 갱신됩니다.

### 요청

```
GET /v1/folders/search/history
```

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | X | `1` | 페이지 번호 |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~50) |

### 응답 예시

```json
{
  "items": [
    {
      "id": "history-uuid-001",
      "keyword": "회의록",
      "searchType": "all",
      "filters": null,
      "resultCount": 15,
      "searchedAt": "2026-02-12T09:00:00.000Z"
    },
    {
      "id": "history-uuid-002",
      "keyword": "보고서",
      "searchType": "file",
      "filters": { "mimeType": "application/pdf" },
      "resultCount": 8,
      "searchedAt": "2026-02-11T16:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 42,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### fetch 예시

```typescript
const params = new URLSearchParams({
  page: '1',
  pageSize: '20',
});

const response = await fetch(`/v1/folders/search/history?${params}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: SearchHistoryResponse = await response.json();
```

---

## 13. API 상세 - 검색 내역 단건 삭제

지정한 검색 내역 1건을 삭제합니다. 본인의 검색 내역만 삭제 가능합니다.

### 요청

```
DELETE /v1/folders/search/history/:historyId
```

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `historyId` | `string (UUID)` | 검색 내역 ID | `history-uuid-001` |

### 응답

성공 시 `204 No Content` (본문 없음)

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `404` | 검색 내역을 찾을 수 없음 (다른 사용자의 내역 포함) | historyId 확인 |

### fetch 예시

```typescript
const response = await fetch(`/v1/folders/search/history/${historyId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

// 204 No Content - 본문 없음
```

---

## 14. API 상세 - 전체 검색 내역 삭제

현재 로그인한 사용자의 모든 검색 내역을 삭제합니다.

### 요청

```
DELETE /v1/folders/search/history
```

파라미터 없음.

### 응답 예시

```json
{
  "deletedCount": 15
}
```

### fetch 예시

```typescript
const response = await fetch('/v1/folders/search/history', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message);
}

const data: DeleteAllSearchHistoryResponse = await response.json();
console.log(`${data.deletedCount}건 삭제 완료`);
```

---

## Enum 값 정리

### FolderState (폴더 상태)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `ACTIVE` | 활성 상태 | - (기본 상태) |
| `TRASHED` | 휴지통에 있는 상태 | 🗑️ 휴지통 |
| `DELETED` | 영구 삭제됨 | - (조회 불가) |

### FolderAvailabilityStatus (폴더 스토리지 상태)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `AVAILABLE` | 사용 가능 | 정상 |
| `SYNCING` | 동기화 중 | 동기화 중... |
| `MOVING` | 이동 중 | 이동 중... |
| `ERROR` | 오류 발생 | 오류 |

### SortBy (정렬 기준)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `name` | 이름순 | 이름 |
| `type` | 유형순 (mimeType 기준, 폴더는 'folder') | 유형 |
| `createdAt` | 생성일순 | 등록일 |
| `updatedAt` | 수정일순 | 수정일 |
| `size` | 크기순 (파일만, 폴더는 0) | 크기 |

### SortOrder (정렬 순서)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `asc` | 오름차순 | ↑ 오름차순 |
| `desc` | 내림차순 | ↓ 내림차순 |

### SearchResultType (검색 결과 타입)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `file` | 파일 | 📄 파일 |
| `folder` | 폴더 | 📁 폴더 |

### SearchHistoryType (검색 내역 타입)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `all` | 전체 검색 | 전체 |
| `file` | 파일만 검색 | 파일 |
| `folder` | 폴더만 검색 | 폴더 |

### PendingActionType (PENDING 작업 타입)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `MOVE` | 이동 요청 대기 중 | 이동 대기 |
| `DELETE` | 삭제 요청 대기 중 | 삭제 대기 |

---

## 에러 처리

### 공통 HTTP 상태 코드

| 코드 | 의미 | 프론트엔드 대응 |
|------|------|----------------|
| `200` | 성공 | 정상 처리 |
| `201` | 생성 성공 | 정상 처리 + 성공 알림 |
| `204` | 삭제 성공 (본문 없음) | 정상 처리 + 성공 알림 |
| `400` | 요청 유효성 실패 | 필드별 에러 메시지 표시 |
| `401` | 인증 만료/없음 | 로그인 페이지로 리다이렉트 |
| `403` | 권한 없음 | "권한이 없습니다" 표시 |
| `404` | 리소스 없음 | "찾을 수 없습니다" 표시 |
| `409` | 충돌 (중복 등) | 충돌 상세 정보 표시 |
| `500` | 서버 오류 | "서버 오류가 발생했습니다" 표시 |

### Validation 에러 응답 형식 (400)

```json
{
  "statusCode": 400,
  "message": [
    "폴더명은 필수입니다.",
    "상위 폴더 ID는 문자열이어야 합니다."
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

  // 204 No Content는 본문이 없음
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
```

---

## cURL 테스트

```bash
# 토큰 발급 (로그인)
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "password"}' | jq -r '.accessToken')

# 1. 폴더 생성
curl -X POST http://localhost:3000/v1/folders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "2026년 프로젝트", "parentId": null}' | jq

# 2. 루트 폴더 정보 조회
curl http://localhost:3000/v1/folders/root \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. 폴더 정보 조회
curl http://localhost:3000/v1/folders/{folderId} \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. 폴더 내용 조회 (하위 폴더/파일)
curl "http://localhost:3000/v1/folders/{folderId}/contents?sortBy=name&sortOrder=asc&page=1&pageSize=50" \
  -H "Authorization: Bearer $TOKEN" | jq

# 5. 폴더명 변경
curl -X PUT http://localhost:3000/v1/folders/{folderId}/rename \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newName": "변경된 폴더명"}' | jq

# 6. 폴더 이동
curl -X POST http://localhost:3000/v1/folders/{folderId}/move \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetParentId": "target-folder-uuid"}' | jq

# 7. 폴더 삭제 (휴지통 이동)
curl -X DELETE http://localhost:3000/v1/folders/{folderId} \
  -H "Authorization: Bearer $TOKEN" | jq

# 8. 파일/폴더 검색
curl "http://localhost:3000/v1/folders/search?keyword=회의록&type=file&sortBy=updatedAt&sortOrder=desc&page=1&pageSize=50" \
  -H "Authorization: Bearer $TOKEN" | jq

# 9. 내 검색 내역 조회
curl "http://localhost:3000/v1/folders/search/history?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" | jq

# 10. 검색 내역 단건 삭제
curl -X DELETE http://localhost:3000/v1/folders/search/history/{historyId} \
  -H "Authorization: Bearer $TOKEN"

# 11. 전체 검색 내역 삭제
curl -X DELETE http://localhost:3000/v1/folders/search/history \
  -H "Authorization: Bearer $TOKEN" | jq
```
