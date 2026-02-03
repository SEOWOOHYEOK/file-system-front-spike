/**
 * UploadDropzone - 드래그앤드롭 업로드 오버레이
 * 파일을 드래그할 때 표시되는 업로드 영역
 */

export function UploadDropzone() {
  return (
    <div className="absolute inset-0 bg-blue-500 bg-opacity-10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10 pointer-events-none">
      <div className="text-center">
        <div className="text-6xl mb-4">📤</div>
        <p className="text-xl font-medium text-blue-600">파일을 여기에 놓으세요</p>
        <p className="text-sm text-blue-500 mt-2">파일이 현재 폴더에 업로드됩니다</p>
      </div>
    </div>
  );
}
