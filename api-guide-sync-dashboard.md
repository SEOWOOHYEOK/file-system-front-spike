# 동기화 대시보드 - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `500.관리자` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [API 상세 - 대시보드 요약](#4-api-상세---대시보드-요약)
5. [API 상세 - 이벤트 목록](#5-api-상세---이벤트-목록)
6. [Enum 값 정리](#6-enum-값-정리)
7. [에러 처리](#7-에러-처리)
8. [cURL 테스트](#8-curl-테스트)

---

## 1. API 개요

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| `GET` | `/v1/admin/sync/dashboard/summary` | 동기화 대시보드 요약 (상태별 카운트) | Bearer |
| `GET` | `/v1/admin/sync/dashboard/events` | 동기화 이벤트 목록 (필터 + 페이지네이션) | Bearer |

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
// types/sync-dashboard.ts

// ─── Enum 타입 ───

/** 동기화 이벤트 상태 */
type SyncEventStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'RETRYING'
  | 'DONE'
  | 'FAILED';

/** 동기화 이벤트 타입 */
type SyncEventType =
  | 'CREATE'
  | 'MOVE'
  | 'DELETE'
  | 'RENAME'
  | 'TRASH'
  | 'RESTORE'
  | 'PURGE';

/** 동기화 대상 타입 */
type SyncEventTargetType = 'FILE' | 'FOLDER';

/** 정렬 순서 */
type SortOrder = 'asc' | 'desc';

// ─── 요청 타입 ───

/** GET /v1/admin/sync/dashboard/events 쿼리 파라미터 */
export interface SyncDashboardEventsQuery {
  /** 동기화 상태 필터 */
  status?: SyncEventStatus;
  /** 이벤트 타입 필터 */
  eventType?: SyncEventType;
  /** 대상 타입 필터 (FILE/FOLDER) */
  targetType?: SyncEventTargetType;
  /** 사용자 ID 필터 (UUID) */
  userId?: string;
  /** 시작 날짜 (YYYY-MM-DD) */
  fromDate?: string;
  /** 종료 날짜 (YYYY-MM-DD) */
  toDate?: string;
  /** 페이지 번호 (기본: 1) */
  page?: number;
  /** 페이지 크기 (기본: 20, 최대: 100) */
  pageSize?: number;
  /** 정렬 기준 (createdAt, updatedAt, status, eventType) */
  sortBy?: string;
  /** 정렬 순서 (기본: desc) */
  sortOrder?: SortOrder;
}

// ─── 응답 타입 ───

/** GET /v1/admin/sync/dashboard/summary 응답 */
export interface SyncDashboardSummaryResponse {
  /** 전체 이벤트 수 */
  total: number;
  /** PENDING 수 */
  pending: number;
  /** QUEUED 수 */
  queued: number;
  /** PROCESSING 수 */
  processing: number;
  /** RETRYING 수 */
  retrying: number;
  /** DONE 수 */
  done: number;
  /** FAILED 수 */
  failed: number;
  /** stuck 상태 수 (PENDING 1시간+ 또는 PROCESSING 30분+) */
  stuckCount: number;
  /** 조회 시각 (ISO 8601) */
  checkedAt: string;
}

/** 요청자 정보 */
export interface RequesterInfo {
  /** 사용자 ID (UUID) */
  userId: string;
  /** 이름 */
  name: string;
  /** 부서 (없으면 null) */
  department: string | null;
}

/** 동기화 이벤트 아이템 */
export interface SyncDashboardEventItem {
  /** 이벤트 ID (UUID) */
  id: string;
  /** 동기화 상태 */
  status: SyncEventStatus;
  /** 이벤트 타입 */
  eventType: SyncEventType;
  /** 대상 타입 */
  targetType: SyncEventTargetType;
  /** 파일 ID (FILE일 때, UUID) */
  fileId: string | null;
  /** 폴더 ID (FOLDER일 때, UUID) */
  folderId: string | null;
  /** 파일/폴더 이름 */
  fileName: string;
  /** 대상 경로 */
  filePath: string;
  /** 파일 크기 bytes (FILE일 때만, FOLDER는 null) */
  fileSize: number | null;
  /** 포맷된 크기 (FILE일 때만, 예: "1.50 MB") */
  fileSizeFormatted: string | null;
  /** 처리 완료 시각 (ISO 8601, 미완료시 null) */
  completedAt: string | null;
  /** 소요 시간 초 (미완료시 null) */
  duration: number | null;
  /** 재시도 횟수 */
  retryCount: number;
  /** 최대 재시도 횟수 */
  maxRetries: number;
  /** 요청자 정보 */
  requester: RequesterInfo;
  /** 에러 메시지 (없으면 null) */
  errorMessage: string | null;
  /** stuck 상태 여부 */
  isStuck: boolean;
  /** 생성 시각 (ISO 8601) */
  createdAt: string;
  /** 수정 시각 (ISO 8601) */
  updatedAt: string;
}

// ─── 페이지네이션 ───

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** GET /v1/admin/sync/dashboard/events 응답 */
export type SyncDashboardEventsResponse = PaginatedResponse<SyncDashboardEventItem>;
```

---

## 4. API 상세 - 대시보드 요약

전체 동기화 이벤트 상태별 카운트와 stuck 수를 반환합니다.

- **상태별 카운트:** PENDING, QUEUED, PROCESSING, RETRYING, DONE, FAILED
- **stuck 수:** PENDING 1시간 이상 + PROCESSING 30분 이상

### 요청

```
GET /v1/admin/sync/dashboard/summary
```

파라미터 없음.

### 응답 예시

```json
{
  "total": 150,
  "pending": 10,
  "queued": 5,
  "processing": 3,
  "retrying": 2,
  "done": 120,
  "failed": 10,
  "stuckCount": 2,
  "checkedAt": "2026-02-10T09:30:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |

### fetch 예시

```typescript
async function fetchSyncDashboardSummary(): Promise<SyncDashboardSummaryResponse> {
  const response = await fetch('/v1/admin/sync/dashboard/summary', {
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

// 사용 예시
const summary = await fetchSyncDashboardSummary();
console.log(`전체: ${summary.total}, 실패: ${summary.failed}, stuck: ${summary.stuckCount}`);
```

---

## 5. API 상세 - 이벤트 목록

필터와 페이지네이션으로 동기화 이벤트 목록을 조회합니다. 각 이벤트에는 파일 정보, 요청자 정보(이름, 부서), stuck 상태가 포함됩니다.

### 요청

```
GET /v1/admin/sync/dashboard/events
```

#### Query 파라미터

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `status` | `SyncEventStatus` | X | - | 동기화 상태 필터 |
| `eventType` | `SyncEventType` | X | - | 이벤트 타입 필터 |
| `targetType` | `SyncEventTargetType` | X | - | 대상 타입 필터 (FILE/FOLDER) |
| `userId` | `string (UUID)` | X | - | 사용자 ID 필터 |
| `fromDate` | `string (YYYY-MM-DD)` | X | - | 시작 날짜 |
| `toDate` | `string (YYYY-MM-DD)` | X | - | 종료 날짜 |
| `page` | `number` | X | `1` | 페이지 번호 (1 이상) |
| `pageSize` | `number` | X | `20` | 페이지 크기 (1~100) |
| `sortBy` | `string` | X | `createdAt` | 정렬 기준 (`createdAt`, `updatedAt`, `status`, `eventType`) |
| `sortOrder` | `'asc' \| 'desc'` | X | `desc` | 정렬 순서 |

### 요청 예시

```
GET /v1/admin/sync/dashboard/events?status=FAILED&targetType=FILE&page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
```

```
GET /v1/admin/sync/dashboard/events?fromDate=2026-02-09&toDate=2026-02-10&userId=550e8400-e29b-41d4-a716-446655440000
```

### 응답 예시

```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "FAILED",
      "eventType": "CREATE",
      "targetType": "FILE",
      "fileId": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "folderId": null,
      "fileName": "보고서_2026Q1.xlsx",
      "filePath": "/부서공유/기획팀/보고서_2026Q1.xlsx",
      "fileSize": 1572864,
      "fileSizeFormatted": "1.50 MB",
      "completedAt": null,
      "duration": null,
      "retryCount": 3,
      "maxRetries": 3,
      "requester": {
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "name": "김민수",
        "department": "기획팀"
      },
      "errorMessage": "NAS connection timeout after 30s",
      "isStuck": false,
      "createdAt": "2026-02-10T08:15:30.000Z",
      "updatedAt": "2026-02-10T08:45:30.000Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "status": "PROCESSING",
      "eventType": "MOVE",
      "targetType": "FOLDER",
      "fileId": null,
      "folderId": "d4e5f6a7-b8c9-0123-defg-h12345678901",
      "fileName": "기획팀",
      "filePath": "/부서공유/경영지원/기획팀",
      "fileSize": null,
      "fileSizeFormatted": null,
      "completedAt": null,
      "duration": null,
      "retryCount": 0,
      "maxRetries": 3,
      "requester": {
        "userId": "660e8400-e29b-41d4-a716-446655440001",
        "name": "이영희",
        "department": "경영지원팀"
      },
      "errorMessage": null,
      "isStuck": true,
      "createdAt": "2026-02-10T07:00:00.000Z",
      "updatedAt": "2026-02-10T07:00:00.000Z"
    },
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-g12345678902",
      "status": "DONE",
      "eventType": "RENAME",
      "targetType": "FILE",
      "fileId": "e5f6a7b8-c9d0-1234-efgh-i12345678902",
      "folderId": null,
      "fileName": "최종_보고서.pdf",
      "filePath": "/부서공유/기획팀/최종_보고서.pdf",
      "fileSize": 524288,
      "fileSizeFormatted": "512.00 KB",
      "completedAt": "2026-02-10T08:20:05.000Z",
      "duration": 5,
      "retryCount": 0,
      "maxRetries": 3,
      "requester": {
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "name": "김민수",
        "department": "기획팀"
      },
      "errorMessage": null,
      "isStuck": false,
      "createdAt": "2026-02-10T08:20:00.000Z",
      "updatedAt": "2026-02-10T08:20:05.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 47,
  "totalPages": 3,
  "hasNext": true,
  "hasPrev": false
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `400` | 유효성 검사 실패 (잘못된 enum, UUID, 날짜 형식 등) | 입력값 확인 |
| `401` | 인증 필요 | 토큰 재발급 |

### fetch 예시

```typescript
async function fetchSyncDashboardEvents(
  query: SyncDashboardEventsQuery = {},
): Promise<SyncDashboardEventsResponse> {
  const params = new URLSearchParams();

  if (query.status) params.set('status', query.status);
  if (query.eventType) params.set('eventType', query.eventType);
  if (query.targetType) params.set('targetType', query.targetType);
  if (query.userId) params.set('userId', query.userId);
  if (query.fromDate) params.set('fromDate', query.fromDate);
  if (query.toDate) params.set('toDate', query.toDate);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const url = `/v1/admin/sync/dashboard/events?${params.toString()}`;

  const response = await fetch(url, {
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

// 사용 예시: 실패한 파일 이벤트만 조회
const failedFiles = await fetchSyncDashboardEvents({
  status: 'FAILED',
  targetType: 'FILE',
  page: 1,
  pageSize: 20,
});

// 사용 예시: 특정 기간 + 사용자 필터
const userEvents = await fetchSyncDashboardEvents({
  userId: '550e8400-e29b-41d4-a716-446655440000',
  fromDate: '2026-02-09',
  toDate: '2026-02-10',
});

// 사용 예시: 다음 페이지 로드
if (failedFiles.hasNext) {
  const nextPage = await fetchSyncDashboardEvents({
    status: 'FAILED',
    targetType: 'FILE',
    page: failedFiles.page + 1,
    pageSize: 20,
  });
}
```

---

## 6. Enum 값 정리

### SyncEventStatus (동기화 상태)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `PENDING` | 트랜잭션 내 생성, 큐 미등록 | 대기 중 |
| `QUEUED` | 큐에 등록됨 | 큐 대기 |
| `PROCESSING` | Worker가 처리 중 | 처리 중 |
| `RETRYING` | 재시도 중 | 재시도 중 |
| `DONE` | 처리 완료 | 완료 |
| `FAILED` | 최대 재시도 후 실패 | 실패 |

> **stuck 판단 기준:** `PENDING` 1시간 이상 또는 `PROCESSING` 30분 이상이면 `isStuck: true`

### SyncEventType (이벤트 타입)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `CREATE` | 파일 업로드/수정 (캐시→NAS 복사) | 생성 |
| `MOVE` | 파일/폴더 이동 | 이동 |
| `DELETE` | 영구 삭제 | 삭제 |
| `RENAME` | 이름 변경 | 이름변경 |
| `TRASH` | 휴지통 이동 | 휴지통 |
| `RESTORE` | 휴지통에서 복구 | 복구 |
| `PURGE` | 완전 삭제 | 완전삭제 |

### SyncEventTargetType (대상 타입)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `FILE` | 파일 | 파일 |
| `FOLDER` | 폴더 | 폴더 |

---

## 7. 에러 처리

### 공통 HTTP 상태 코드

| 코드 | 의미 | 프론트엔드 대응 |
|------|------|----------------|
| `200` | 성공 | 정상 처리 |
| `400` | 요청 유효성 실패 | 필드별 에러 메시지 표시 |
| `401` | 인증 만료/없음 | 로그인 페이지로 리다이렉트 |
| `500` | 서버 오류 | "서버 오류가 발생했습니다" 표시 |

### Validation 에러 응답 형식 (400)

```json
{
  "statusCode": 400,
  "message": [
    "유효한 동기화 상태를 입력하세요.",
    "유효한 UUID를 입력하세요."
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

## 8. cURL 테스트

```bash
# 토큰 발급 (로그인)
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "password"}' | jq -r '.accessToken')

# ─── 대시보드 요약 조회 ───
curl -s -X GET http://localhost:3000/v1/admin/sync/dashboard/summary \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 이벤트 목록 조회 (전체, 1페이지) ───
curl -s -X GET "http://localhost:3000/v1/admin/sync/dashboard/events?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 실패한 이벤트만 조회 ───
curl -s -X GET "http://localhost:3000/v1/admin/sync/dashboard/events?status=FAILED&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 파일 타입만 + 날짜 범위 필터 ───
curl -s -X GET "http://localhost:3000/v1/admin/sync/dashboard/events?targetType=FILE&fromDate=2026-02-09&toDate=2026-02-10" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 특정 사용자의 이벤트 조회 ───
curl -s -X GET "http://localhost:3000/v1/admin/sync/dashboard/events?userId=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $TOKEN" | jq

# ─── 2페이지 조회 ───
curl -s -X GET "http://localhost:3000/v1/admin/sync/dashboard/events?page=2&pageSize=10&sortBy=updatedAt&sortOrder=asc" \
  -H "Authorization: Bearer $TOKEN" | jq
```
