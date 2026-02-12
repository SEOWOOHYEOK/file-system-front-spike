# 관리자 - 감사 로그 및 통합 타임라인 API - 프론트엔드 연동 가이드

> **Swagger 태그:** `806.관리자 - audit log 확인`
> **최종 업데이트:** 2026-02-12
> **필수 권한:** `AUDIT_READ`

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [감사 로그 목록 조회](#4-감사-로그-목록-조회)
5. [감사 로그 상세 조회](#5-감사-로그-상세-조회)
6. [특정 사용자의 감사 로그 조회](#6-특정-사용자의-감사-로그-조회)
7. [특정 대상의 접근 이력 조회](#7-특정-대상의-접근-이력-조회)
8. [특정 세션의 활동 로그 조회](#8-특정-세션의-활동-로그-조회)
9. [파일 이력 목록 조회](#9-파일-이력-목록-조회)
10. [특정 파일의 변경 이력 조회](#10-특정-파일의-변경-이력-조회)
11. [특정 파일의 특정 버전 조회](#11-특정-파일의-특정-버전-조회)
12. [특정 사용자가 변경한 파일 이력 조회](#12-특정-사용자가-변경한-파일-이력-조회)
13. [시간 범위 통합 타임라인 조회](#13-시간-범위-통합-타임라인-조회)
14. [파일 중심 타임라인 조회](#14-파일-중심-타임라인-조회)
15. [사용자 중심 타임라인 조회](#15-사용자-중심-타임라인-조회)
16. [HTTP 요청 추적](#16-http-요청-추적)
17. [트레이스 추적](#17-트레이스-추적)
18. [이벤트 인과관계 체인 조회](#18-이벤트-인과관계-체인-조회)
19. [에러 처리](#19-에러-처리)
20. [cURL 테스트](#20-curl-테스트)

---

## 1. API 개요

이 API 그룹은 **두 개의 컨트롤러**로 구성됩니다:

### 감사 로그 컨트롤러 (`/admin/audit-logs`)

| # | Method | Endpoint | 설명 |
|---|--------|----------|------|
| 1 | `GET` | `/admin/audit-logs` | 감사 로그 목록 조회 (페이지네이션 + 필터) |
| 2 | `GET` | `/admin/audit-logs/:id` | 감사 로그 상세 조회 |
| 3 | `GET` | `/admin/audit-logs/user/:userId` | 특정 사용자의 감사 로그 조회 |
| 4 | `GET` | `/admin/audit-logs/target/:targetType/:targetId` | 특정 대상의 접근 이력 조회 |
| 5 | `GET` | `/admin/audit-logs/session/:sessionId` | 특정 세션의 활동 로그 조회 |
| 6 | `GET` | `/admin/audit-logs/file-history` | 파일 이력 목록 조회 (페이지네이션 + 필터) |
| 7 | `GET` | `/admin/audit-logs/file-history/file/:fileId` | 특정 파일의 변경 이력 조회 |
| 8 | `GET` | `/admin/audit-logs/file-history/file/:fileId/version/:version` | 특정 파일의 특정 버전 조회 |
| 9 | `GET` | `/admin/audit-logs/file-history/user/:userId` | 특정 사용자가 변경한 파일 이력 조회 |

### 통합 타임라인 컨트롤러 (`/v1/admin/timeline`)

| # | Method | Endpoint | 설명 |
|---|--------|----------|------|
| 10 | `GET` | `/v1/admin/timeline` | 시간 범위 통합 타임라인 조회 |
| 11 | `GET` | `/v1/admin/timeline/files/:fileId` | 파일 중심 타임라인 조회 |
| 12 | `GET` | `/v1/admin/timeline/actors/:actorId` | 사용자 중심 타임라인 조회 |
| 13 | `GET` | `/v1/admin/timeline/requests/:requestId` | HTTP 요청 추적 |
| 14 | `GET` | `/v1/admin/timeline/traces/:traceId` | 트레이스 추적 |
| 15 | `GET` | `/v1/admin/timeline/events/:eventId/chain` | 이벤트 인과관계 체인 조회 |

---

## 2. 인증

모든 API에 **Bearer Token** 인증이 필요합니다. 또한 `AUDIT_READ` 권한이 있는 역할이 할당된 관리자만 접근 가능합니다.

```typescript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
};
```

---

## 3. TypeScript 타입 정의

### Enum 타입

```typescript
/** 감사 행위 타입 */
type AuditAction =
  // 파일 관련
  | 'FILE_VIEW'        // 파일 조회
  | 'FILE_DOWNLOAD'    // 파일 다운로드
  | 'FILE_UPLOAD'      // 파일 업로드
  | 'FILE_RENAME'      // 파일 이름 변경
  | 'FILE_MOVE'        // 파일 이동
  | 'FILE_DELETE'      // 파일 삭제 (휴지통 이동)
  | 'FILE_RESTORE'     // 파일 복원
  | 'FILE_PURGE'       // 파일 영구 삭제
  // 폴더 관련
  | 'FOLDER_CREATE'    // 폴더 생성
  | 'FOLDER_VIEW'      // 폴더 조회
  | 'FOLDER_RENAME'    // 폴더 이름 변경
  | 'FOLDER_MOVE'      // 폴더 이동
  | 'FOLDER_DELETE'    // 폴더 삭제
  // 공유 관련
  | 'SHARE_CREATE'     // 공유 링크 생성
  | 'SHARE_REVOKE'     // 공유 링크 해제
  | 'SHARE_ACCESS'     // 공유 링크 접근
  | 'SHARE_DOWNLOAD'   // 공유 파일 다운로드
  | 'SHARE_BLOCK'      // 공유 링크 차단
  | 'SHARE_UNBLOCK'    // 공유 링크 차단 해제
  | 'SHARE_BULK_BLOCK'   // 공유 일괄 차단
  | 'SHARE_BULK_UNBLOCK' // 공유 일괄 차단 해제
  // 공유 요청 관련
  | 'SHARE_REQUEST_CREATE'       // 공유 요청 생성
  | 'SHARE_REQUEST_APPROVE'      // 공유 요청 승인
  | 'SHARE_REQUEST_REJECT'       // 공유 요청 거부
  | 'SHARE_REQUEST_CANCEL'       // 공유 요청 취소
  | 'SHARE_REQUEST_BULK_APPROVE' // 공유 요청 일괄 승인
  | 'SHARE_REQUEST_BULK_REJECT'  // 공유 요청 일괄 거부
  // 권한 관련
  | 'PERMISSION_GRANT'    // 권한 부여
  | 'PERMISSION_REVOKE'   // 권한 회수
  | 'PERMISSION_CHANGE'   // 권한 변경
  // 휴지통 관련
  | 'TRASH_EMPTY'  // 휴지통 비우기
  | 'TRASH_VIEW'   // 휴지통 조회
  // 즐겨찾기 관련
  | 'FAVORITE_ADD'    // 즐겨찾기 등록
  | 'FAVORITE_REMOVE' // 즐겨찾기 해제
  | 'FAVORITE_VIEW'   // 즐겨찾기 조회
  // 사용자 활동
  | 'ACTIVITY_VIEW'   // 최근 활동 조회
  // 외부 사용자 관리
  | 'EXTERNAL_USER_CREATE'         // 외부 사용자 생성
  | 'EXTERNAL_USER_UPDATE'         // 외부 사용자 수정
  | 'EXTERNAL_USER_DEACTIVATE'     // 외부 사용자 비활성화
  | 'EXTERNAL_USER_ACTIVATE'       // 외부 사용자 활성화
  | 'EXTERNAL_USER_PASSWORD_RESET' // 외부 사용자 비밀번호 초기화
  // 비밀번호
  | 'PASSWORD_CHANGE'  // 비밀번호 변경
  // 관리자 작업
  | 'USER_ROLE_ASSIGN' // 사용자 Role 부여
  | 'USER_ROLE_REMOVE' // 사용자 Role 제거
  | 'USER_SYNC'        // Employee → User 동기화
  | 'TOKEN_GENERATE'   // JWT 토큰 수동 생성
  | 'TOKEN_REFRESH'    // 토큰 갱신
  | 'ORG_MIGRATION'    // 조직 데이터 마이그레이션
  // 파일 작업 요청
  | 'FILE_ACTION_REQUEST_MOVE_CREATE'   // 파일 이동 요청 생성
  | 'FILE_ACTION_REQUEST_DELETE_CREATE' // 파일 삭제 요청 생성
  | 'FILE_ACTION_REQUEST_CANCEL'        // 파일 작업 요청 취소
  | 'FILE_ACTION_REQUEST_APPROVE'       // 파일 작업 요청 승인
  | 'FILE_ACTION_REQUEST_REJECT'        // 파일 작업 요청 반려
  | 'FILE_ACTION_REQUEST_BULK_APPROVE'  // 파일 작업 요청 일괄 승인
  | 'FILE_ACTION_REQUEST_BULK_REJECT'   // 파일 작업 요청 일괄 반려
  | 'FILE_ACTION_REQUEST_INVALIDATED'   // 파일 작업 요청 무효화
  // 외부 사용자 공유 접근
  | 'EXTERNAL_SHARE_DETAIL'   // 외부 사용자 공유 상세 조회
  | 'EXTERNAL_SHARE_ACCESS'   // 외부 사용자 파일 콘텐츠 접근
  | 'EXTERNAL_SHARE_DOWNLOAD' // 외부 사용자 파일 다운로드
  // 보안 이벤트
  | 'LOGIN_SUCCESS'             // 로그인 성공
  | 'LOGIN_FAILURE'             // 로그인 실패
  | 'LOGOUT'                    // 로그아웃
  | 'TOKEN_EXPIRED'             // 토큰 만료
  | 'PERMISSION_DENIED'         // 권한 거부
  | 'EXPIRED_LINK_ACCESS'       // 만료 링크 접근
  | 'BLOCKED_SHARE_ACCESS'      // 차단된 공유 접근
  | 'ACCESS_PATTERN_DEVIATION'  // 접근 패턴 이탈
  | 'NEW_DEVICE_ACCESS';        // 신규 기기 접근

/** 사용자 유형 */
type UserType = 'INTERNAL' | 'EXTERNAL';

/** 대상 타입 */
type TargetType =
  | 'FILE'
  | 'FOLDER'
  | 'SHARE'
  | 'USER'
  | 'FAVORITE'
  | 'ACTIVITY'
  | 'SYSTEM'
  | 'FILE_ACTION_REQUEST';

/** 로그 결과 */
type LogResult = 'SUCCESS' | 'FAIL';

/** 파일 변경 유형 */
type FileChangeType =
  | 'CREATED'           // 파일 생성
  | 'CONTENT_REPLACED'  // 내용 교체 (새 버전 업로드)
  | 'RENAMED'           // 이름 변경
  | 'MOVED'             // 위치 이동
  | 'METADATA_CHANGED'  // 메타데이터 변경
  | 'TRASHED'           // 휴지통 이동
  | 'RESTORED'          // 복원됨
  | 'DELETED';          // 영구 삭제

/** 이벤트 소스 */
type EventSource =
  | 'AUDIT'       // 사용자 행위 + 보안 이벤트
  | 'FILE_CHANGE' // 파일 상태 변경 이력
  | 'SYSTEM';     // 인프라/시스템 자동 이벤트

/** 행위 카테고리 */
type ActionCategory = 'file' | 'folder' | 'share' | 'auth' | 'admin' | 'user' | 'security' | 'external';

/** 클라이언트 타입 */
type ClientType = 'WEB' | 'MOBILE' | 'API' | 'UNKNOWN';

/** 기밀 등급 */
type Sensitivity = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
```

### 응답 타입

```typescript
/** 감사 로그 메타데이터 */
interface AuditLogMetadata {
  fileSize?: number;
  mimeType?: string;
  checksum?: string;
  shareType?: string;
  expiresAt?: string;        // ISO 8601
  permissions?: string[];
  maxAccessCount?: number;
  previousPermissions?: string[];
  newPermissions?: string[];
  changeReason?: string;
  [key: string]: unknown;
}

/** 감사 로그 항목 */
interface AuditLog {
  id: string;                    // UUID
  // 추적 필드
  requestId: string;
  sessionId?: string;
  traceId?: string;
  // 주체 필드
  userId: string;                // UUID
  userType: UserType;
  userName?: string;
  userEmail?: string;
  // 행위 필드
  action: AuditAction;
  actionCategory: ActionCategory;
  // 대상 필드
  targetType: TargetType;
  targetId: string;              // UUID
  targetName?: string;
  targetPath?: string;
  sensitivity?: Sensitivity;
  ownerId?: string;              // UUID
  // 클라이언트 필드
  ipAddress: string;
  userAgent: string;
  clientType: ClientType;
  // 결과 필드
  result: LogResult;
  resultCode?: string;
  failReason?: string;
  durationMs?: number;
  // 확장 필드
  metadata?: AuditLogMetadata;
  tags?: string[];
  // API 컨텍스트
  httpMethod?: string;
  apiEndpoint?: string;
  // 인과관계
  parentEventId?: string;        // UUID
  // 보안
  severity?: string;             // 'INFO' | 'WARN' | 'HIGH' | 'CRITICAL'
  errorCode?: string;
  // System Response
  responseStatusCode?: number;
  systemAction?: string;
  systemActionDetail?: string;
  followUpScheduled?: boolean;
  followUpAt?: string;           // ISO 8601
  retryCount?: number;
  // 설명
  description: string;
  syncEventId?: string;
  // 시간
  createdAt: string;             // ISO 8601
}

/** 파일 상태 */
interface FileState {
  name?: string;
  size?: number;
  mimeType?: string;
  folderId?: string;
  path?: string;
  [key: string]: unknown;
}

/** 파일 이력 항목 */
interface FileHistory {
  id: string;                    // UUID
  fileId: string;                // UUID
  version: number;
  changeType: FileChangeType;
  changedBy: string;             // UUID
  userType: UserType;
  previousState?: FileState;
  newState?: FileState;
  checksumBefore?: string;
  checksumAfter?: string;
  changeSummary?: string;
  description: string;
  requestId?: string;
  traceId?: string;
  parentEventId?: string;        // UUID
  httpMethod?: string;
  apiEndpoint?: string;
  errorCode?: string;
  retryCount?: number;
  tags?: string[];
  createdAt: string;             // ISO 8601
}

/** 페이지네이션 결과 (감사 로그 / 파일 이력 공통) */
interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** 관찰 가능성 이벤트 (통합 타임라인 이벤트) */
interface ObservabilityEvent {
  id: string;                    // UUID
  eventSource: EventSource;
  eventType: string;
  occurredAt: string;            // ISO 8601
  requestId?: string;
  traceId?: string;
  parentEventId?: string;        // UUID
  actorId: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  result: 'SUCCESS' | 'FAILURE';
  errorCode?: string;
  severity?: string;
  durationMs?: number;
  httpMethod?: string;
  apiEndpoint?: string;
  responseStatusCode?: number;
  systemAction?: string;
  systemActionDetail?: string;
  followUpScheduled?: boolean;
  followUpAt?: string;           // ISO 8601
  retryCount?: number;
  tags?: string[];
  description: string;
}

/** 통합 타임라인 응답 */
interface UnifiedTimelineResponse {
  events: ObservabilityEvent[];
  summary: {
    total: number;
    bySource: Record<EventSource, number>;
    byResult: {
      SUCCESS: number;
      FAILURE: number;
    };
    bySeverity?: Record<string, number>;
    timeRange: {
      earliest: string | null;   // ISO 8601
      latest: string | null;     // ISO 8601
    };
  };
  page: {
    current: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}
```

---

## 4. 감사 로그 목록 조회

### `GET /admin/audit-logs`

감사 로그를 필터 조건으로 검색합니다. 페이지네이션을 지원합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | 선택 | `1` | 페이지 번호 (최소 1) |
| `limit` | `number` | 선택 | `50` | 페이지 크기 (1~500) |
| `userId` | `string` | 선택 | - | 사용자 ID (UUID) |
| `userType` | `UserType` | 선택 | - | 사용자 유형 |
| `action` | `AuditAction` | 선택 | - | 감사 액션 |
| `targetType` | `TargetType` | 선택 | - | 대상 타입 |
| `targetId` | `string` | 선택 | - | 대상 ID (UUID) |
| `result` | `LogResult` | 선택 | - | 결과 (SUCCESS / FAIL) |
| `ipAddress` | `string` | 선택 | - | IP 주소 |
| `startDate` | `string` | 선택 | - | 조회 시작일 (ISO 8601) |
| `endDate` | `string` | 선택 | - | 조회 종료일 (ISO 8601) |

### 응답

```typescript
// 200 OK
PaginatedResult<AuditLog>
```

### fetch 예시

```typescript
async function getAuditLogs(params: {
  page?: number;
  limit?: number;
  userId?: string;
  userType?: UserType;
  action?: AuditAction;
  targetType?: TargetType;
  targetId?: string;
  result?: LogResult;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
}): Promise<PaginatedResult<AuditLog>> {
  const query = new URLSearchParams();

  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.userId) query.set('userId', params.userId);
  if (params.userType) query.set('userType', params.userType);
  if (params.action) query.set('action', params.action);
  if (params.targetType) query.set('targetType', params.targetType);
  if (params.targetId) query.set('targetId', params.targetId);
  if (params.result) query.set('result', params.result);
  if (params.ipAddress) query.set('ipAddress', params.ipAddress);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);

  const response = await fetch(`/admin/audit-logs?${query}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

### 응답 예시

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "requestId": "req-001",
      "sessionId": "sess-abc123",
      "traceId": null,
      "userId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
      "userType": "INTERNAL",
      "userName": "홍길동",
      "userEmail": "hong@company.com",
      "action": "FILE_DOWNLOAD",
      "actionCategory": "file",
      "targetType": "FILE",
      "targetId": "b1c2d3e4-f5a6-7890-bcde-f12345678901",
      "targetName": "2024_보고서.pdf",
      "targetPath": "/문서/보고서/",
      "sensitivity": "INTERNAL",
      "ownerId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
      "ipAddress": "192.168.1.10",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "clientType": "WEB",
      "result": "SUCCESS",
      "resultCode": null,
      "failReason": null,
      "durationMs": 234,
      "metadata": {
        "fileSize": 2048576,
        "mimeType": "application/pdf"
      },
      "tags": [],
      "httpMethod": "GET",
      "apiEndpoint": "/v1/files/download",
      "parentEventId": null,
      "severity": "INFO",
      "errorCode": null,
      "responseStatusCode": 200,
      "systemAction": null,
      "systemActionDetail": null,
      "followUpScheduled": false,
      "followUpAt": null,
      "retryCount": 0,
      "description": "홍길동님이 '2024_보고서.pdf' 파일을 다운로드했습니다.",
      "syncEventId": null,
      "createdAt": "2026-02-11T14:30:00.000Z"
    }
  ],
  "total": 1523,
  "page": 1,
  "limit": 50,
  "totalPages": 31
}
```

---

## 5. 감사 로그 상세 조회

### `GET /admin/audit-logs/:id`

단일 감사 로그의 상세 정보를 조회합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `id` | `string` | 필수 | 감사 로그 ID (UUID) |

### 응답

```typescript
// 200 OK
AuditLog | null

// 404 Not Found
// 감사 로그를 찾을 수 없음
```

### fetch 예시

```typescript
async function getAuditLog(id: string): Promise<AuditLog | null> {
  const response = await fetch(`/admin/audit-logs/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 6. 특정 사용자의 감사 로그 조회

### `GET /admin/audit-logs/user/:userId`

특정 사용자가 수행한 모든 감사 로그를 조회합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `userId` | `string` | 필수 | 사용자 ID (UUID) |

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `limit` | `number` | 선택 | `100` | 조회할 최대 개수 (1~1000) |

### 응답

```typescript
// 200 OK
AuditLog[]
```

### fetch 예시

```typescript
async function getAuditLogsByUser(
  userId: string,
  limit?: number,
): Promise<AuditLog[]> {
  const query = new URLSearchParams();
  if (limit) query.set('limit', String(limit));

  const response = await fetch(`/admin/audit-logs/user/${userId}?${query}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 7. 특정 대상의 접근 이력 조회

### `GET /admin/audit-logs/target/:targetType/:targetId`

특정 리소스(파일, 폴더, 공유 등)에 대한 모든 접근/행위 이력을 조회합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `targetType` | `TargetType` | 필수 | 대상 타입 (`FILE`, `FOLDER`, `SHARE`, `USER` 등) |
| `targetId` | `string` | 필수 | 대상 ID (UUID) |

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `limit` | `number` | 선택 | `100` | 조회할 최대 개수 (1~1000) |

### 응답

```typescript
// 200 OK
AuditLog[]
```

### fetch 예시

```typescript
async function getAuditLogsByTarget(
  targetType: TargetType,
  targetId: string,
  limit?: number,
): Promise<AuditLog[]> {
  const query = new URLSearchParams();
  if (limit) query.set('limit', String(limit));

  const response = await fetch(
    `/admin/audit-logs/target/${targetType}/${targetId}?${query}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 8. 특정 세션의 활동 로그 조회

### `GET /admin/audit-logs/session/:sessionId`

특정 로그인 세션 내의 모든 활동 로그를 조회합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `sessionId` | `string` | 필수 | 세션 ID |

### 응답

```typescript
// 200 OK
AuditLog[]
```

### fetch 예시

```typescript
async function getAuditLogsBySession(sessionId: string): Promise<AuditLog[]> {
  const response = await fetch(`/admin/audit-logs/session/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 9. 파일 이력 목록 조회

### `GET /admin/audit-logs/file-history`

파일 변경 이력을 필터 조건으로 검색합니다. 페이지네이션을 지원합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | 선택 | `1` | 페이지 번호 (최소 1) |
| `limit` | `number` | 선택 | `50` | 페이지 크기 (1~500) |
| `fileId` | `string` | 선택 | - | 파일 ID (UUID) |
| `changeType` | `FileChangeType` | 선택 | - | 변경 타입 |
| `changedBy` | `string` | 선택 | - | 변경한 사용자 ID (UUID) |
| `startDate` | `string` | 선택 | - | 조회 시작일 (ISO 8601) |
| `endDate` | `string` | 선택 | - | 조회 종료일 (ISO 8601) |

### 응답

```typescript
// 200 OK
PaginatedResult<FileHistory>
```

### fetch 예시

```typescript
async function getFileHistories(params: {
  page?: number;
  limit?: number;
  fileId?: string;
  changeType?: FileChangeType;
  changedBy?: string;
  startDate?: string;
  endDate?: string;
}): Promise<PaginatedResult<FileHistory>> {
  const query = new URLSearchParams();

  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.fileId) query.set('fileId', params.fileId);
  if (params.changeType) query.set('changeType', params.changeType);
  if (params.changedBy) query.set('changedBy', params.changedBy);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);

  const response = await fetch(`/admin/audit-logs/file-history?${query}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

### 응답 예시

```json
{
  "data": [
    {
      "id": "c1d2e3f4-a5b6-7890-cdef-123456789012",
      "fileId": "b1c2d3e4-f5a6-7890-bcde-f12345678901",
      "version": 3,
      "changeType": "CONTENT_REPLACED",
      "changedBy": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
      "userType": "INTERNAL",
      "previousState": { "size": 1048576 },
      "newState": { "size": 2097152 },
      "checksumBefore": "abc123def456...",
      "checksumAfter": "789ghi012jkl...",
      "changeSummary": "내용 교체: 버전 3",
      "description": "홍길동님이 '2024_보고서.pdf' 파일의 내용을 교체했습니다.",
      "requestId": "req-002",
      "traceId": null,
      "parentEventId": null,
      "httpMethod": "POST",
      "apiEndpoint": "/v1/files/upload",
      "errorCode": null,
      "retryCount": 0,
      "tags": [],
      "createdAt": "2026-02-11T15:00:00.000Z"
    }
  ],
  "total": 347,
  "page": 1,
  "limit": 50,
  "totalPages": 7
}
```

---

## 10. 특정 파일의 변경 이력 조회

### `GET /admin/audit-logs/file-history/file/:fileId`

특정 파일의 모든 변경 이력을 조회합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `fileId` | `string` | 필수 | 파일 ID (UUID) |

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `limit` | `number` | 선택 | `100` | 조회할 최대 개수 (1~1000) |

### 응답

```typescript
// 200 OK
FileHistory[]
```

### fetch 예시

```typescript
async function getFileHistoryByFile(
  fileId: string,
  limit?: number,
): Promise<FileHistory[]> {
  const query = new URLSearchParams();
  if (limit) query.set('limit', String(limit));

  const response = await fetch(
    `/admin/audit-logs/file-history/file/${fileId}?${query}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 11. 특정 파일의 특정 버전 조회

### `GET /admin/audit-logs/file-history/file/:fileId/version/:version`

특정 파일의 특정 버전 이력을 조회합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `fileId` | `string` | 필수 | 파일 ID (UUID) |
| `version` | `number` | 필수 | 버전 번호 (정수) |

### 응답

```typescript
// 200 OK
FileHistory | null

// 404 Not Found
// 파일 버전을 찾을 수 없음
```

### fetch 예시

```typescript
async function getFileHistoryByVersion(
  fileId: string,
  version: number,
): Promise<FileHistory | null> {
  const response = await fetch(
    `/admin/audit-logs/file-history/file/${fileId}/version/${version}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 12. 특정 사용자가 변경한 파일 이력 조회

### `GET /admin/audit-logs/file-history/user/:userId`

특정 사용자가 변경한 모든 파일 이력을 조회합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `userId` | `string` | 필수 | 사용자 ID (UUID) |

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `limit` | `number` | 선택 | `100` | 조회할 최대 개수 (1~1000) |

### 응답

```typescript
// 200 OK
FileHistory[]
```

### fetch 예시

```typescript
async function getFileHistoryByUser(
  userId: string,
  limit?: number,
): Promise<FileHistory[]> {
  const query = new URLSearchParams();
  if (limit) query.set('limit', String(limit));

  const response = await fetch(
    `/admin/audit-logs/file-history/user/${userId}?${query}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 13. 시간 범위 통합 타임라인 조회

### `GET /v1/admin/timeline`

지정된 시간 범위 내의 모든 이벤트를 통합 타임라인으로 조회합니다. AuditLog, FileHistory, SystemEvent를 하나의 통합 뷰로 제공합니다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `from` | `string` | **필수** | - | 조회 시작 시간 (ISO 8601) |
| `to` | `string` | **필수** | - | 조회 종료 시간 (ISO 8601) |
| `eventSources` | `EventSource[]` | 선택 | - | 이벤트 소스 필터 (`AUDIT`, `FILE_CHANGE`, `SYSTEM`) |
| `severity` | `string` | 선택 | - | 심각도 필터 (`INFO`, `WARN`, `HIGH`, `CRITICAL`) |
| `result` | `string` | 선택 | - | 결과 필터 (`SUCCESS`, `FAILURE`) |
| `errorCode` | `string` | 선택 | - | 에러 코드 필터 |
| `page` | `number` | 선택 | `1` | 페이지 번호 (최소 1) |
| `size` | `number` | 선택 | `20` | 페이지 크기 (1~100) |

### 응답

```typescript
// 200 OK
UnifiedTimelineResponse
```

### fetch 예시

```typescript
async function getTimeline(params: {
  from: string;           // 필수
  to: string;             // 필수
  eventSources?: EventSource[];
  severity?: string;
  result?: 'SUCCESS' | 'FAILURE';
  errorCode?: string;
  page?: number;
  size?: number;
}): Promise<UnifiedTimelineResponse> {
  const query = new URLSearchParams();
  query.set('from', params.from);
  query.set('to', params.to);

  if (params.eventSources) {
    params.eventSources.forEach(s => query.append('eventSources', s));
  }
  if (params.severity) query.set('severity', params.severity);
  if (params.result) query.set('result', params.result);
  if (params.errorCode) query.set('errorCode', params.errorCode);
  if (params.page) query.set('page', String(params.page));
  if (params.size) query.set('size', String(params.size));

  const response = await fetch(`/v1/admin/timeline?${query}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

### 응답 예시

```json
{
  "events": [
    {
      "id": "e1f2a3b4-c5d6-7890-efab-cd1234567890",
      "eventSource": "AUDIT",
      "eventType": "FILE_DOWNLOAD",
      "occurredAt": "2026-02-11T14:30:00.000Z",
      "requestId": "req-001",
      "traceId": null,
      "parentEventId": null,
      "actorId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
      "actorName": "홍길동",
      "targetId": "b1c2d3e4-f5a6-7890-bcde-f12345678901",
      "targetName": "2024_보고서.pdf",
      "result": "SUCCESS",
      "errorCode": null,
      "severity": "INFO",
      "durationMs": 234,
      "httpMethod": "GET",
      "apiEndpoint": "/v1/files/download",
      "responseStatusCode": 200,
      "systemAction": null,
      "systemActionDetail": null,
      "followUpScheduled": false,
      "followUpAt": null,
      "retryCount": 0,
      "tags": [],
      "description": "홍길동님이 '2024_보고서.pdf' 파일을 다운로드했습니다."
    },
    {
      "id": "f2a3b4c5-d6e7-8901-fabc-de2345678901",
      "eventSource": "FILE_CHANGE",
      "eventType": "CONTENT_REPLACED",
      "occurredAt": "2026-02-11T15:00:00.000Z",
      "requestId": "req-002",
      "traceId": null,
      "parentEventId": null,
      "actorId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
      "actorName": "홍길동",
      "targetId": "b1c2d3e4-f5a6-7890-bcde-f12345678901",
      "targetName": "2024_보고서.pdf",
      "result": "SUCCESS",
      "errorCode": null,
      "severity": null,
      "durationMs": null,
      "httpMethod": "POST",
      "apiEndpoint": "/v1/files/upload",
      "responseStatusCode": null,
      "systemAction": null,
      "systemActionDetail": null,
      "followUpScheduled": null,
      "followUpAt": null,
      "retryCount": 0,
      "tags": [],
      "description": "홍길동님이 '2024_보고서.pdf' 파일의 내용을 교체했습니다."
    }
  ],
  "summary": {
    "total": 100,
    "bySource": {
      "AUDIT": 50,
      "FILE_CHANGE": 30,
      "SYSTEM": 20
    },
    "byResult": {
      "SUCCESS": 90,
      "FAILURE": 10
    },
    "bySeverity": {
      "INFO": 80,
      "WARN": 10,
      "HIGH": 5,
      "CRITICAL": 5
    },
    "timeRange": {
      "earliest": "2026-02-01T00:00:00.000Z",
      "latest": "2026-02-28T23:59:59.999Z"
    }
  },
  "page": {
    "current": 1,
    "size": 20,
    "totalElements": 100,
    "totalPages": 5
  }
}
```

---

## 14. 파일 중심 타임라인 조회

### `GET /v1/admin/timeline/files/:fileId`

특정 파일과 관련된 모든 이벤트(감사 로그 + 파일 변경 이력 + 시스템 이벤트)를 통합 타임라인으로 조회합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `fileId` | `string` | 필수 | 파일 ID (UUID) |

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `from` | `string` | 선택 | - | 조회 시작 시간 (ISO 8601) |
| `to` | `string` | 선택 | - | 조회 종료 시간 (ISO 8601) |
| `page` | `number` | 선택 | `1` | 페이지 번호 (최소 1) |
| `size` | `number` | 선택 | `20` | 페이지 크기 (1~100) |

### 응답

```typescript
// 200 OK
UnifiedTimelineResponse
```

### fetch 예시

```typescript
async function getTimelineByFile(
  fileId: string,
  params?: { from?: string; to?: string; page?: number; size?: number },
): Promise<UnifiedTimelineResponse> {
  const query = new URLSearchParams();

  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page) query.set('page', String(params.page));
  if (params?.size) query.set('size', String(params.size));

  const response = await fetch(
    `/v1/admin/timeline/files/${fileId}?${query}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 15. 사용자 중심 타임라인 조회

### `GET /v1/admin/timeline/actors/:actorId`

특정 사용자가 수행한 모든 행위를 통합 타임라인으로 조회합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `actorId` | `string` | 필수 | 행위자 ID (사용자 ID 또는 `"SYSTEM"`) |

### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `from` | `string` | 선택 | - | 조회 시작 시간 (ISO 8601) |
| `to` | `string` | 선택 | - | 조회 종료 시간 (ISO 8601) |
| `page` | `number` | 선택 | `1` | 페이지 번호 (최소 1) |
| `size` | `number` | 선택 | `20` | 페이지 크기 (1~100) |

### 응답

```typescript
// 200 OK
UnifiedTimelineResponse
```

### fetch 예시

```typescript
async function getTimelineByActor(
  actorId: string,
  params?: { from?: string; to?: string; page?: number; size?: number },
): Promise<UnifiedTimelineResponse> {
  const query = new URLSearchParams();

  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page) query.set('page', String(params.page));
  if (params?.size) query.set('size', String(params.size));

  const response = await fetch(
    `/v1/admin/timeline/actors/${actorId}?${query}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 16. HTTP 요청 추적

### `GET /v1/admin/timeline/requests/:requestId`

특정 HTTP 요청이 일으킨 모든 변화를 추적합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `requestId` | `string` | 필수 | 요청 ID (trace_id 또는 request_id) |

### 응답

```typescript
// 200 OK
UnifiedTimelineResponse
```

### fetch 예시

```typescript
async function getTimelineByRequest(
  requestId: string,
): Promise<UnifiedTimelineResponse> {
  const response = await fetch(
    `/v1/admin/timeline/requests/${requestId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 17. 트레이스 추적

### `GET /v1/admin/timeline/traces/:traceId`

특정 작업의 전체 과정을 추적합니다. 여러 HTTP 요청에 걸친 작업 추적에 유용합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `traceId` | `string` | 필수 | 트레이스 ID |

### 응답

```typescript
// 200 OK
UnifiedTimelineResponse
```

### fetch 예시

```typescript
async function getTimelineByTrace(
  traceId: string,
): Promise<UnifiedTimelineResponse> {
  const response = await fetch(
    `/v1/admin/timeline/traces/${traceId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

---

## 18. 이벤트 인과관계 체인 조회

### `GET /v1/admin/timeline/events/:eventId/chain`

특정 이벤트의 부모 이벤트 체인을 추적하여 인과관계를 조회합니다. `parentEventId`를 따라 최대 10단계까지 역방향으로 추적합니다.

### Path Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `eventId` | `string` | 필수 | 이벤트 ID (UUID) |

### 응답

```typescript
// 200 OK
ObservabilityEvent[]   // 부모 이벤트부터 현재 이벤트까지의 체인

// 404 Not Found
// 이벤트를 찾을 수 없음
```

### fetch 예시

```typescript
async function getEventChain(
  eventId: string,
): Promise<ObservabilityEvent[]> {
  const response = await fetch(
    `/v1/admin/timeline/events/${eventId}/chain`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

### 응답 예시

```json
[
  {
    "id": "parent-event-001",
    "eventSource": "AUDIT",
    "eventType": "FILE_UPLOAD",
    "occurredAt": "2026-02-11T14:29:00.000Z",
    "actorId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
    "actorName": "홍길동",
    "result": "SUCCESS",
    "description": "홍길동님이 '2024_보고서.pdf' 파일을 업로드했습니다."
  },
  {
    "id": "current-event-002",
    "eventSource": "FILE_CHANGE",
    "eventType": "CREATED",
    "occurredAt": "2026-02-11T14:29:01.000Z",
    "parentEventId": "parent-event-001",
    "actorId": "f5d3b1c3-5c94-473a-af9a-afef518d017c",
    "actorName": "홍길동",
    "result": "SUCCESS",
    "description": "홍길동님이 '2024_보고서.pdf' 파일을 생성했습니다."
  }
]
```

---

## 19. 에러 처리

### 공통 HTTP 상태 코드

| 상태 코드 | 의미 | 대응 방법 |
|-----------|------|-----------|
| `200` | 성공 | 정상 처리 |
| `400` | 잘못된 요청 | 쿼리 파라미터 검증 오류. 파라미터 형식 확인 |
| `401` | 인증 실패 | 토큰이 없거나 만료됨. 재로그인 또는 토큰 갱신 |
| `403` | 권한 부족 | `AUDIT_READ` 권한 필요. 관리자에게 역할 부여 요청 |
| `404` | 리소스 없음 | 해당 로그/이력/이벤트가 존재하지 않음 |
| `500` | 서버 에러 | 잠시 후 재시도. 지속 시 관리자 문의 |

### 에러 처리 헬퍼

```typescript
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json();
  }

  switch (response.status) {
    case 400:
      throw new Error('잘못된 요청입니다. 파라미터를 확인해주세요.');
    case 401:
      // 토큰 갱신 로직
      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
    case 403:
      throw new Error('감사 로그 조회 권한이 없습니다.');
    case 404:
      return null as T;
    default:
      throw new Error(`서버 오류가 발생했습니다. (${response.status})`);
  }
}
```

---

## 20. cURL 테스트

### 감사 로그 목록 조회

```bash
curl -X GET "http://localhost:3000/admin/audit-logs?page=1&limit=10&action=FILE_DOWNLOAD&result=SUCCESS" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 감사 로그 상세 조회

```bash
curl -X GET "http://localhost:3000/admin/audit-logs/a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 특정 사용자의 감사 로그 조회

```bash
curl -X GET "http://localhost:3000/admin/audit-logs/user/f5d3b1c3-5c94-473a-af9a-afef518d017c?limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 특정 대상의 접근 이력 조회

```bash
curl -X GET "http://localhost:3000/admin/audit-logs/target/FILE/b1c2d3e4-f5a6-7890-bcde-f12345678901?limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 특정 세션의 활동 로그 조회

```bash
curl -X GET "http://localhost:3000/admin/audit-logs/session/sess-abc123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 파일 이력 목록 조회

```bash
curl -X GET "http://localhost:3000/admin/audit-logs/file-history?page=1&limit=10&changeType=CONTENT_REPLACED" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 특정 파일의 변경 이력 조회

```bash
curl -X GET "http://localhost:3000/admin/audit-logs/file-history/file/b1c2d3e4-f5a6-7890-bcde-f12345678901?limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 특정 파일의 특정 버전 조회

```bash
curl -X GET "http://localhost:3000/admin/audit-logs/file-history/file/b1c2d3e4-f5a6-7890-bcde-f12345678901/version/3" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 특정 사용자가 변경한 파일 이력 조회

```bash
curl -X GET "http://localhost:3000/admin/audit-logs/file-history/user/f5d3b1c3-5c94-473a-af9a-afef518d017c?limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 시간 범위 통합 타임라인 조회

```bash
curl -X GET "http://localhost:3000/v1/admin/timeline?from=2026-02-01T00:00:00.000Z&to=2026-02-28T23:59:59.999Z&page=1&size=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 파일 중심 타임라인 조회

```bash
curl -X GET "http://localhost:3000/v1/admin/timeline/files/b1c2d3e4-f5a6-7890-bcde-f12345678901?page=1&size=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 사용자 중심 타임라인 조회

```bash
curl -X GET "http://localhost:3000/v1/admin/timeline/actors/f5d3b1c3-5c94-473a-af9a-afef518d017c?page=1&size=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### HTTP 요청 추적

```bash
curl -X GET "http://localhost:3000/v1/admin/timeline/requests/req-001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 트레이스 추적

```bash
curl -X GET "http://localhost:3000/v1/admin/timeline/traces/trace-001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 이벤트 인과관계 체인 조회

```bash
curl -X GET "http://localhost:3000/v1/admin/timeline/events/e1f2a3b4-c5d6-7890-efab-cd1234567890/chain" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
