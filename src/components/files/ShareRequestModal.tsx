/**
 * ShareRequestModal - 공유 요청 모달
 *
 * 파일 선택 후 공유 대상, (승인자), 권한, 기간, 사유를 입력하여 공유 요청 생성.
 * api-guide-folder.md 기반으로 FileListItemInFolder의 풍부한 파일 정보를 활용하여
 * storageStatus, pendingActionRequest 등을 검증·표시합니다.
 *
 * 구조:
 *  - useShareRequest 훅: 비즈니스 로직 (검색, 폼 상태, 가용성 확인, 제출)
 *  - 서브 컴포넌트: StepIndicator, FileListSection, TargetStep, ApproverStep, SettingsStep, ConfirmStep
 */
import type { ShareableFile, AvailabilityResultItem, ApproverResponse } from '../../types/file-share.types';
import { useShareRequest } from '../../hooks/useShareRequest';
import type { ShareStep, TargetEntry, ShareResult } from '../../hooks/useShareRequest';
import type { ShareTargetType, SharePermissionType, ShareTargetUser, CheckAvailabilityResponse, FileWarning } from '../../types/file-share.types';

// ─── Props ───

interface ShareRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 공유할 파일 목록 (폴더 API의 FileListItemInFolder 호환) */
  files: ShareableFile[];
}

// ─── 유틸리티 ───

/** 파일 크기를 사람이 읽기 좋은 형식으로 변환 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** MIME 타입에 따른 아이콘 반환 */
function getFileIcon(mimeType?: string): string {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📈';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '📦';
  return '📄';
}

/** MIME 타입 라벨 */
function getFileTypeLabel(mimeType?: string): string {
  if (!mimeType) return '';
  if (mimeType.startsWith('image/')) return '이미지';
  if (mimeType.startsWith('video/')) return '동영상';
  if (mimeType.startsWith('audio/')) return '오디오';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('word') || mimeType.includes('document')) return '문서';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '스프레드시트';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '프레젠테이션';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '압축파일';
  return '파일';
}

/** 스토리지 상태 뱃지 색상 */
function getStorageStatusStyle(status: string | null): { bg: string; text: string; label: string } {
  switch (status) {
    case 'AVAILABLE':
      return { bg: 'bg-green-100', text: 'text-green-700', label: '정상' };
    case 'SYNCING':
      return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '동기화 중' };
    case 'MOVING':
      return { bg: 'bg-blue-100', text: 'text-blue-700', label: '이동 중' };
    case 'ERROR':
      return { bg: 'bg-red-100', text: 'text-red-700', label: '오류' };
    case 'UNAVAILABLE':
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: '사용 불가' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-500', label: '-' };
  }
}

// ─── 서브 컴포넌트: 스텝 인디케이터 ───

const STEP_LABELS: Record<ShareStep, string> = {
  target: '대상 선택',
  approver: '승인자 선택',
  settings: '설정',
  confirm: '확인',
};

function StepIndicator({ steps, currentStep }: { steps: ShareStep[]; currentStep: ShareStep }) {
  return (
    <div className="px-6 py-3 border-b bg-gray-50">
      <div className="flex items-center space-x-4">
        {steps.map((s, idx) => (
          <div key={s} className="flex items-center">
            {idx > 0 && <div className="w-8 h-px bg-gray-300 mr-4" />}
            <div className={`flex items-center space-x-2 ${currentStep === s ? 'text-blue-600' : 'text-gray-400'}`}>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep === s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {idx + 1}
              </div>
              <span className="text-sm font-medium">{STEP_LABELS[s]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트: 파일 목록 (폴더 API 데이터 표시) ───

function FileListSection({
  files,
  fileWarnings,
  compact = false,
}: {
  files: ShareableFile[];
  fileWarnings: FileWarning[];
  compact?: boolean;
}) {
  const warningMap = new Map(fileWarnings.map(w => [w.fileId, w]));

  return (
    <div className={`space-y-1 ${compact ? 'max-h-24' : 'max-h-40'} overflow-auto`}>
      {files.map(file => {
        const warning = warningMap.get(file.id);
        const hasRichData = file.size !== undefined || file.mimeType;

        return (
          <div
            key={file.id}
            className={`flex items-center p-2 rounded text-sm ${
              warning?.type === 'storage_unavailable' || warning?.type === 'pending_delete'
                ? 'bg-red-50 border border-red-200'
                : warning
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-gray-50'
            }`}
          >
            <span className="mr-2 flex-shrink-0">{getFileIcon(file.mimeType)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{file.name}</span>
                {/* 스토리지 상태 뱃지 */}
                {file.storageStatus?.nas && file.storageStatus.nas !== 'AVAILABLE' && (
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded flex-shrink-0 ${
                      getStorageStatusStyle(file.storageStatus.nas).bg
                    } ${getStorageStatusStyle(file.storageStatus.nas).text}`}
                  >
                    {getStorageStatusStyle(file.storageStatus.nas).label}
                  </span>
                )}
                {/* Pending Action 뱃지 */}
                {file.pendingActionRequest && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-orange-100 text-orange-700 flex-shrink-0">
                    {file.pendingActionRequest.type === 'MOVE' ? '이동 대기' : '삭제 대기'}
                  </span>
                )}
              </div>
              {/* 상세 정보 행 (폴더 API 데이터가 있을 때) */}
              {hasRichData && !compact && (
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                  {file.mimeType && <span>{getFileTypeLabel(file.mimeType)}</span>}
                  {file.size !== undefined && (
                    <>
                      {file.mimeType && <span>·</span>}
                      <span>{formatFileSize(file.size)}</span>
                    </>
                  )}
                </div>
              )}
              {/* 경고 메시지 */}
              {warning && (
                <div className="text-xs mt-0.5 text-orange-600">{warning.message}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 서브 컴포넌트: 파일 경고 요약 배너 ───

function FileWarningBanner({ warnings }: { warnings: FileWarning[] }) {
  if (warnings.length === 0) return null;

  const blocking = warnings.filter(w => w.type === 'storage_unavailable' || w.type === 'pending_delete');
  const nonBlocking = warnings.filter(w => w.type === 'storage_syncing' || w.type === 'pending_move');

  return (
    <div className="space-y-2">
      {blocking.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm font-medium text-red-800 mb-1">공유 불가 파일</div>
          <div className="space-y-0.5">
            {blocking.map(w => (
              <div key={`${w.fileId}-${w.type}`} className="text-xs text-red-700">
                {w.fileName}: {w.message}
              </div>
            ))}
          </div>
          <div className="text-xs text-red-600 mt-1">
            해당 파일은 공유 요청에서 자동 제외됩니다.
          </div>
        </div>
      )}
      {nonBlocking.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm font-medium text-yellow-800 mb-1">주의 사항</div>
          <div className="space-y-0.5">
            {nonBlocking.map(w => (
              <div key={`${w.fileId}-${w.type}`} className="text-xs text-yellow-700">
                {w.fileName}: {w.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 서브 컴포넌트: Step 1 - 대상 선택 ───

function TargetStep({
  files,
  fileWarnings,
  targetType,
  setTargetType,
  searchKeyword,
  setSearchKeyword,
  searchResults,
  searchLoading,
  targets,
  addTarget,
  removeTarget,
}: {
  files: ShareableFile[];
  fileWarnings: FileWarning[];
  targetType: ShareTargetType;
  setTargetType: (t: ShareTargetType) => void;
  searchKeyword: string;
  setSearchKeyword: (k: string) => void;
  searchResults: ShareTargetUser[];
  searchLoading: boolean;
  targets: TargetEntry[];
  addTarget: (user: ShareTargetUser) => void;
  removeTarget: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* 공유할 파일 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          공유할 파일 ({files.length}개)
        </label>
        <FileListSection files={files} fileWarnings={fileWarnings} />
      </div>

      {/* 파일 경고 배너 */}
      <FileWarningBanner warnings={fileWarnings} />

      {/* 대상 타입 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">대상 타입</label>
        <div className="flex space-x-2">
          <button
            onClick={() => setTargetType('EXTERNAL_USER')}
            className={`flex-1 py-2 text-sm rounded-lg border ${
              targetType === 'EXTERNAL_USER'
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            외부 사용자
          </button>
          <button
            onClick={() => setTargetType('INTERNAL_USER')}
            className={`flex-1 py-2 text-sm rounded-lg border ${
              targetType === 'INTERNAL_USER'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            내부 사용자
          </button>
        </div>
      </div>

      {/* 사용자 검색 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {targetType === 'EXTERNAL_USER' ? '외부' : '내부'} 사용자 검색
        </label>
        <input
          type="text"
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          placeholder="이름, 이메일로 검색"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="max-h-36 overflow-auto border border-gray-200 rounded-lg">
          {searchLoading ? (
            <div className="p-4 text-center text-sm text-gray-400">검색 중...</div>
          ) : searchResults.length > 0 ? (
            searchResults.map(user => {
              const isAdded = targets.some(t => t.userId === user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => addTarget(user)}
                  disabled={isAdded}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between ${
                    isAdded ? 'opacity-50' : ''
                  }`}
                >
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-gray-500">
                      {user.email}
                      {user.department ? ` · ${user.department}` : ''}
                    </div>
                  </div>
                  {isAdded && <span className="text-xs text-blue-500">추가됨</span>}
                </button>
              );
            })
          ) : (
            <div className="p-4 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
          )}
        </div>
      </div>

      {/* 추가된 대상자 */}
      {targets.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            추가된 대상자 ({targets.length}명)
          </label>
          <div className="space-y-1">
            {targets.map(target => (
              <div key={target.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      target.type === 'INTERNAL_USER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {target.type === 'INTERNAL_USER' ? '내부' : '외부'}
                  </span>
                  <span className="text-sm">{target.name || target.userId.slice(0, 12) + '...'}</span>
                  {target.email && <span className="text-xs text-gray-400">{target.email}</span>}
                </div>
                <button onClick={() => removeTarget(target.id)} className="p-1 text-gray-400 hover:text-red-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 서브 컴포넌트: Step 2 - 승인자 선택 ───

function ApproverStep({
  searchKeyword,
  setSearchKeyword,
  searchResults,
  searchLoading,
  selectedApproverId,
  selectedApprover,
  onSelectApprover,
}: {
  searchKeyword: string;
  setSearchKeyword: (k: string) => void;
  searchResults: ApproverResponse[];
  searchLoading: boolean;
  selectedApproverId: string;
  selectedApprover: ApproverResponse | null;
  onSelectApprover: (approver: ApproverResponse) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">승인자 검색</label>
        <input
          type="text"
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          placeholder="이름, 이메일, 부서로 검색"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="max-h-48 overflow-auto border border-gray-200 rounded-lg">
          {searchLoading ? (
            <div className="p-4 text-center text-sm text-gray-400">검색 중...</div>
          ) : searchResults.length > 0 ? (
            searchResults.map(approver => (
              <button
                key={approver.id}
                onClick={() => onSelectApprover(approver)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between ${
                  selectedApproverId === approver.id ? 'bg-blue-50' : ''
                }`}
              >
                <div>
                  <div className="font-medium">{approver.name}</div>
                  <div className="text-xs text-gray-500">
                    {approver.departmentName || '-'} · {approver.positionName || '-'} · {approver.role?.name || '-'}
                  </div>
                  <div className="text-xs text-gray-400">{approver.email}</div>
                </div>
                {selectedApproverId === approver.id && (
                  <span className="text-xs text-blue-500">선택됨</span>
                )}
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
          )}
        </div>
      </div>

      {selectedApprover && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-xs text-blue-600">선택된 승인자:</span>
          <div className="text-sm font-medium text-blue-800 mt-1">
            {selectedApprover.name} ({selectedApprover.departmentName || '-'})
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 서브 컴포넌트: Step 3 - 설정 ───

function SettingsStep({
  hasDirectShare,
  availability,
  permissionType,
  setPermissionType,
  maxDownloads,
  setMaxDownloads,
  startAt,
  setStartAt,
  endAt,
  setEndAt,
  reason,
  setReason,
}: {
  hasDirectShare: boolean | null;
  availability: CheckAvailabilityResponse | null;
  permissionType: SharePermissionType;
  setPermissionType: (t: SharePermissionType) => void;
  maxDownloads: number;
  setMaxDownloads: (n: number) => void;
  startAt: string;
  setStartAt: (d: string) => void;
  endAt: string;
  setEndAt: (d: string) => void;
  reason: string;
  setReason: (r: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* 직권 공유 배너 */}
      {hasDirectShare && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm font-medium text-green-800">즉시 공유됩니다</div>
          <div className="text-xs text-green-600 mt-0.5">
            FILE_SHARE_DIRECT 권한이 있어 관리자 승인 없이 바로 공유됩니다.
          </div>
        </div>
      )}

      {/* 가용성 충돌 경고 */}
      {availability && !availability.available && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm font-medium text-yellow-800 mb-2">일부 충돌이 감지되었습니다</div>
          <div className="space-y-1">
            {availability.results
              .filter((r: AvailabilityResultItem) => r.status !== 'AVAILABLE')
              .map((r: AvailabilityResultItem, idx: number) => (
                <div key={idx} className="text-xs text-yellow-700">
                  {r.fileName} → {r.targetName || r.target.userId.slice(0, 8)}:{' '}
                  {r.status === 'ACTIVE_SHARE_EXISTS' ? '이미 공유됨' : '요청 대기 중'}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 공유 권한 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">공유 권한</label>
        <div className="flex space-x-2">
          <button
            onClick={() => setPermissionType('VIEW')}
            className={`flex-1 py-3 text-sm rounded-lg border ${
              permissionType === 'VIEW'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="font-medium">열람</div>
            <div className="text-xs mt-0.5 opacity-75">파일 보기만 가능</div>
          </button>
          <button
            onClick={() => setPermissionType('DOWNLOAD')}
            className={`flex-1 py-3 text-sm rounded-lg border ${
              permissionType === 'DOWNLOAD'
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="font-medium">다운로드</div>
            <div className="text-xs mt-0.5 opacity-75">파일 다운로드 가능</div>
          </button>
        </div>
        {permissionType === 'DOWNLOAD' && (
          <div className="mt-2">
            <label className="block text-xs text-gray-500 mb-1">최대 다운로드 횟수</label>
            <input
              type="number"
              value={maxDownloads}
              onChange={e => setMaxDownloads(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* 공유 기간 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">공유 기간</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">시작</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={e => setStartAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">종료</label>
            <input
              type="datetime-local"
              value={endAt}
              onChange={e => setEndAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 공유 사유 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          공유 사유 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="공유 요청 사유를 입력해주세요"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트: Step 4 - 확인 ───

function ConfirmStep({
  files,
  fileWarnings,
  shareableFiles,
  targets,
  hasDirectShare,
  designatedApprover,
  permissionType,
  maxDownloads,
  startAt,
  endAt,
  reason,
}: {
  files: ShareableFile[];
  fileWarnings: FileWarning[];
  shareableFiles: ShareableFile[];
  targets: TargetEntry[];
  hasDirectShare: boolean | null;
  designatedApprover: ApproverResponse | null;
  permissionType: SharePermissionType;
  maxDownloads: number;
  startAt: string;
  endAt: string;
  reason: string;
}) {
  const totalSize = shareableFiles.reduce((sum, f) => sum + (f.size ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">공유 요청 내용을 확인해주세요.</div>

      {/* 요약 */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">파일</span>
          <span className="font-medium">
            {shareableFiles.length}개
            {totalSize > 0 && ` (${formatFileSize(totalSize)})`}
          </span>
        </div>
        {files.length !== shareableFiles.length && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">제외된 파일</span>
            <span className="font-medium text-orange-600">{files.length - shareableFiles.length}개</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">대상자</span>
          <span className="font-medium">{targets.length}명</span>
        </div>
        {hasDirectShare === false && designatedApprover && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">승인자</span>
            <span className="font-medium">{designatedApprover.name}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">권한</span>
          <span className="font-medium">
            {permissionType === 'VIEW' ? '열람' : `다운로드 (최대 ${maxDownloads}회)`}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">기간</span>
          <span className="font-medium text-xs">
            {new Date(startAt).toLocaleDateString()} ~ {new Date(endAt).toLocaleDateString()}
          </span>
        </div>
        <div className="border-t pt-3">
          <span className="text-xs text-gray-500">사유</span>
          <p className="text-sm mt-1">{reason}</p>
        </div>
      </div>

      {/* 파일 목록 (상세) */}
      <div>
        <label className="text-xs text-gray-500">파일 목록</label>
        <div className="mt-1">
          <FileListSection files={shareableFiles} fileWarnings={fileWarnings} compact />
        </div>
      </div>

      {/* 대상자 목록 */}
      <div>
        <label className="text-xs text-gray-500">대상자 목록</label>
        <div className="mt-1 space-y-1">
          {targets.map(target => (
            <div key={target.id} className="text-sm text-gray-600 flex items-center space-x-2">
              <span
                className={`px-1.5 py-0.5 text-xs rounded ${
                  target.type === 'INTERNAL_USER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}
              >
                {target.type === 'INTERNAL_USER' ? '내부' : '외부'}
              </span>
              <span>{target.name || target.userId.slice(0, 12) + '...'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트: 결과 배너 ───

function ResultBanner({ result, onClose }: { result: ShareResult; onClose: () => void }) {
  return (
    <div
      className={`p-4 rounded-lg mb-4 ${
        result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
      }`}
    >
      <div className="flex items-center">
        <span className="text-lg mr-2">{result.success ? '✓' : '✗'}</span>
        <span className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
          {result.message}
        </span>
      </div>
      <button
        onClick={onClose}
        className="mt-3 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
      >
        닫기
      </button>
    </div>
  );
}

// ─── 메인 컴포넌트 ───

export function ShareRequestModal({ isOpen, onClose, files }: ShareRequestModalProps) {
  const form = useShareRequest({ isOpen, files, onClose });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">파일 공유 요청</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {files.length}개 파일 선택됨
              {form.hasBlockingWarnings && (
                <span className="text-orange-600 ml-1">
                  ({form.shareableFiles.length}개 공유 가능)
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 스텝 인디케이터 */}
        <StepIndicator steps={form.steps} currentStep={form.step} />

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-auto p-6">
          {/* 권한 로딩 */}
          {form.permissionLoading && (
            <div className="space-y-4 py-8 text-center text-gray-500">
              <div className="animate-pulse">권한 확인 중...</div>
            </div>
          )}

          {/* 결과 배너 */}
          {form.result && <ResultBanner result={form.result} onClose={onClose} />}

          {/* Step 1: 대상 선택 */}
          {!form.permissionLoading && form.step === 'target' && !form.result && (
            <TargetStep
              files={files}
              fileWarnings={form.fileWarnings}
              targetType={form.targetType}
              setTargetType={form.setTargetType}
              searchKeyword={form.targetSearch.keyword}
              setSearchKeyword={form.targetSearch.setKeyword}
              searchResults={form.targetSearch.results}
              searchLoading={form.targetSearch.loading}
              targets={form.targets}
              addTarget={form.addTarget}
              removeTarget={form.removeTarget}
            />
          )}

          {/* Step 2: 승인자 선택 */}
          {!form.permissionLoading && form.step === 'approver' && !form.result && (
            <ApproverStep
              searchKeyword={form.approverSearch.keyword}
              setSearchKeyword={form.approverSearch.setKeyword}
              searchResults={form.approverSearch.results}
              searchLoading={form.approverSearch.loading}
              selectedApproverId={form.designatedApproverId}
              selectedApprover={form.designatedApprover}
              onSelectApprover={(approver) => {
                form.setDesignatedApproverId(approver.id);
                form.setDesignatedApprover(approver);
              }}
            />
          )}

          {/* Step 3: 설정 */}
          {form.step === 'settings' && !form.result && (
            <SettingsStep
              hasDirectShare={form.hasDirectShare}
              availability={form.availability}
              permissionType={form.permissionType}
              setPermissionType={form.setPermissionType}
              maxDownloads={form.maxDownloads}
              setMaxDownloads={form.setMaxDownloads}
              startAt={form.startAt}
              setStartAt={form.setStartAt}
              endAt={form.endAt}
              setEndAt={form.setEndAt}
              reason={form.reason}
              setReason={form.setReason}
            />
          )}

          {/* Step 4: 확인 */}
          {form.step === 'confirm' && !form.result && (
            <ConfirmStep
              files={files}
              fileWarnings={form.fileWarnings}
              shareableFiles={form.shareableFiles}
              targets={form.targets}
              hasDirectShare={form.hasDirectShare}
              designatedApprover={form.designatedApprover}
              permissionType={form.permissionType}
              maxDownloads={form.maxDownloads}
              startAt={form.startAt}
              endAt={form.endAt}
              reason={form.reason}
            />
          )}
        </div>

        {/* 푸터 */}
        {!form.result && !form.permissionLoading && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <button
              onClick={form.goPrev}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {form.step === 'target' ? '취소' : '이전'}
            </button>
            <button
              onClick={form.goNext}
              disabled={form.isNextDisabled}
              className="px-6 py-2 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {form.nextButtonLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
