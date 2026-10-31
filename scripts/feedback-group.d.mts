export const KIND_ORDER: string[];
export interface QuickRow { round?: string; build?: string; mode?: string; answers: Record<string, any>; context?: Record<string, any> }
export function groupQuick(rows: QuickRow[]): { total: number; old: number; byKind: Record<string, QuickRow[]>; noKind: QuickRow[]; screens: Record<string, { notes: number; ratings: number[]; clearYes: number; clearNo: number; why: Record<string, number> }> };
export function renderQuick(rows: QuickRow[]): string;
