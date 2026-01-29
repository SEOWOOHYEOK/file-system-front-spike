/**
 * ResultLog Component
 * API 호출 결과 로그 표시
 */
import { useState } from 'react';
import type { ApiLogEntry } from '../types/api.types';

interface ResultLogProps {
  logs: ApiLogEntry[];
  onClear: () => void;
}

export function ResultLog({ logs, onClear }: ResultLogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400 && status < 500) return 'text-orange-600';
    if (status >= 500) return 'text-red-600';
    return 'text-gray-600';
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 text-blue-700';
      case 'POST': return 'bg-green-100 text-green-700';
      case 'PATCH': return 'bg-yellow-100 text-yellow-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatJson = (data: unknown): string => {
    if (!data) return '-';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">실행 로그</h2>
        <button
          onClick={onClear}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          지우기
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            API 호출 기록이 없습니다.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="border rounded overflow-hidden"
            >
              <div
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="p-2 bg-gray-50 cursor-pointer hover:bg-gray-100 flex items-center gap-2"
              >
                <span className={`px-2 py-0.5 text-xs rounded font-medium ${getMethodColor(log.method)}`}>
                  {log.method}
                </span>
                <span className="flex-1 font-mono text-sm truncate">
                  {log.url}
                </span>
                <span className={`font-medium ${getStatusColor(log.status)}`}>
                  {log.status}
                </span>
                <span className="text-gray-500 text-sm">
                  {log.duration}ms
                </span>
              </div>
              
              {expandedId === log.id && (
                <div className="p-3 text-xs space-y-3 border-t bg-white">
                  <div className="text-gray-500">
                    {log.timestamp.toLocaleTimeString('ko-KR')}
                  </div>
                  
                  {log.request !== undefined && log.request !== null && (
                    <div>
                      <div className="font-medium text-gray-600 mb-1">Request:</div>
                      <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
                        {formatJson(log.request)}
                      </pre>
                    </div>
                  )}
                  
                  <div>
                    <div className="font-medium text-gray-600 mb-1">Response:</div>
                    <pre className="bg-gray-100 p-2 rounded overflow-x-auto max-h-48">
                      {formatJson(log.response)}
                    </pre>
                  </div>
                  
                  {log.error && (
                    <div>
                      <div className="font-medium text-red-600 mb-1">Error:</div>
                      <pre className="bg-red-50 text-red-700 p-2 rounded">
                        {log.error}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
