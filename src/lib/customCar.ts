export const CUSTOM_CAR = 'Custom Car';
export const CUSTOM_SHEET_KEY = 'onlyfast_custom_car_v1';
export const CUSTOM_CAR_DISCIPLINES: Record<string, boolean> = {
  dirt_oval: true, pavement_oval: false, road_course: false, motorcycle: false, rc: false,
};

export interface CustomCarField { id: string; label: string; value: string; order: number }
export interface CustomCarSection { section_id: string; section_name: string; fields: CustomCarField[] }
export interface CustomCarSheet { version: 1; sections: CustomCarSection[] }

export const emptyCustomSheet = (): CustomCarSheet => ({
  version: 1,
  sections: [ ['front', 'Front End'], ['lf', 'Left Front'], ['rf', 'Right Front'],
    ['lr', 'Left Rear'], ['rr', 'Right Rear'], ['rear', 'Rear End']
  ].map(([section_id, section_name]) => ({ section_id, section_name, fields: [] })),
});

export function readCustomSheet(value: unknown): CustomCarSheet | null {
  try {
    const sheet = typeof value === 'string' ? JSON.parse(value) : value;
    if (sheet?.version !== 1 || !Array.isArray(sheet.sections)) return null;
    const defaults = emptyCustomSheet();
    if (sheet.sections.length !== defaults.sections.length) return null;
    return { version: 1, sections: defaults.sections.map(section => {
      const stored = sheet.sections.find((s: CustomCarSection) => s.section_id === section.section_id);
      if (!stored || !Array.isArray(stored.fields)) throw new Error('Invalid section');
      const fields = stored.fields.map((f: CustomCarField) => {
        if (typeof f.id !== 'string' || typeof f.label !== 'string' || typeof f.value !== 'string' || !Number.isFinite(f.order)) throw new Error('Invalid field');
        return { id: f.id, label: f.label, value: f.value, order: f.order };
      }).sort((a: CustomCarField, b: CustomCarField) => a.order - b.order);
      return { ...section, fields };
    }) };
  } catch { return null; }
}

export function snapshotCustomSheet(sheet: CustomCarSheet, clearValues = false): CustomCarSheet {
  return { version: 1, sections: sheet.sections.map(s => ({ ...s,
    fields: s.fields.map((f, order) => ({ ...f, order, value: clearValues ? '' : f.value })),
  })) };
}

export const oppositeCorners: Record<string, string> = { lf: 'rf', rf: 'lf', lr: 'rr', rr: 'lr' };
export function copyCustomCorner(sheet: CustomCarSheet, sourceId: string): CustomCarSheet {
  const result = snapshotCustomSheet(sheet);
  const source = result.sections.find(s => s.section_id === sourceId);
  const target = result.sections.find(s => s.section_id === oppositeCorners[sourceId]);
  if (source && target) target.fields = source.fields.map((f, order) => ({ ...f, id: crypto.randomUUID(), order }));
  return result;
}

// Stored rows always hydrate their own snapshot, never today's template.
export function customSheetFromRow(row: { race_class?: string; custom_fields?: Record<string, unknown> }): string {
  if (row.race_class !== CUSTOM_CAR) return '';
  return JSON.stringify(readCustomSheet(row.custom_fields?.[CUSTOM_SHEET_KEY]) || emptyCustomSheet());
}
