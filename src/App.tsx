/**
 * DMS Admin & External Share API Tester
 * 500~600: 관리자 API, 700~710: 외부접근 API 테스트 도구
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Layout } from './components/common/Layout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { MyFilesPage } from './pages/MyFilesPage';
import { AdminPage } from './pages/AdminPage';
import { AdminSharePage } from './pages/AdminSharePage';
import { AdminExternalUserPage } from './pages/AdminExternalUserPage';
import { ObservabilityPage } from './pages/ObservabilityPage';
import { SharePage } from './pages/SharePage';
import { ExternalPage } from './pages/ExternalPage';
import { ExternalSharePage } from './pages/ExternalSharePage';
import { AdminShareRequestPage } from './pages/AdminShareRequestPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { SyncDashboardPage } from './pages/SyncDashboardPage';
import { AdminFileActionRequestPage } from './pages/AdminFileActionRequestPage';
import { RolePermissionPage } from './pages/RolePermissionPage';
import { AuditLogPage } from './pages/AuditLogPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* 로그인 (비인증) */}
          <Route path="/login" element={<LoginPage />} />
          {/* 외부 사용자 공유 파일함 (710) - 외부 인증 전용 */}
          <Route path="/external-share" element={<ExternalSharePage />} />

          {/* 인증 필요 라우트 */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="my-files" element={<MyFilesPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="admin/shares" element={<AdminSharePage />} />
            <Route path="admin/external-users" element={<AdminExternalUserPage />} />
            <Route path="admin/observability" element={<ObservabilityPage />} />
            <Route path="admin/share-requests" element={<AdminShareRequestPage />} />
            <Route path="admin/user-management" element={<UserManagementPage />} />
            <Route path="admin/sync-dashboard" element={<SyncDashboardPage />} />
            <Route path="admin/file-action-requests" element={<AdminFileActionRequestPage />} />
            <Route path="admin/role-permissions" element={<RolePermissionPage />} />
            <Route path="admin/audit-logs" element={<AuditLogPage />} />
            <Route path="shares" element={<SharePage />} />
            <Route path="external" element={<ExternalPage />} />
          </Route>

          {/* 매칭 안 되는 경로 → 홈으로 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
