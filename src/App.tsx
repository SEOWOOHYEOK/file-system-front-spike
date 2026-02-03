/**
 * DMS Admin & External Share API Tester
 * 500~600: 관리자 API, 700~710: 외부접근 API 테스트 도구
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/common/Layout';
import { HomePage } from './pages/HomePage';
import { MyFilesPage } from './pages/MyFilesPage';
import { AdminPage } from './pages/AdminPage';
import { AdminSharePage } from './pages/AdminSharePage';
import { AdminExternalUserPage } from './pages/AdminExternalUserPage';
import { SharePage } from './pages/SharePage';
import { ExternalPage } from './pages/ExternalPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="my-files" element={<MyFilesPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="admin/shares" element={<AdminSharePage />} />
          <Route path="admin/external-users" element={<AdminExternalUserPage />} />
          <Route path="shares" element={<SharePage />} />
          <Route path="external" element={<ExternalPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
