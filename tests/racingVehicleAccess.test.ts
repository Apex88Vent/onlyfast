import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { componentFunction } from './setupLibraryHarness.ts';
import type { SavePermissionContext, SavePermission } from '../src/lib/membership.ts';

const exports = {} as { checkSavePermission: (context: SavePermissionContext) => SavePermission };
const source = readFileSync(new URL('../src/lib/membership.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
new Function('require','exports',compiled)((name: string) => name.includes('testAccount') ? { isCurrentUserTestAccount: () => false } : { supabase: {} },exports);

test('Rookie/Pro save limits follow active vehicle while preserving historical classes', () => {
  for (const tier of ['rookie','pro'] as const) {
    const context: SavePermissionContext = { tier, kind: 'base_template', isExistingSave: false,
      existingRaceWeekendCount: 0, existingBaseSetupCount: 0, existingCarTypes: ['Dwarf Cars'],
      activeCarType: 'Modified', newCarType: 'Modified' };
    assert.equal(exports.checkSavePermission(context).allowed, true);
    assert.equal(exports.checkSavePermission({ ...context, newCarType: 'Dwarf Cars' }).reason, 'car_type_locked');
    assert.equal(exports.checkSavePermission({ ...context, newCarType: 'Sport Mod', isExistingSave: true }).allowed, false);
    assert.equal(exports.checkSavePermission({ ...context, existingBaseSetupCount: 1 }).allowed, tier === 'pro');
    assert.equal(exports.checkSavePermission({ ...context, kind: 'race_weekend', existingRaceWeekendCount: 2 }).allowed, tier === 'pro');
  }
  assert.equal(exports.checkSavePermission({ tier:'team',kind:'race_weekend',isExistingSave:false,
    existingCarTypes:['Dwarf Cars','GT3'],activeCarType:'Modified',newCarType:'GT3',
    existingBaseSetupCount:50,existingRaceWeekendCount:50 }).allowed,true);
});

test('race serializer cannot relabel an inactive session; Teams keeps original vehicle associations', () => {
  const build = componentFunction('SetupDashboard.tsx','buildPayload', { selectedCar: 'Modified', classLocksEnabled: true });
  assert.throws(() => build({ raceClass:'Dwarf Cars',rf_pressure:'15' },'heat'), /Switch back/);
  assert.equal(build({ raceClass:'Modified',rf_pressure:'15' },'heat').race_class,'Modified');
  const teams = componentFunction('SetupDashboard.tsx','buildPayload',{ selectedCar:'Modified',classLocksEnabled:false });
  assert.equal(teams({ raceClass:'Dwarf Cars',rf_pressure:'15' },'heat').race_class,'Dwarf Cars');
});
