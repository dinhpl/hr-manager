'use client';

import dynamic from 'next/dynamic';

// react-konva uses useLayoutEffect internally — must disable SSR
const WorkspaceMap = dynamic(() => import('@/components/workspace-map/WorkspaceMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      Đang tải canvas…
    </div>
  ),
});

export default function WorkspaceMapPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <WorkspaceMap />
    </div>
  );
}
