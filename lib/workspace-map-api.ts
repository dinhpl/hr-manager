import { apiClient } from './api-client';
import type { WorkspaceItem } from '@/components/workspace-map/types';

export interface WorkspaceMapCamera {
  azimuth: number;
  elevation: number;
}

export interface WorkspaceMapData {
  items: WorkspaceItem[];
  wallThickness?: number;
  camera?: WorkspaceMapCamera;
}

export async function fetchWorkspaceMap(): Promise<WorkspaceMapData> {
  const res = await apiClient.get<WorkspaceMapData>('/api/settings/workspace-map');
  return res.data ?? { items: [] };
}

export async function saveWorkspaceMap(data: WorkspaceMapData): Promise<void> {
  await apiClient.patch('/api/settings/workspace-map', data);
}
