# 폴더 검색 내역 API

> 공통: 모든 API는 인증 필수 (토큰에서 userId 자동 추출)

---

## 1. 검색 내역 조회

```
GET /v1/folders/search/history
```

| 파라미터 | 위치 | 타입 | 기본값 | 설명 |
|---|---|---|---|---|
| `page` | query | number | 1 | 페이지 번호 |
| `pageSize` | query | number | 20 | 페이지당 개수 |

**응답 200:**

```json
{
  "items": [
    { "id": "uuid", "keyword": "검색어", "searchedAt": "2026-02-06T..." }
  ],
  "total": 15,
  "page": 1,
  "pageSize": 20
}
```

---

## 2. 검색 내역 단건 삭제

```
DELETE /v1/folders/search/history/:historyId
```

| 파라미터 | 위치 | 타입 | 설명 |
|---|---|---|---|
| `historyId` | path | string (UUID) | 삭제할 내역 ID |

**응답:** `204 No Content` (본문 없음)

---

## 3. 검색 내역 전체 삭제

```
DELETE /v1/folders/search/history
```

파라미터 없음 (인증된 사용자의 전체 내역 삭제)

**응답 200:**

```json
{
  "deletedCount": 15
}
```
