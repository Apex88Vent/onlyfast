import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as storage from '../src/lib/setupLibraryStorage.ts';
import * as access from '../src/lib/setupLibraryAccess.ts';
import * as library from '../src/lib/setupLibrary.ts';
import * as custom from '../src/lib/customCar.ts';

// Exercise the actual UI serializers/hydrators, with only their enclosing
// component state supplied. This catches lost fields in either save pathway.
export function componentFunction(file: string, name: string, state: Record<string, unknown> = {}) {
  const source = readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer) expression = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (!expression) throw new Error(`Missing ${name}`);
  const js = ts.transpileModule(`const fn = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText;
  const scope = { ...storage, ...access, ...library, ...custom,
    user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, selectedCar: 'GT3', customFields: [], customCarTemplate: null,
    classLocksEnabled: false, sessionLabels: { base: 'Hot Laps', heat: 'Heat', main: 'Main' },
    sessionOrders: {}, DEFAULT_ORDER: { base: 0, heat: 1, main: 2 }, savedMeta: {},
    isDefaultRaceSessionType: () => true, TAB_LABELS: { base: { short: 'Hot Laps' } },
    emptyTemplate: () => ({}), ...state,
  };
  return new Function(...Object.keys(scope), `${js}\nreturn fn;`)(...Object.values(scope));
}

export function populatedLibraryState(name: string): Record<string, string> {
  const fields = library.EXPANDED_CLASS_CONFIGS[name].extraSections.flatMap(s => s.fields);
  return { raceClass: name, setup_name: 'Library QA', raceDate: '2026-09-30', trackName: 'QA circuit',
    ...Object.fromEntries(fields.map((f, i) => [f.key, i % 11 === 0 ? '' : i % 7 === 0 ? '0' : f.type === 'number' ? '-2.125' : `setting ${i} / note\nsecond line`])),
  };
}
