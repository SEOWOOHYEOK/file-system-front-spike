# 사용자 활동 내역 조회 API - 프론트엔드 연동 가이드

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [API 상세: 활동 내역 조회](#4-api-상세-활동-내역-조회)
5. [무한 스크롤 구현 가이드](#5-무한-스크롤-구현-가이드)
6. [에러 처리](#6-에러-처리)
7. [cURL 테스트](#7-curl-테스트)

---

## 1. API 개요

| 메서드 | 엔드포인트 | 설명 | 인증 |
|--------|-----------|------|------|
| `GET` | `/v1/users/audit-log` | 사용자 파일/폴더 활동 내역 조회 (페이지네이션) | Bearer Token |

현재 로그인한 사용자의 **파일/폴더 관련 활동**만 최근순으로 조회합니다.
무한 스크롤을 위한 페이지네이션을 지원합니다.

---

## 2. 인증

모든 요청에 JWT 토큰이 필요합니다.

```typescript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
};
```

---

## 3. TypeScript 타입 정의

### 공통 페이지네이션 응답

```typescript
interface PaginatedResponse<T> {
  items: T[];
  page: number;        // 현재 페이지 (1부터 시작)
  pageSize: number;    // 페이지 크기
  totalItems: number;  // 전체 아이템 수
  totalPages: number;  // 전체 페이지 수
  hasNext: boolean;    // 다음 페이지 존재 여부
  hasPrev: boolean;    // 이전 페이지 존재 여부
}
```

### 활동 내역 항목

```typescript
interface RecentActivityItem {
  /** 액션 타입 (AuditAction enum 값) */
  action: AuditAction;
  /** 액션 카테고리: 'FILE' | 'FOLDER' */
  actionCategory: string;
  /** 대상 타입: 'FILE' | 'FOLDER' */
  targetType: string;
  /** 대상 ID (UUID) */
  targetId: string;
  /** 대상 이름 (파일명 또는 폴더명) */
  targetName: string;
  /** 대상 경로 (선택) */
  targetPath?: string;
  /** 결과: 'SUCCESS' | 'FAILURE' */
  result: string;
  /** 활동 시각 (ISO 8601) */
  createdAt: string;
}
```

### 활동 내역 응답 타입

```typescript
type RecentActivitiesResponse = PaginatedResponse<RecentActivityItem>;
```

### 쿼리 파라미터

```typescript
interface RecentActivitiesQuery {
  /** 페이지 번호 (기본: 1, 최소: 1) */
  page?: number;
  /** 페이지 크기 (기본: 20, 최소: 1, 최대: 100) */
  pageSize?: number;
  /** 필터할 액션 (쉼표 구분, 선택) */
  actions?: string;
}
```

### AuditAction Enum

```typescript
/** 허용되는 파일/폴더 액션 */
type AuditAction =
  // 파일 관련
  | 'FILE_VIEW'       // 파일 조회
  | 'FILE_DOWNLOAD'   // 파일 다운로드
  | 'FILE_UPLOAD'     // 파일 업로드
  | 'FILE_RENAME'     // 파일 이름 변경
  | 'FILE_MOVE'       // 파일 이동
  | 'FILE_DELETE'     // 파일 삭제 (휴지통 이동)
  | 'FILE_RESTORE'    // 파일 복원
  | 'FILE_PURGE'      // 파일 영구 삭제
  // 폴더 관련
  | 'FOLDER_CREATE'   // 폴더 생성
  | 'FOLDER_VIEW'     // 폴더 조회
  | 'FOLDER_RENAME'   // 폴더 이름 변경
  | 'FOLDER_MOVE'     // 폴더 이동
  | 'FOLDER_DELETE';  // 폴더 삭제
```

| 액션 | 설명 | 카테고리 |
|------|------|---------|
| `FILE_VIEW` | 파일 조회 | FILE |
| `FILE_DOWNLOAD` | 파일 다운로드 | FILE |
| `FILE_UPLOAD` | 파일 업로드 | FILE |
| `FILE_RENAME` | 파일 이름 변경 | FILE |
| `FILE_MOVE` | 파일 이동 | FILE |
| `FILE_DELETE` | 파일 삭제 (휴지통 이동) | FILE |
| `FILE_RESTORE` | 파일 복원 | FILE |
| `FILE_PURGE` | 파일 영구 삭제 | FILE |
| `FOLDER_CREATE` | 폴더 생성 | FOLDER |
| `FOLDER_VIEW` | 폴더 조회 | FOLDER |
| `FOLDER_RENAME` | 폴더 이름 변경 | FOLDER |
| `FOLDER_MOVE` | 폴더 이동 | FOLDER |
| `FOLDER_DELETE` | 폴더 삭제 | FOLDER |

---

## 4. API 상세: 활동 내역 조회

### `GET /v1/users/audit-log`

현재 로그인한 사용자의 파일/폴더 활동을 최근순(`createdAt DESC`)으로 조회합니다.

### 요청

#### Query Parameters

| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| `page` | number | 아니오 | `1` | 페이지 번호 (1 이상) |
| `pageSize` | number | 아니오 | `20` | 페이지 크기 (1~100) |
| `actions` | string | 아니오 | - | 필터할 액션 (쉼표 구분). 미지정 시 전체 파일/폴더 액션 조회 |

#### fetch 예시

```typescript
async function fetchRecentActivities(
  token: string,
  params: RecentActivitiesQuery = {},
): Promise<RecentActivitiesResponse> {
  const query = new URLSearchParams();

  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.actions) query.set('actions', params.actions);

  const url = `/v1/users/audit-log?${query.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
```

### 응답 (200 OK)

```json
{
  "items": [
    {
      "action": "FILE_DOWNLOAD",
      "actionCategory": "FILE",
      "targetType": "FILE",
      "targetId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "targetName": "계약서.pdf",
      "targetPath": "/documents/contracts/",
      "result": "SUCCESS",
      "createdAt": "2026-02-10T14:30:00.000Z"
    },
    {
      "action": "FILE_UPLOAD",
      "actionCategory": "FILE",
      "targetType": "FILE",
      "targetId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "targetName": "보고서_v2.xlsx",
      "targetPath": "/reports/2026/",
      "result": "SUCCESS",
      "createdAt": "2026-02-10T14:25:00.000Z"
    },
    {
      "action": "FOLDER_CREATE",
      "actionCategory": "FOLDER",
      "targetType": "FOLDER",
      "targetId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "targetName": "신규 프로젝트",
      "targetPath": "/projects/",
      "result": "SUCCESS",
      "createdAt": "2026-02-10T14:20:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 150,
  "totalPages": 8,
  "hasNext": true,
  "hasPrev": false
}
```

### 요청 예시

#### 1) 기본 조회 (첫 페이지, 20개)

```
GET /v1/users/audit-log
```

#### 2) 2페이지 조회

```
GET /v1/users/audit-log?page=2&pageSize=20
```

#### 3) 다운로드 활동만 필터

```
GET /v1/users/audit-log?actions=FILE_DOWNLOAD
```

#### 4) 파일 조회 + 다운로드만, 페이지 크기 10

```
GET /v1/users/audit-log?page=1&pageSize=10&actions=FILE_VIEW,FILE_DOWNLOAD
```

#### 5) 업로드 활동만 필터

```
GET /v1/users/audit-log?actions=FILE_UPLOAD
```

---

## 5. 무한 스크롤 구현 가이드

이 API는 `hasNext` 필드를 통해 무한 스크롤을 지원합니다.

### React 구현 예시

```typescript
import { useState, useCallback, useRef } from 'react';

function useRecentActivities(token: string, actions?: string) {
  const [items, setItems] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(true);
  const pageRef = useRef(1);

  const loadMore = useCallback(async () => {
    if (loading || !hasNext) return;

    setLoading(true);
    try {
      const data = await fetchRecentActivities(token, {
        page: pageRef.current,
        pageSize: 20,
        actions,
      });

      setItems((prev) => [...prev, ...data.items]);
      setHasNext(data.hasNext);
      pageRef.current += 1;
    } catch (error) {
      console.error('활동 내역 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [token, actions, loading, hasNext]);

  // 필터 변경 시 초기화
  const reset = useCallback(() => {
    setItems([]);
    setHasNext(true);
    pageRef.current = 1;
  }, []);

  return { items, loading, hasNext, loadMore, reset };
}
```

### 탭 필터 매핑 (UI → actions 파라미터)

| UI 탭 | `actions` 파라미터 값 |
|--------|----------------------|
| 전체 | (미지정) |
| 열람 | `FILE_VIEW` |
| 업로드 | `FILE_UPLOAD` |
| 다운로드 | `FILE_DOWNLOAD,SHARE_DOWNLOAD` |

> **참고:** 탭 변경 시 반드시 페이지를 1로 초기화하고 기존 목록을 비운 뒤 새로 요청하세요.

### Intersection Observer 연동

```typescript
function ActivityList() {
  const { items, loading, hasNext, loadMore } = useRecentActivities(token);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNext, loading, loadMore]);

  return (
    <div>
      {items.map((item, index) => (
        <ActivityCard key={`${item.targetId}-${index}`} activity={item} />
      ))}
      {loading && <Spinner />}
      <div ref={observerRef} style={{ height: 1 }} />
    </div>
  );
}
```

---

## 6. 에러 처리

### HTTP 상태 코드

| 상태 코드 | 설명 | 대응 방법 |
|-----------|------|----------|
| `200` | 성공 | 정상 처리 |
| `400` | 잘못된 요청 (page, pageSize 유효성 실패) | 쿼리 파라미터 확인 |
| `401` | 인증 실패 (토큰 없음/만료) | 로그인 페이지로 리다이렉트 또는 토큰 갱신 |

### 에러 응답 형태

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 에러 처리 예시

```typescript
async function fetchWithErrorHandling(
  token: string,
  params: RecentActivitiesQuery,
): Promise<RecentActivitiesResponse | null> {
  try {
    const response = await fetchRecentActivities(token, params);
    return response;
  } catch (error) {
    if (error instanceof Response) {
      switch (error.status) {
        case 401:
          // 토큰 갱신 또는 로그인 페이지 이동
          await refreshToken();
          break;
        case 400:
          console.error('잘못된 요청 파라미터');
          break;
        default:
          console.error('서버 에러:', error.status);
      }
    }
    return null;
  }
}
```

---

## 7. cURL 테스트

### 기본 조회

```bash
curl -X GET "http://localhost:3000/v1/users/audit-log" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2페이지, 10개씩

```bash
curl -X GET "http://localhost:3000/v1/users/audit-log?page=2&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 다운로드 활동만 필터

```bash
curl -X GET "http://localhost:3000/v1/users/audit-log?actions=FILE_DOWNLOAD" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 파일 조회 + 업로드 필터

```bash
curl -X GET "http://localhost:3000/v1/users/audit-log?actions=FILE_VIEW,FILE_UPLOAD&pageSize=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
