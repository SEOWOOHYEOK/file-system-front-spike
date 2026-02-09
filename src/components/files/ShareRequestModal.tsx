/**
 * ShareRequestModal - 공유 요청 모달
 * 파일 선택 후 공유 대상, 권한, 기간, 사유를 입력하여 공유 요청 생성
 */
import { useState, useEffect, useCallback } from 'react';
import { shareRequestApi } from '../../api/shareRequestApi';
import { fileShareApi } from '../../api/adminApi';
import type {
  ShareTargetType,
  SharePermissionType,
  CheckAvailabilityResponse,
  AvailabilityResultItem,
} from '../../types/share-request.types';
import type { AvailableExternalUser } from '../../types/admin.types';

interface ShareRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  /** 공유할 파일 목록 */
  files: Array<{ id: string; name: string }>;
}

type Step = 'target' | 'settings' | 'confirm';

interface TargetEntry {
  id: string;
  type: ShareTargetType;
  userId: string;
  name?: string;
  email?: string;
}

export function ShareRequestModal({ isOpen, onClose, token, files }: ShareRequestModalProps) {
  // 스텝
  const [step, setStep] = useState<Step>('target');

  // 대상자
  const [targets, setTargets] = useState<TargetEntry[]>([]);
  const [externalUsers, setExternalUsers] = useState<AvailableExternalUser[]>([]);
  const [targetType, setTargetType] = useState<ShareTargetType>('EXTERNAL_USER');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchUser, setSearchUser] = useState('');

  // 설정
  const [permissionType, setPermissionType] = useState<SharePermissionType>('VIEW');
  const [maxDownloads, setMaxDownloads] = useState(5);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [reason, setReason] = useState('');

  // 가용성 체크
  const [availability, setAvailability] = useState<CheckAvailabilityResponse | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // 제출
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // 초기화
  useEffect(() => {
    if (isOpen) {
      setStep('target');
      setTargets([]);
      setPermissionType('VIEW');
      setMaxDownloads(5);
      setReason('');
      setAvailability(null);
      setResult(null);

      // 기본 날짜 설정 (오늘 ~ 한달 후)
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setStartAt(today.toISOString().slice(0, 16));
      setEndAt(nextMonth.toISOString().slice(0, 16));

      // 외부 사용자 목록 로드
      fetchExternalUsers();
    }
  }, [isOpen]);

  const fetchExternalUsers = async () => {
    try {
      const resp = await fileShareApi.getAvailableExternalUsers(token);
      setExternalUsers(resp.items);
    } catch (error) {
      console.error('Failed to fetch external users:', error);
    }
  };

  // 대상자 추가
  const addTarget = useCallback(() => {
    if (!selectedUserId) return;
    if (targets.some(t => t.userId === selectedUserId)) {
      alert('이미 추가된 대상자입니다.');
      return;
    }

    const extUser = externalUsers.find(u => u.id === selectedUserId);
    setTargets(prev => [
      ...prev,
      {
        id: `${Date.now()}`,
        type: targetType,
        userId: selectedUserId,
        name: extUser?.name,
        email: extUser?.email,
      },
    ]);
    setSelectedUserId('');
  }, [selectedUserId, targetType, targets, externalUsers]);

  // 대상자 제거
  const removeTarget = (id: string) => {
    setTargets(prev => prev.filter(t => t.id !== id));
  };

  // 가용성 확인
  const checkAvailability = async () => {
    if (files.length === 0 || targets.length === 0) return;
    setCheckingAvailability(true);
    try {
      const resp = await shareRequestApi.checkAvailability(token, {
        fileIds: files.map(f => f.id),
        targets: targets.map(t => ({ type: t.type, userId: t.userId })),
      });
      setAvailability(resp);
    } catch (error) {
      console.error('Failed to check availability:', error);
    } finally {
      setCheckingAvailability(false);
    }
  };

  // 설정 단계로 이동
  const goToSettings = async () => {
    if (targets.length === 0) {
      alert('공유 대상을 최소 1명 이상 추가해주세요.');
      return;
    }
    await checkAvailability();
    setStep('settings');
  };

  // 확인 단계로 이동
  const goToConfirm = () => {
    if (!startAt || !endAt) {
      alert('공유 기간을 설정해주세요.');
      return;
    }
    if (!reason.trim()) {
      alert('공유 사유를 입력해주세요.');
      return;
    }
    setStep('confirm');
  };

  // 공유 요청 제출
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const resp = await shareRequestApi.create(token, {
        fileIds: files.map(f => f.id),
        targets: targets.map(t => ({ type: t.type, userId: t.userId })),
        permission: {
          type: permissionType,
          ...(permissionType === 'DOWNLOAD' ? { maxDownloads } : {}),
        },
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        reason: reason.trim(),
      });

      if (resp.isAutoApproved) {
        setResult({ success: true, message: '공유 요청이 자동 승인되었습니다.' });
      } else {
        setResult({ success: true, message: '공유 요청이 제출되었습니다. 관리자 승인을 기다려주세요.' });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '공유 요청에 실패했습니다.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 필터된 외부 사용자
  const filteredExternalUsers = externalUsers.filter(u =>
    !searchUser.trim() ||
    u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
    (u.company && u.company.toLowerCase().includes(searchUser.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">파일 공유 요청</h2>
            <p className="text-sm text-gray-500 mt-0.5">{files.length}개 파일 선택됨</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="px-6 py-3 border-b bg-gray-50">
          <div className="flex items-center space-x-4">
            {(['target', 'settings', 'confirm'] as Step[]).map((s, idx) => (
              <div key={s} className="flex items-center">
                {idx > 0 && <div className="w-8 h-px bg-gray-300 mr-4" />}
                <div className={`flex items-center space-x-2 ${step === s ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="text-sm font-medium">
                    {s === 'target' && '대상 선택'}
                    {s === 'settings' && '설정'}
                    {s === 'confirm' && '확인'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-auto p-6">
          {/* 결과 표시 */}
          {result && (
            <div className={`p-4 rounded-lg mb-4 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
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
          )}

          {/* Step 1: 대상 선택 */}
          {step === 'target' && !result && (
            <div className="space-y-4">
              {/* 선택된 파일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">공유할 파일</label>
                <div className="space-y-1 max-h-24 overflow-auto">
                  {files.map(file => (
                    <div key={file.id} className="flex items-center p-2 bg-gray-50 rounded text-sm">
                      <span className="mr-2">📄</span>
                      <span className="truncate">{file.name}</span>
                    </div>
                  ))}
                </div>
              </div>

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

              {/* 사용자 선택 */}
              {targetType === 'EXTERNAL_USER' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">외부 사용자 선택</label>
                  <input
                    type="text"
                    value={searchUser}
                    onChange={e => setSearchUser(e.target.value)}
                    placeholder="이름, 이메일, 회사로 검색"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="max-h-36 overflow-auto border border-gray-200 rounded-lg">
                    {filteredExternalUsers.length > 0 ? (
                      filteredExternalUsers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUserId(user.id);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between ${
                            selectedUserId === user.id ? 'bg-blue-50' : ''
                          } ${targets.some(t => t.userId === user.id) ? 'opacity-50' : ''}`}
                          disabled={targets.some(t => t.userId === user.id)}
                        >
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.email} {user.company ? `(${user.company})` : ''}</div>
                          </div>
                          {targets.some(t => t.userId === user.id) && (
                            <span className="text-xs text-blue-500">추가됨</span>
                          )}
                          {selectedUserId === user.id && !targets.some(t => t.userId === user.id) && (
                            <span className="text-xs text-blue-500">선택됨</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-400">
                        외부 사용자가 없습니다.
                      </div>
                    )}
                  </div>
                  <button
                    onClick={addTarget}
                    disabled={!selectedUserId}
                    className="mt-2 w-full px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    대상자 추가
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">내부 사용자 ID</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={selectedUserId}
                      onChange={e => setSelectedUserId(e.target.value)}
                      placeholder="사용자 UUID를 입력하세요"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={addTarget}
                      disabled={!selectedUserId.trim()}
                      className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                      추가
                    </button>
                  </div>
                </div>
              )}

              {/* 추가된 대상자 목록 */}
              {targets.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    추가된 대상자 ({targets.length}명)
                  </label>
                  <div className="space-y-1">
                    {targets.map(target => (
                      <div key={target.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            target.type === 'INTERNAL_USER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {target.type === 'INTERNAL_USER' ? '내부' : '외부'}
                          </span>
                          <span className="text-sm">
                            {target.name || target.userId.slice(0, 12) + '...'}
                          </span>
                          {target.email && (
                            <span className="text-xs text-gray-400">{target.email}</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeTarget(target.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
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
          )}

          {/* Step 2: 설정 */}
          {step === 'settings' && !result && (
            <div className="space-y-4">
              {/* 가용성 경고 */}
              {availability && !availability.available && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-sm font-medium text-yellow-800 mb-2">일부 충돌이 감지되었습니다</div>
                  <div className="space-y-1">
                    {availability.results
                      .filter((r: AvailabilityResultItem) => r.status !== 'AVAILABLE')
                      .map((r: AvailabilityResultItem, idx: number) => (
                        <div key={idx} className="text-xs text-yellow-700">
                          {r.fileName} → {r.targetName || r.target.userId.slice(0, 8)}: {
                            r.status === 'ACTIVE_SHARE_EXISTS' ? '이미 공유됨' : '요청 대기 중'
                          }
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 권한 */}
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

              {/* 사유 */}
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
          )}

          {/* Step 3: 확인 */}
          {step === 'confirm' && !result && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">공유 요청 내용을 확인해주세요.</div>

              {/* 요약 */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">파일</span>
                  <span className="font-medium">{files.length}개</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">대상자</span>
                  <span className="font-medium">{targets.length}명</span>
                </div>
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

              {/* 파일 목록 */}
              <div>
                <label className="text-xs text-gray-500">파일 목록</label>
                <div className="mt-1 space-y-1 max-h-24 overflow-auto">
                  {files.map(file => (
                    <div key={file.id} className="text-sm text-gray-600 flex items-center">
                      <span className="mr-1">📄</span> {file.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* 대상자 목록 */}
              <div>
                <label className="text-xs text-gray-500">대상자 목록</label>
                <div className="mt-1 space-y-1">
                  {targets.map(target => (
                    <div key={target.id} className="text-sm text-gray-600 flex items-center space-x-2">
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        target.type === 'INTERNAL_USER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {target.type === 'INTERNAL_USER' ? '내부' : '외부'}
                      </span>
                      <span>{target.name || target.userId.slice(0, 12) + '...'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 (결과 아닌 경우에만) */}
        {!result && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <button
              onClick={() => {
                if (step === 'target') onClose();
                else if (step === 'settings') setStep('target');
                else if (step === 'confirm') setStep('settings');
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {step === 'target' ? '취소' : '이전'}
            </button>
            <button
              onClick={() => {
                if (step === 'target') goToSettings();
                else if (step === 'settings') goToConfirm();
                else if (step === 'confirm') handleSubmit();
              }}
              disabled={
                (step === 'target' && targets.length === 0) ||
                (step === 'settings' && (!startAt || !endAt || !reason.trim())) ||
                submitting ||
                checkingAvailability
              }
              className="px-6 py-2 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {step === 'confirm'
                ? submitting ? '처리 중...' : '공유 요청'
                : checkingAvailability ? '확인 중...' : '다음'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
