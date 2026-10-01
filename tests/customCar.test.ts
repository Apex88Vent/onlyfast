import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_CAR, CUSTOM_CAR_DISCIPLINES, CUSTOM_SHEET_KEY, emptyCustomSheet, snapshotCustomSheet, readCustomSheet, copyCustomCorner, customSheetFromRow, oppositeCorners } from '../src/lib/customCar.ts';
import { AVAILABLE_CAR_CLASSES, CAR_CLASSES, CLASS_CONFIGS } from '../src/lib/classConfigs.ts';

test('Custom Car is configured for all disciplines but available only on dirt', () => {
  assert.deepEqual(CUSTOM_CAR_DISCIPLINES, { dirt_oval: true, pavement_oval: false, road_course: false, motorcycle: false, rc: false });
  assert.ok(CAR_CLASSES.includes(CUSTOM_CAR));
  assert.ok(AVAILABLE_CAR_CLASSES.includes(CUSTOM_CAR));
  assert.deepEqual(AVAILABLE_CAR_CLASSES.filter(c => c !== CUSTOM_CAR), ['Dwarf Cars', 'Modified', 'Sport Mod', 'Lightning Sprints', 'Pro Stock', 'Pure Stock']);
  assert.deepEqual(CLASS_CONFIGS[CUSTOM_CAR].generalFields, []);
});

test('every fresh sheet has six independently empty sections', () => {
  const sheet = emptyCustomSheet();
  assert.deepEqual(sheet.sections.map(s => s.section_name), ['Front End', 'Left Front', 'Right Front', 'Left Rear', 'Right Rear', 'Rear End']);
  assert.ok(sheet.sections.every(s => s.fields.length === 0));
  sheet.sections[0].fields.push({ id: 'one', label: 'Anything / Notes °', value: '3.5°', order: 0 });
  assert.equal(emptyCustomSheet().sections[0].fields.length, 0);
});

for (const [sourceId, targetId] of Object.entries(oppositeCorners)) {
  test(`${sourceId} copies labels, order and values to ${targetId} without linking or mutating either source`, () => {
    const sheet = emptyCustomSheet();
    sheet.sections.find(s => s.section_id === sourceId)!.fields = [
      { id: 'one', label: 'Spring Rate', value: '300', order: 0 },
      { id: 'two', label: 'Custom Notes', value: 'Any text', order: 1 },
    ];
    sheet.sections.find(s => s.section_id === targetId)!.fields = [{ id: 'old', label: 'Old', value: '10', order: 0 }];
    const copied = copyCustomCorner(sheet, sourceId);
    const target = copied.sections.find(s => s.section_id === targetId)!;
    const source = copied.sections.find(s => s.section_id === sourceId)!;
    assert.deepEqual(target.fields.map(({ id, ...f }) => f), source.fields.map(({ id, ...f }) => f));
    assert.notEqual(target.fields[0].id, source.fields[0].id);
    target.fields[0].value = '450';
    source.fields[1].label = 'Renamed independently';
    assert.equal(source.fields[0].value, '300');
    assert.equal(target.fields[1].label, 'Custom Notes');
    assert.equal(sheet.sections.find(s => s.section_id === targetId)!.fields[0].value, '10');
  });
}

test('template edits, deletion and new snapshots leave historical race and base setups intact', () => {
  const template = emptyCustomSheet();
  template.sections[1].fields = [{ id: 'caster', label: 'Caster', value: '', order: 0 }];
  const race = snapshotCustomSheet(template);
  race.sections[1].fields[0].value = '3.5°';
  const baseRow = { race_class: CUSTOM_CAR, custom_fields: { [CUSTOM_SHEET_KEY]: race } };
  const savedJson = JSON.stringify(baseRow);
  template.sections[1].fields[0].label = 'New Label';
  template.sections[1].fields = [];
  assert.equal(JSON.stringify(baseRow), savedJson);
  const loaded = readCustomSheet(customSheetFromRow(JSON.parse(savedJson)))!;
  assert.equal(loaded.sections[1].fields[0].label, 'Caster');
  assert.equal(loaded.sections[1].fields[0].value, '3.5°');
  const nextRace = snapshotCustomSheet(loaded);
  nextRace.sections[1].fields[0].value = '4°';
  assert.equal(loaded.sections[1].fields[0].value, '3.5°');
  assert.equal(race.sections[1].fields[0].value, '3.5°');
  assert.equal(snapshotCustomSheet(template).sections[1].fields.length, 0);
});

test('reusable definitions clear event values while preserving arbitrary labels and order', () => {
  const sheet = emptyCustomSheet();
  sheet.sections[0].fields = [
    { id: 'b', label: 'My own setting', value: '10', order: 0 },
    { id: 'a', label: 'Caster', value: '3.5°', order: 1 },
  ];
  const definition = snapshotCustomSheet(sheet, true);
  const reloaded = readCustomSheet(JSON.stringify(definition))!;
  assert.deepEqual(reloaded.sections[0].fields.map(f => [f.id, f.label, f.value, f.order]), [['b', 'My own setting', '', 0], ['a', 'Caster', '', 1]]);
  assert.equal(sheet.sections[0].fields[0].value, '10');
});

test('legacy predefined rows do not acquire Custom Car fields and malformed data is rejected', () => {
  assert.equal(customSheetFromRow({ race_class: 'Modified', custom_fields: { note: 'legacy' } }), '');
  assert.deepEqual(readCustomSheet(customSheetFromRow({ race_class: CUSTOM_CAR })), emptyCustomSheet());
  for (const invalid of [undefined, null, '{}', '{', { version: 2, sections: [] }, { version: 1, sections: [] }]) assert.equal(readCustomSheet(invalid), null);
});
