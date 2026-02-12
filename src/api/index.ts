/**
 * API 모듈 통합 Export
 *
 * 모든 API 클라이언트를 통합하여 export합니다.
 */

// ============================================
// 공유 API 클라이언트 (인터셉터 포함)
// ============================================
export { default as apiClient, tokenStorage } from './apiClient';

// ============================================
// 100.인증 (Auth)
// ============================================
export { authApi } from './authApi';

// ============================================
// 200.파일 (File)
// ============================================
export { fileApi, setFileLogCallback } from './fileApi';

// ============================================
// 210.폴더 (Folder)
// ============================================
export { folderApi, setFolderLogCallback } from './folderApi';

// ============================================
// 220.휴지통 (Trash)
// ============================================
export { trashApi, setTrashLogCallback } from './trashApi';

// ============================================
// 300.사용자 (User)
// ============================================
export { userApi, setUserLogCallback } from './userApi';

// ============================================
// 310.역할 (Role)
// ============================================
export { roleApi, setRoleLogCallback } from './roleApi';

// ============================================
// 500.관리자 (Admin System)
// ============================================
export { adminSystemApi, setAdminLogCallback } from './adminApi';

// ============================================
// 510.관리자-공유 (Admin Share)
// ============================================
export { adminShareApi } from './adminApi';

// ============================================
// 520.관리자-외부사용자 (Admin External User)
// ============================================
export { adminExternalUserApi } from './adminApi';

// ============================================
// 600.외부공유 (File Share)
// ============================================
export { fileShareApi } from './adminApi';

// ============================================
// 700.외부인증 & 710.외부접근 (External Share)
// ============================================
export {
  externalShareApi,
  setLogCallback as setExternalShareLogCallback,
  login as externalLogin,
  refreshToken as externalRefreshToken,
  logout as externalLogout,
  changePassword as externalChangePassword,
  getMyShares as externalGetMyShares,
  getShareDetail as externalGetShareDetail,
  getContent as externalGetContent,
  downloadFile as externalDownloadFile,
} from './externalShareApi';

// ============================================
// 동기화 대시보드 (Sync Dashboard)
// ============================================
export { syncDashboardApi, setSyncDashboardLogCallback } from './syncDashboardApi';

// ============================================
// 파일 작업 요청 (File Action Request)
// ============================================
export { fileActionRequestApi, fileActionRequestAdminApi } from './fileActionRequestApi';

// ============================================
// Default Export (통합 API 객체)
// ============================================
import { authApi } from './authApi';
import { adminSystemApi, adminShareApi, adminExternalUserApi, fileShareApi } from './adminApi';
import { fileApi } from './fileApi';
import { folderApi } from './folderApi';
import { trashApi } from './trashApi';
import { userApi } from './userApi';
import { roleApi } from './roleApi';
import { externalShareApi } from './externalShareApi';
import { syncDashboardApi } from './syncDashboardApi';
import { fileActionRequestApi, fileActionRequestAdminApi } from './fileActionRequestApi';

export const api = {
  // 100.인증
  auth: authApi,

  // 200.파일
  file: fileApi,

  // 210.폴더
  folder: folderApi,

  // 220.휴지통
  trash: trashApi,

  // 300.사용자
  user: userApi,

  // 310.역할
  role: roleApi,

  // 500.관리자
  adminSystem: adminSystemApi,

  // 510.관리자-공유
  adminShare: adminShareApi,

  // 520.관리자-외부사용자
  adminExternalUser: adminExternalUserApi,

  // 600.외부공유
  fileShare: fileShareApi,

  // 700.외부인증 & 710.외부접근
  externalShare: externalShareApi,

  // 동기화 대시보드
  syncDashboard: syncDashboardApi,

  // 파일 작업 요청
  fileActionRequest: fileActionRequestApi,
  fileActionRequestAdmin: fileActionRequestAdminApi,
};

export default api;
