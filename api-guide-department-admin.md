# 관리자 부서 정보 API - 프론트엔드 연동 가이드

> **Base URL:** `http://localhost:3000` (개발) / 배포 환경에 따라 변경
>
> **Swagger:** `{BASE_URL}/api-docs` → `820.관리자 - 부서 정보` 섹션에서 직접 테스트 가능

---

## 목차

1. [API 개요](#1-api-개요)
2. [인증](#2-인증)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [API 상세 - 부서 계층 구조 조회](#4-api-상세---부서-계층-구조-조회)
5. [Enum 값 정리](#5-enum-값-정리)
6. [에러 처리](#6-에러-처리)
7. [cURL 테스트](#7-curl-테스트)

---

## 1. API 개요

| Method | Path | 설명 | 인증 | 필요 권한 |
|--------|------|------|------|-----------|
| `GET` | `/v1/admin/departments` | 부서 계층 구조 조회 | Bearer | `USER_READ` |

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

### 필요 권한

이 API는 **관리자 전용**이며, `USER_READ` 권한이 필요합니다.
해당 권한이 없는 사용자가 호출하면 `403 Forbidden`이 반환됩니다.

---

## 3. TypeScript 타입 정의

프론트엔드 프로젝트에 그대로 복사해서 사용하세요.

```typescript
// types/department.ts

// ─── Enum 타입 ───

/** 부서 유형 */
export type DepartmentType = 'COMPANY' | 'DIVISION' | 'DEPARTMENT' | 'TEAM';

// ─── 응답 타입 ───

/** GET /v1/admin/departments 응답 (재귀 트리 구조) */
export interface DepartmentHierarchyResponse {
  /** 부서 ID (UUID) */
  id: string;
  /** 부서명 */
  departmentName: string;
  /** 부서 코드 */
  departmentCode: string;
  /** 부서 유형 */
  type: DepartmentType;
  /** 정렬 순서 (낮을수록 상위, 0이 가장 위) */
  order: number;
  /** 소속 인원 수 */
  memberCount: number;
  /** 상위 부서 ID (최상위 부서는 null) */
  parentDepartmentId: string | null;
  /** 하위 부서 목록 (재귀 구조, order 오름차순 정렬) */
  children: DepartmentHierarchyResponse[];
}
```

---

## 4. API 상세 - 부서 계층 구조 조회

`departments-info` 테이블의 부서 정보를 계층(트리) 구조로 반환합니다.

- `parentDepartmentId`로 부모-자식 관계를 구성합니다.
- 각 레벨에서 `order` 오름차순 정렬 (0이 가장 위).

### 요청

```
GET /v1/admin/departments
```

> 요청 Body, Query 파라미터, Path 파라미터 없음

### 응답 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | `string` | O | 부서 ID (UUID) |
| `departmentName` | `string` | O | 부서명 |
| `departmentCode` | `string` | O | 부서 코드 |
| `type` | `DepartmentType` | O | 부서 유형 (`COMPANY`, `DIVISION`, `DEPARTMENT`, `TEAM`) |
| `order` | `number` | O | 정렬 순서 (낮을수록 상위) |
| `memberCount` | `number` | O | 해당 부서에 소속된 인원 수 |
| `parentDepartmentId` | `string \| null` | O | 상위 부서 ID (최상위는 `null`) |
| `children` | `DepartmentHierarchyResponse[]` | O | 하위 부서 목록 (재귀 구조) |

### 응답 예시

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "departmentName": "루미르 주식회사",
    "departmentCode": "LUMIR_CO",
    "type": "COMPANY",
    "order": 0,
    "memberCount": 0,
    "parentDepartmentId": null,
    "children": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "departmentName": "루미르주식회사본사",
        "departmentCode": "LUMIR_HQ",
        "type": "DIVISION",
        "order": 0,
        "memberCount": 90,
        "parentDepartmentId": "550e8400-e29b-41d4-a716-446655440001",
        "children": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440003",
            "departmentName": "대표이사",
            "departmentCode": "CEO",
            "type": "DEPARTMENT",
            "order": 0,
            "memberCount": 90,
            "parentDepartmentId": "550e8400-e29b-41d4-a716-446655440002",
            "children": [
              {
                "id": "550e8400-e29b-41d4-a716-446655440004",
                "departmentName": "LumirX-1 TF",
                "departmentCode": "LX1_TF",
                "type": "TEAM",
                "order": 0,
                "memberCount": 7,
                "parentDepartmentId": "550e8400-e29b-41d4-a716-446655440003",
                "children": []
              },
              {
                "id": "550e8400-e29b-41d4-a716-446655440005",
                "departmentName": "경영지원본부",
                "departmentCode": "BIZ_SUPPORT",
                "type": "TEAM",
                "order": 1,
                "memberCount": 11,
                "parentDepartmentId": "550e8400-e29b-41d4-a716-446655440003",
                "children": []
              },
              {
                "id": "550e8400-e29b-41d4-a716-446655440006",
                "departmentName": "연구개발본부",
                "departmentCode": "RND_DIV",
                "type": "TEAM",
                "order": 2,
                "memberCount": 64,
                "parentDepartmentId": "550e8400-e29b-41d4-a716-446655440003",
                "children": [
                  {
                    "id": "550e8400-e29b-41d4-a716-446655440007",
                    "departmentName": "PM실",
                    "departmentCode": "PM_OFFICE",
                    "type": "TEAM",
                    "order": 0,
                    "memberCount": 5,
                    "parentDepartmentId": "550e8400-e29b-41d4-a716-446655440006",
                    "children": []
                  },
                  {
                    "id": "550e8400-e29b-41d4-a716-446655440008",
                    "departmentName": "시스템파트",
                    "departmentCode": "SYS_PART",
                    "type": "TEAM",
                    "order": 1,
                    "memberCount": 3,
                    "parentDepartmentId": "550e8400-e29b-41d4-a716-446655440006",
                    "children": []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
]
```

### 계층 구조 시각화

위 응답은 아래와 같은 트리 구조를 나타냅니다:

```
루미르 주식회사 (COMPANY, order: 0)
  └─ 루미르주식회사본사 (DIVISION, order: 0, 90명)
      └─ 대표이사 (DEPARTMENT, order: 0, 90명)
          ├─ LumirX-1 TF (TEAM, order: 0, 7명)
          ├─ 경영지원본부 (TEAM, order: 1, 11명)
          └─ 연구개발본부 (TEAM, order: 2, 64명)
              ├─ PM실 (TEAM, order: 0, 5명)
              └─ 시스템파트 (TEAM, order: 1, 3명)
```

### 에러 응답

| 상태 코드 | 설명 | 대응 |
|-----------|------|------|
| `401` | 인증 토큰 없음 또는 만료 | 토큰 재발급 후 재요청 |
| `403` | `USER_READ` 권한 없음 | "권한이 없습니다" 표시 |

### fetch 예시

```typescript
/**
 * 부서 계층 구조 조회
 * 전체 부서를 트리 구조로 반환
 */
async function getDepartmentHierarchy(token: string): Promise<DepartmentHierarchyResponse[]> {
  const response = await fetch('/v1/admin/departments', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data: DepartmentHierarchyResponse[] = await response.json();
  return data;
}
```

### 활용 예시: 트리 렌더링 헬퍼

프론트엔드에서 트리 구조를 렌더링할 때 유용한 유틸리티 함수입니다.

```typescript
/**
 * 특정 부서 ID로 트리에서 부서를 찾는 헬퍼
 */
function findDepartmentById(
  departments: DepartmentHierarchyResponse[],
  id: string,
): DepartmentHierarchyResponse | null {
  for (const dept of departments) {
    if (dept.id === id) return dept;
    const found = findDepartmentById(dept.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * 트리를 플랫 배열로 변환 (검색, 필터에 유용)
 */
function flattenDepartments(
  departments: DepartmentHierarchyResponse[],
  depth = 0,
): Array<DepartmentHierarchyResponse & { depth: number }> {
  const result: Array<DepartmentHierarchyResponse & { depth: number }> = [];
  for (const dept of departments) {
    result.push({ ...dept, depth });
    result.push(...flattenDepartments(dept.children, depth + 1));
  }
  return result;
}
```

---

## 5. Enum 값 정리

### DepartmentType (부서 유형)

| 값 | 설명 | UI 표시 (제안) |
|----|------|---------------|
| `COMPANY` | 회사 (최상위) | 회사 |
| `DIVISION` | 사업부/본부 | 본부 |
| `DEPARTMENT` | 부서 | 부서 |
| `TEAM` | 팀 | 팀 |

> 계층 구조는 일반적으로 `COMPANY` → `DIVISION` → `DEPARTMENT` → `TEAM` 순서입니다.
> 하지만 실제 데이터에서는 `parentDepartmentId`로 결정되므로, `type`은 표시용으로만 사용하세요.

---

## 6. 에러 처리

### 공통 HTTP 상태 코드

| 코드 | 의미 | 프론트엔드 대응 |
|------|------|----------------|
| `200` | 성공 | 정상 처리 |
| `401` | 인증 만료/없음 | 로그인 페이지로 리다이렉트 |
| `403` | 권한 없음 | "권한이 없습니다" 표시 |
| `500` | 서버 오류 | "서버 오류가 발생했습니다" 표시 |

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

### 사용 예시

```typescript
// apiRequest 유틸리티를 사용한 간결한 호출
const departments = await apiRequest<DepartmentHierarchyResponse[]>('/v1/admin/departments');
```

---

## 7. cURL 테스트

```bash
# 토큰 발급 (로그인)
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@lumir.com", "password": "password"}' | jq -r '.accessToken')

# 부서 계층 구조 조회
curl -X GET http://localhost:3000/v1/admin/departments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq
```

### 응답 확인 포인트

```bash
# 최상위 부서 개수 확인
curl -s -X GET http://localhost:3000/v1/admin/departments \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

# 첫 번째 부서의 하위 부서 확인
curl -s -X GET http://localhost:3000/v1/admin/departments \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].children'

# 전체 부서 이름만 추출 (재귀)
curl -s -X GET http://localhost:3000/v1/admin/departments \
  -H "Authorization: Bearer $TOKEN" | jq '[.. | .departmentName? // empty]'
```
