/**
 * HomePage - API 테스터 메인 페이지
 */
import { Link } from 'react-router-dom';

const menuItems = [
  {
    title: '500.관리자',
    description: '시스템 상태 대시보드 (캐시, NAS, 스토리지, 동기화 이벤트)',
    path: '/admin',
    color: 'bg-blue-500',
  },
  {
    title: '510.관리자-공유',
    description: '공유 목록/상세 조회, 차단/해제, 파일별/사용자별 일괄 차단',
    path: '/admin/shares',
    color: 'bg-indigo-500',
  },
  {
    title: '520.관리자-외부사용자',
    description: '외부 사용자 CRUD, 활성화/비활성화, 비밀번호 초기화',
    path: '/admin/external-users',
    color: 'bg-purple-500',
  },
  {
    title: '600.외부공유',
    description: '파일 공유 생성, 내 공유 목록, 공유 취소',
    path: '/shares',
    color: 'bg-green-500',
  },
  {
    title: '700/710.외부접근',
    description: '외부 사용자 인증 및 공유 파일 접근 테스트',
    path: '/external',
    color: 'bg-orange-500',
  },
];

export function HomePage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900">DMS API Tester</h2>
        <p className="text-gray-500 mt-2">
          관리자 및 외부 공유 API 테스트 도구입니다. 아래 메뉴에서 테스트할 API 그룹을 선택하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`${item.color} h-2 rounded-t-lg`} />
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800">인증 안내</h4>
        <p className="text-sm text-yellow-700 mt-1">
          500~600 API는 내부 SSO 인증이 필요합니다. 상단 헤더에서 로그인하세요.
          <br />
          700/710 API는 외부 사용자 인증을 사용합니다. 해당 페이지에서 별도 로그인하세요.
        </p>
      </div>
    </div>
  );
}
