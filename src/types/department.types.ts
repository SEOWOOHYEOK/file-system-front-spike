/**
 * 부서 관리 API 타입 정의
 * 820.관리자 - 부서 정보
 */

// ─── Enum 타입 ───

/** 부서 유형 */
export type DepartmentType = 'COMPANY' | 'DIVISION' | 'DEPARTMENT' | 'TEAM';

/** 부서 유형 한글 라벨 맵 */
export const DEPARTMENT_TYPE_LABELS: Record<DepartmentType, string> = {
  COMPANY: '회사',
  DIVISION: '본부',
  DEPARTMENT: '부서',
  TEAM: '팀',
};

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
