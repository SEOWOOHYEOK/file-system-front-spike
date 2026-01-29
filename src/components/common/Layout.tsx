/**
 * Layout - 공통 레이아웃 컴포넌트
 */
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AuthHeader } from './AuthHeader';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <AuthHeader />

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
