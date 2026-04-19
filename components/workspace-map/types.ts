export type Tool = 'select' | 'room' | 'door' | 'desk' | 'chair' | 'tv';
export type ItemType = 'room' | 'door' | 'desk' | 'chair' | 'tv';

export interface WorkspaceItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  roomGroupId?: string;
  cornerRadius?: number;
  rotation?: number;
  assignedMemberId?: string;
  assignedMemberEmail?: string;
  assignedMemberAvatar?: string | null;
}

export interface DrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const STYLES: Record<
  ItemType,
  { fill: string; stroke: string; strokeWidth: number; cornerRadius: number }
> = {
  room: { fill: '#EFF6FF', stroke: '#3B82F6', strokeWidth: 2, cornerRadius: 6 },
  door: { fill: '#FEF3C7', stroke: '#92400E', strokeWidth: 1.5, cornerRadius: 3 },
  desk: { fill: '#FFFBEB', stroke: '#D97706', strokeWidth: 2, cornerRadius: 6 },
  chair: { fill: '#F0FDF4', stroke: '#16A34A', strokeWidth: 1.5, cornerRadius: 8 },
  tv: { fill: '#EEF2FF', stroke: '#4338CA', strokeWidth: 1.8, cornerRadius: 6 },
};

export const DEFAULT_SIZES: Record<ItemType, { width: number; height: number }> = {
  room: { width: 240, height: 180 },
  door: { width: 40, height: 10 },
  desk: { width: 100, height: 55 },
  chair: { width: 40, height: 40 },
  tv: { width: 70, height: 45 },
};

export const LABEL_PREFIXES: Record<ItemType, string> = {
  room: 'Phòng',
  door: 'Cửa',
  desk: 'Bàn',
  chair: 'Ghế',
  tv: 'TV',
};

export const INITIAL_ITEMS: WorkspaceItem[] = [
  // Room 1
  { id: 'r1', type: 'room', x: 40, y: 60, width: 320, height: 260, name: 'Phòng Engineering' },
  // Room 2
  { id: 'r2', type: 'room', x: 410, y: 60, width: 270, height: 260, name: 'Phòng Design' },
  // Room 3
  { id: 'r3', type: 'room', x: 40, y: 380, width: 220, height: 160, name: 'Phòng Meeting' },
  // Desks in room 1
  { id: 'd1', type: 'desk', x: 60, y: 140, width: 100, height: 55, name: 'Bàn 1' },
  { id: 'd2', type: 'desk', x: 185, y: 140, width: 100, height: 55, name: 'Bàn 2' },
  { id: 'd3', type: 'desk', x: 60, y: 240, width: 100, height: 55, name: 'Bàn 3' },
  { id: 'd4', type: 'desk', x: 185, y: 240, width: 100, height: 55, name: 'Bàn 4' },
  // Desks in room 2
  { id: 'd5', type: 'desk', x: 430, y: 140, width: 100, height: 55, name: 'Bàn 5' },
  { id: 'd6', type: 'desk', x: 555, y: 140, width: 100, height: 55, name: 'Bàn 6' },
  { id: 'd7', type: 'desk', x: 430, y: 240, width: 100, height: 55, name: 'Bàn 7' },
  // Chairs (all coords snapped to 20px grid)
  { id: 'c1', type: 'chair', x: 60, y: 100, width: 40, height: 40, name: 'Ghế' },
  { id: 'c2', type: 'chair', x: 180, y: 100, width: 40, height: 40, name: 'Ghế' },
  { id: 'c3', type: 'chair', x: 60, y: 200, width: 40, height: 40, name: 'Ghế' },
  { id: 'c4', type: 'chair', x: 180, y: 200, width: 40, height: 40, name: 'Ghế' },
  { id: 'c5', type: 'chair', x: 440, y: 100, width: 40, height: 40, name: 'Ghế' },
  { id: 'c6', type: 'chair', x: 560, y: 100, width: 40, height: 40, name: 'Ghế' },
  { id: 'c7', type: 'chair', x: 440, y: 200, width: 40, height: 40, name: 'Ghế' },
];
