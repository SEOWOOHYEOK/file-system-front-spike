/**
 * 사용자/역할 API 타입 정의
 * 300.사용자, 310.역할
 */

// ============================================
// 공통 타입
// ============================================

/**
 * 직원 재직 상태
 */
export type EmployeeStatus = '재직중' | '퇴사' | '휴직';

// ============================================
// 300.사용자 (User)
// ============================================

/**
 * User 기본 엔티티
 */
export interface User {
  id: string;
  isActive: boolean;
  roleId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 부서-직책 정보
 */
export interface DepartmentPosition {
  departmentId: string;
  departmentName: string;
  positionId: string;
  positionTitle: string;
  isManager: boolean;
}

/**
 * Employee 정보
 */
export interface EmployeeInfo {
  employeeNumber: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  hireDate: string;
  status: EmployeeStatus;
  departmentPositions: DepartmentPosition[];
}

/**
 * User + Employee 정보 응답 (목록 조회용)
 */
export interface UserWithEmployee {
  id: string;
  isActive: boolean;
  roleId: string | null;
  roleName: string | null;
  employee: EmployeeInfo | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * User 목록 응답
 */
export interface UsersResponse {
  items: UserWithEmployee[];
  total: number;
}

/**
 * User 상세 조회 응답 (Role 포함)
 */
export interface UserWithRole {
  id: string;
  isActive: boolean;
  role: {
    id: string;
    name: string;
    permissions: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * User 필터링 쿼리 파라미터
 */
export interface UserFilterQuery {
  employeeName?: string;
  employeeNumber?: string;
  status?: EmployeeStatus;
}

/**
 * Role 부여 요청
 */
export interface AssignRoleRequest {
  roleId: string;
}

/**
 * User 동기화 결과
 */
export interface SyncResult {
  created: number;
  activated: number;
  deactivated: number;
  skipped: number;
  unchanged: number;
  processingTimeMs: number;
}

// ============================================
// 310.역할 (Role)
// ============================================

/**
 * Permission
 */
export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
}

/**
 * Role
 */
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Role 생성 요청
 */
export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissionCodes: string[];
}

/**
 * Role 목록 응답
 */
export interface RolesResponse {
  items: Role[];
  total: number;
}

// ============================================
// 310.즐겨찾기 (Favorite)
// ============================================

/**
 * 즐겨찾기 대상 타입
 */
export type FavoriteTargetType = 'FILE' | 'FOLDER';

/**
 * 즐겨찾기 등록 요청
 */
export interface AddFavoriteRequest {
  targetType: FavoriteTargetType;
  targetId: string;
}

/**
 * 즐겨찾기 응답
 */
export interface FavoriteResponse {
  id: string;
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: string;
}

/**
 * 즐겨찾기 목록 조회 쿼리
 */
export interface GetFavoritesQuery {
  type?: FavoriteTargetType;
}

// ============================================
// 310.최근 활동 - 사용자 활동 내역 (Audit Log)
// ============================================

/**
 * 허용되는 파일/폴더 액션
 */
export type AuditAction =
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

/**
 * 공통 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
  items: T[];
  page: number;        // 현재 페이지 (1부터 시작)
  pageSize: number;    // 페이지 크기
  totalItems: number;  // 전체 아이템 수
  totalPages: number;  // 전체 페이지 수
  hasNext: boolean;    // 다음 페이지 존재 여부
  hasPrev: boolean;    // 이전 페이지 존재 여부
}

/**
 * 활동 내역 항목
 */
export interface RecentActivityItem {
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

/**
 * 활동 내역 응답 타입
 */
export type RecentActivitiesResponse = PaginatedResponse<RecentActivityItem>;

/**
 * 최근 활동 조회 쿼리 파라미터
 */
export interface RecentActivitiesQuery {
  /** 페이지 번호 (기본: 1, 최소: 1) */
  page?: number;
  /** 페이지 크기 (기본: 20, 최소: 1, 최대: 100) */
  pageSize?: number;
  /** 필터할 액션 (쉼표 구분, 선택) */
  actions?: string;
}

// ============================================
// API 로그 타입
// ============================================

export interface UserApiLogEntry {
  id: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  request?: unknown;
  response?: unknown;
  error?: string;
  timestamp: Date;
}
