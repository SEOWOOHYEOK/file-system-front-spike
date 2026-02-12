# 710. 파일 외부공유 접근 - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `710.파일 외부공유 접근` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [나에게 공유된 파일 목록](#4-나에게-공유된-파일-목록)
5. [공유 상세 조회 및 콘텐츠 토큰 발급](#5-공유-상세-조회-및-콘텐츠-토큰-발급)
6. [파일 콘텐츠 (뷰어용)](#6-파일-콘텐츠-뷰어용)
7. [파일 다운로드](#7-파일-다운로드)
8. [에러 처리](#8-에러-처리)
9. [cURL 테스트](#9-curl-테스트)

---

## 1. API 개요

외부 사용자가 공유받은 파일에 접근하기 위한 API입니다. 공유 목록 조회, 상세 조회(콘텐츠 토큰 발급), 파일 뷰어 표시, 파일 다운로드 기능을 제공합니다.

| # | Method | URL | 설명 | 권한 |
|---|--------|-----|------|------|
| 1 | `GET` | `/v1/file-shares-requests/me` | 나에게 공유된 파일 목록 | `EXTERNAL_SHARE_READ` |
| 2 | `GET` | `/v1/file-shares-requests/:shareId` | 공유 상세 조회 + 콘텐츠 토큰 발급 | `EXTERNAL_SHARE_READ` |
| 3 | `GET` | `/v1/file-shares-requests/:shareId/content` | 파일 콘텐츠 (뷰어용 - inline) | `EXTERNAL_SHARE_VIEW` |
| 4 | `GET` | `/v1/file-shares-requests/:shareId/download` | 파일 다운로드 (attachment) | `EXTERNAL_SHARE_DOWNLOAD` |

### 일반적인 사용 흐름

```
1. GET /me          → 공유 목록에서 shareId 확인
2. GET /:shareId    → 파일 상세 정보 + contentToken 발급
3. GET /:shareId/content?token=...  → 뷰어에서 파일 표시
   또는
   GET /:shareId/download?token=...  → 파일 다운로드
```

---

## 2. 인증

모든 요청에 Bearer Token이 필요합니다.

```typescript
const headers = {
  'Authorization': `Bearer ${token}`,
};
```

> 외부 사용자 전용 JWT 토큰을 사용합니다.

---

## 3. TypeScript 타입 정의

프론트엔드 프로젝트에 그대로 복사해서 사용하세요.

```typescript
// types/external-share.ts

// ─── Enum 타입 ───

/** 접근 액션 */
type AccessAction = 'VIEW' | 'DOWNLOAD';

// ─── 요청 타입 ───

/** 페이지네이션 요청 파라미터 */
interface PaginationQuery {
  /** 페이지 번호 (기본값: 1, 최소: 1) */
  page?: number;
  /** 페이지 크기 (기본값: 20, 최소: 1, 최대: 100) */
  pageSize?: number;
  /** 정렬 기준 필드 (기본값: createdAt) */
  sortBy?: string;
  /** 정렬 순서 */
  sortOrder?: 'asc' | 'desc';
}

/** 콘텐츠 접근 토큰 쿼리 파라미터 */
interface ContentTokenQuery {
  /** 콘텐츠 접근 토큰 (상세 조회 시 발급) */
  token: string;
}

// ─── 응답 타입 ───

/** 공유 목록 아이템 */
interface MyShareListItem {
  /** 공유 ID (UUID) */
  id: string;
  /** 파일 ID (UUID) */
  fileId: string;
  /** 파일명 */
  fileName: string;
  /** 권한 목록 ('VIEW', 'DOWNLOAD') */
  permissions: string[];
  /** 만료일시 (ISO 8601) - 없으면 무기한 */
  expiresAt?: string;
  /** 생성일시 (ISO 8601) */
  createdAt: string;
}

/** 공유 상세 정보 */
interface ShareDetail {
  /** 공유 ID (UUID) */
  id: string;
  /** 파일 ID (UUID) */
  fileId: string;
  /** 파일명 */
  fileName: string;
  /** 파일 크기 (bytes) */
  fileSize: number;
  /** MIME 타입 */
  mimeType: string;
  /** 권한 목록 ('VIEW', 'DOWNLOAD') */
  permissions: string[];
  /** 최대 뷰 횟수 - 없으면 무제한 */
  maxViewCount?: number;
  /** 현재 뷰 횟수 */
  currentViewCount: number;
  /** 최대 다운로드 횟수 - 없으면 무제한 */
  maxDownloadCount?: number;
  /** 현재 다운로드 횟수 */
  currentDownloadCount: number;
  /** 만료일시 (ISO 8601) - 없으면 무기한 */
  expiresAt?: string;
}

/** 공유 상세 조회 응답 */
interface ShareDetailResponse {
  /** 공유 정보 */
  share: ShareDetail;
  /** 파일 접근용 일회성 토큰 */
  contentToken: string;
  /** 콘텐츠 토큰 만료 시간 (ISO 8601) */
  tokenExpiresAt: string;
}

// ─── 페이지네이션 ───

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

---

## 4. 나에게 공유된 파일 목록

### `GET /v1/file-shares-requests/me`

현재 로그인한 외부 사용자에게 공유된 파일 목록을 조회합니다.

- 활성 상태인 공유만 표시됩니다 (취소/차단되지 않은 공유)
- 만료되지 않은 공유만 표시됩니다

### 요청 파라미터 (Query String)

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | `number` | ❌ | `1` | 페이지 번호 (1 이상) |
| `pageSize` | `number` | ❌ | `20` | 페이지 크기 (1~100) |
| `sortBy` | `string` | ❌ | `createdAt` | 정렬 기준 필드 |
| `sortOrder` | `'asc' \| 'desc'` | ❌ | `desc` | 정렬 순서 |

### 응답

```typescript
// 200 OK
PaginatedResponse<MyShareListItem>
```

### fetch 예시

```typescript
async function getMyShares(
  token: string,
  params?: PaginationQuery,
): Promise<PaginatedResponse<MyShareListItem>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await fetch(
    `/v1/file-shares-requests/me?${query}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### 응답 예시

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "fileId": "550e8400-e29b-41d4-a716-446655440010",
      "fileName": "설계문서.pdf",
      "permissions": ["VIEW", "DOWNLOAD"],
      "expiresAt": "2026-03-01T23:59:59.000Z",
      "createdAt": "2026-02-10T09:00:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "fileId": "550e8400-e29b-41d4-a716-446655440011",
      "fileName": "계약서_최종.docx",
      "permissions": ["VIEW"],
      "expiresAt": null,
      "createdAt": "2026-02-08T14:30:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 2,
  "totalPages": 1,
  "hasNext": false,
  "hasPrev": false
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 / 로그인 페이지로 리다이렉트 |

---

## 5. 공유 상세 조회 및 콘텐츠 토큰 발급

### `GET /v1/file-shares-requests/:shareId`

특정 공유의 상세 정보를 조회하고, 파일 접근을 위한 **일회성 콘텐츠 토큰**을 발급받습니다.

- 콘텐츠 토큰은 제한된 시간(기본 60초) 동안만 유효합니다.
- `/content` 또는 `/download` API 호출 시 query parameter로 전달합니다.
- 본인에게 공유된 파일만 조회 가능합니다.
- 취소되거나 차단된 공유는 접근할 수 없습니다.

### 요청 파라미터 (Path)

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|----------|------|------|------|------|
| `shareId` | `string (UUID)` | ✅ | 공유 ID | `550e8400-e29b-41d4-a716-446655440001` |

### 응답

```typescript
// 200 OK
ShareDetailResponse
```

### fetch 예시

```typescript
async function getShareDetail(
  token: string,
  shareId: string,
): Promise<ShareDetailResponse> {
  const res = await fetch(
    `/v1/file-shares-requests/${shareId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### 응답 예시

```json
{
  "share": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "fileId": "550e8400-e29b-41d4-a716-446655440010",
    "fileName": "설계문서.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "permissions": ["VIEW", "DOWNLOAD"],
    "maxViewCount": 10,
    "currentViewCount": 3,
    "maxDownloadCount": 5,
    "currentDownloadCount": 1,
    "expiresAt": "2026-03-01T23:59:59.000Z"
  },
  "contentToken": "ct_abc123def456...",
  "tokenExpiresAt": "2026-02-12T10:01:00.000Z"
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 필요 | 토큰 재발급 |
| `403` | 접근 권한 없음 (본인에게 공유되지 않음) | "접근 권한이 없습니다" 표시 |
| `404` | 공유를 찾을 수 없음 | "공유를 찾을 수 없습니다" 표시 |
| `410` | 공유가 만료되었거나 취소됨 | "만료되거나 취소된 공유입니다" 표시 |

---

## 6. 파일 콘텐츠 (뷰어용)

### `GET /v1/file-shares-requests/:shareId/content`

파일 콘텐츠를 뷰어에서 표시하기 위해 조회합니다. 응답은 **바이너리 스트림**입니다.

- 상세 조회(`GET /:shareId`)에서 발급받은 콘텐츠 토큰이 필요합니다.
- `VIEW` 권한이 있어야 합니다.
- 조회 시마다 접근 기록이 남습니다 (IP, User-Agent, 디바이스 타입)
- 최대 조회 횟수가 설정된 경우, 횟수가 차감됩니다.
- **HTTP Range Requests (RFC 7233)** 를 지원합니다 (이어받기, 부분 스트리밍)

### 요청 파라미터

**Path:**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|----------|------|------|------|------|
| `shareId` | `string (UUID)` | ✅ | 공유 ID | `550e8400-e29b-41d4-a716-446655440001` |

**Query:**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|----------|------|------|------|------|
| `token` | `string` | ✅ | 콘텐츠 접근 토큰 (상세 조회 시 발급) | `ct_abc123def456...` |

**Headers (선택):**

| 헤더 | 설명 | 예시 |
|------|------|------|
| `Range` | 부분 콘텐츠 요청 (바이트 범위) | `bytes=0-1023` |
| `If-Range` | ETag 기반 이어받기 무결성 보장 | `"abc123checksum"` |

### 응답 헤더

| 헤더 | 설명 |
|------|------|
| `Content-Type` | 파일의 MIME 타입 |
| `Content-Disposition` | `inline; filename*=UTF-8''파일명` (뷰어 표시용) |
| `Content-Length` | 응답 본문 크기 (bytes) |
| `Accept-Ranges` | `bytes` (Range 요청 지원) |
| `ETag` | 파일 체크섬 기반 ETag |
| `Last-Modified` | 마지막 수정일시 |
| `Content-Range` | 부분 응답 시 범위 (206 응답) |
| `X-Checksum-SHA256` | SHA256 체크섬 (전체 파일 응답 시만) |

### fetch 예시 (뷰어용 - iframe/object 태그)

```typescript
/**
 * 파일 콘텐츠 URL 생성 (뷰어 iframe src로 사용)
 */
function getContentUrl(shareId: string, contentToken: string): string {
  return `/v1/file-shares-requests/${shareId}/content?token=${encodeURIComponent(contentToken)}`;
}

// 사용 예시: PDF 뷰어
const url = getContentUrl(shareId, contentToken);
// <iframe src={url} /> 또는 <object data={url} />
```

### fetch 예시 (프로그래밍 방식)

```typescript
async function getFileContent(
  token: string,
  shareId: string,
  contentToken: string,
): Promise<Blob> {
  const res = await fetch(
    `/v1/file-shares-requests/${shareId}/content?token=${encodeURIComponent(contentToken)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 유효하지 않은 콘텐츠 토큰 | 상세 조회로 토큰 재발급 |
| `403` | VIEW 권한 없음 | "파일 조회 권한이 없습니다" 표시 |
| `410` | 최대 조회 횟수 초과 | "조회 횟수가 초과되었습니다" 표시 |
| `416` | Range 요청 범위 초과 | Range 헤더 수정 후 재요청 |

---

## 7. 파일 다운로드

### `GET /v1/file-shares-requests/:shareId/download`

파일을 다운로드합니다. 응답은 **바이너리 스트림**입니다.

- 상세 조회(`GET /:shareId`)에서 발급받은 콘텐츠 토큰이 필요합니다.
- `DOWNLOAD` 권한이 있어야 합니다 (VIEW 권한만 있는 경우 불가).
- 다운로드 시마다 접근 기록이 남습니다 (IP, User-Agent, 디바이스 타입)
- 최대 다운로드 횟수가 설정된 경우, 횟수가 차감됩니다.
- **HTTP Range Requests (RFC 7233)** 를 지원합니다 (이어받기)

### 요청 파라미터

**Path:**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|----------|------|------|------|------|
| `shareId` | `string (UUID)` | ✅ | 공유 ID | `550e8400-e29b-41d4-a716-446655440001` |

**Query:**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|----------|------|------|------|------|
| `token` | `string` | ✅ | 콘텐츠 접근 토큰 (상세 조회 시 발급) | `ct_abc123def456...` |

**Headers (선택):**

| 헤더 | 설명 | 예시 |
|------|------|------|
| `Range` | 부분 콘텐츠 요청 (바이트 범위) | `bytes=0-1023` |
| `If-Range` | ETag 기반 이어받기 무결성 보장 | `"abc123checksum"` |

### 응답 헤더

| 헤더 | 설명 |
|------|------|
| `Content-Type` | 파일의 MIME 타입 |
| `Content-Disposition` | `attachment; filename*=UTF-8''파일명` (다운로드용) |
| `Content-Length` | 응답 본문 크기 (bytes) |
| `Accept-Ranges` | `bytes` (Range 요청 지원) |
| `ETag` | 파일 체크섬 기반 ETag |
| `Last-Modified` | 마지막 수정일시 |
| `Content-Range` | 부분 응답 시 범위 (206 응답) |
| `X-Checksum-SHA256` | SHA256 체크섬 (전체 파일 응답 시만) |

### fetch 예시 (브라우저 다운로드)

```typescript
/**
 * 파일 다운로드 URL 생성 → <a> 태그로 다운로드 트리거
 */
function downloadFile(shareId: string, contentToken: string): void {
  const url = `/v1/file-shares-requests/${shareId}/download?token=${encodeURIComponent(contentToken)}`;

  const a = document.createElement('a');
  a.href = url;
  a.download = ''; // 서버의 Content-Disposition 파일명 사용
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```

### fetch 예시 (프로그래밍 방식 + 진행률)

```typescript
async function downloadFileWithProgress(
  token: string,
  shareId: string,
  contentToken: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Blob> {
  const res = await fetch(
    `/v1/file-shares-requests/${shareId}/download?token=${encodeURIComponent(contentToken)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentLength = Number(res.headers.get('Content-Length') ?? 0);
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, contentLength);
  }

  return new Blob(chunks);
}
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 유효하지 않은 콘텐츠 토큰 | 상세 조회로 토큰 재발급 |
| `403` | DOWNLOAD 권한 없음 | "다운로드 권한이 없습니다" 표시 |
| `410` | 최대 다운로드 횟수 초과 | "다운로드 횟수가 초과되었습니다" 표시 |
| `416` | Range 요청 범위 초과 | Range 헤더 수정 후 재요청 |

---

## Enum 값 정리

### AccessAction (접근 액션)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `VIEW` | 뷰어에서 파일 보기 | 👁 보기 |
| `DOWNLOAD` | 파일 다운로드 | ⬇ 다운로드 |

### 관련 권한 (PermissionEnum)

| 값 | 설명 | 적용 API |
|----|------|----------|
| `EXTERNAL_SHARE_READ` | 공유 파일 목록/상세 조회 | 목록, 상세 |
| `EXTERNAL_SHARE_VIEW` | 공유 파일 뷰어 (인라인 표시) | 콘텐츠 |
| `EXTERNAL_SHARE_DOWNLOAD` | 공유 파일 다운로드 | 다운로드 |

---

## 8. 에러 처리

### 공통 HTTP 상태 코드

| 코드 | 의미 | 프론트엔드 대응 |
|------|------|----------------|
| `200` | 성공 | 정상 처리 |
| `206` | 부분 콘텐츠 (Range 응답) | 정상 처리 (이어받기) |
| `401` | 인증 만료/없음 | 로그인 페이지로 리다이렉트 |
| `403` | 권한 없음 | "권한이 없습니다" 표시 |
| `404` | 리소스 없음 | "찾을 수 없습니다" 표시 |
| `410` | 만료/취소/횟수 초과 | 상태에 맞는 안내 메시지 표시 |
| `416` | Range 범위 초과 | Range 없이 전체 파일 재요청 |
| `500` | 서버 오류 | "서버 오류가 발생했습니다" 표시 |

### Validation 에러 응답 형식 (400)

```json
{
  "statusCode": 400,
  "message": [
    "콘텐츠 토큰을 입력해주세요."
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

### 콘텐츠 토큰 만료 처리

콘텐츠 토큰은 발급 후 제한된 시간(기본 60초) 동안만 유효합니다. 토큰 만료 시 상세 조회를 다시 호출하여 새 토큰을 발급받아야 합니다.

```typescript
async function getContentWithTokenRefresh(
  authToken: string,
  shareId: string,
): Promise<string> {
  // 1. 상세 조회로 콘텐츠 토큰 발급
  const detail = await getShareDetail(authToken, shareId);

  // 2. 토큰 만료 전에 콘텐츠 URL 생성
  const contentUrl = getContentUrl(shareId, detail.contentToken);

  return contentUrl;
}
```

---

## 9. cURL 테스트

### 나에게 공유된 파일 목록

```bash
# 전체 목록
curl -X GET "http://localhost:3000/v1/file-shares-requests/me" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 페이지네이션 적용
curl -X GET "http://localhost:3000/v1/file-shares-requests/me?page=1&pageSize=10&sortOrder=desc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 공유 상세 조회 + 콘텐츠 토큰 발급

```bash
curl -X GET "http://localhost:3000/v1/file-shares-requests/550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

### 파일 콘텐츠 (뷰어용)

```bash
# 전체 파일
curl -X GET "http://localhost:3000/v1/file-shares-requests/550e8400-e29b-41d4-a716-446655440001/content?token=ct_abc123def456" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o output.pdf

# Range 요청 (처음 1KB만)
curl -X GET "http://localhost:3000/v1/file-shares-requests/550e8400-e29b-41d4-a716-446655440001/content?token=ct_abc123def456" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Range: bytes=0-1023" \
  -o partial.pdf
```

### 파일 다운로드

```bash
# 전체 파일 다운로드
curl -X GET "http://localhost:3000/v1/file-shares-requests/550e8400-e29b-41d4-a716-446655440001/download?token=ct_abc123def456" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -OJ

# Range 요청 (이어받기)
curl -X GET "http://localhost:3000/v1/file-shares-requests/550e8400-e29b-41d4-a716-446655440001/download?token=ct_abc123def456" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Range: bytes=1024-" \
  -o partial_download.pdf
```
