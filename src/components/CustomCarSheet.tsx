import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { CUSTOM_CAR, CUSTOM_SHEET_KEY, emptyCustomSheet, readCustomSheet, snapshotCustomSheet, copyCustomCorner, oppositeCorners, type CustomCarSheet as Sheet } from '@/lib/customCar';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

const inputClass = 'w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] outline-none text-[#1A1B23] bg-[#F9FAFB] text-sm';
const buttonClass = 'px-3 py-2 rounded-lg text-sm font-semibold text-[#00A8E8] hover:bg-[#00A8E8]/10 disabled:opacity-40';
const SheetContext = createContext<{ template: Sheet | null; initialSheet?: Sheet | null; save: (sheet: Sheet) => Promise<void> }>({ template: null, save: async () => { throw new Error('Select Custom Car to edit its template.'); } });
export const useCustomCarTemplate = () => useContext(SheetContext);

export function CustomSheetFields({ sheet, onChange, editing = false }: { sheet: Sheet; onChange?: (sheet: Sheet) => void; editing?: boolean }) {
  const [copySource, setCopySource] = useState<string | null>(null);
  const replaceFields = (id: string, fields: Sheet['sections'][number]['fields']) => onChange?.({ ...sheet,
    sections: sheet.sections.map(s => s.section_id === id ? { ...s, fields: fields.map((f, order) => ({ ...f, order })) } : s),
  });
  const source = sheet.sections.find(s => s.section_id === copySource);
  const target = sheet.sections.find(s => s.section_id === oppositeCorners[copySource || '']);
  return <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sheet.sections.map(section => <section key={section.section_id} className={`bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm ${['front', 'rear'].includes(section.section_id) ? 'md:col-span-2' : ''}`}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#1A1B23] mb-3">{section.section_name}</h3>
        {!section.fields.length && <p className="text-sm text-[#6B7280] mb-2">No values added yet</p>}
        <div className="space-y-3">{section.fields.map((field, index) => <div key={field.id} className="space-y-1">
          {editing ? <input aria-label={`${section.section_name} field ${index + 1} name`} placeholder="Field name / label" className={inputClass} value={field.label}
            onChange={e => replaceFields(section.section_id, section.fields.map(f => f.id === field.id ? { ...f, label: e.target.value } : f))} />
            : <p className="text-xs font-semibold text-[#4B5563]">{field.label || 'Unnamed field'}</p>}
          <input aria-label={`${section.section_name} ${field.label || `field ${index + 1}`} value`} placeholder="Value" className={inputClass} value={field.value} readOnly={!onChange}
            onChange={e => replaceFields(section.section_id, section.fields.map(f => f.id === field.id ? { ...f, value: e.target.value } : f))} />
          {editing && <div className="flex gap-1">
            <button type="button" className={buttonClass} disabled={index === 0} aria-label={`Move ${field.label} up`} onClick={() => {
              const fields = [...section.fields]; [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]]; replaceFields(section.section_id, fields);
            }}>Move up</button>
            <button type="button" className={buttonClass} disabled={index === section.fields.length - 1} aria-label={`Move ${field.label} down`} onClick={() => {
              const fields = [...section.fields]; [fields[index + 1], fields[index]] = [fields[index], fields[index + 1]]; replaceFields(section.section_id, fields);
            }}>Move down</button>
            <button type="button" className={buttonClass} aria-label={`Delete ${field.label}`} onClick={() => replaceFields(section.section_id, section.fields.filter(f => f.id !== field.id))}>Delete</button>
          </div>}
        </div>)}</div>
        {onChange && <div className="flex flex-wrap gap-1 mt-3">
          <button type="button" className={buttonClass} onClick={() => replaceFields(section.section_id, [...section.fields, { id: crypto.randomUUID(), label: '', value: '', order: section.fields.length }])}>+ Add Value</button>
          {oppositeCorners[section.section_id] && <button type="button" className={buttonClass} onClick={() => {
            const opposite = sheet.sections.find(s => s.section_id === oppositeCorners[section.section_id]);
            if (opposite?.fields.length) setCopySource(section.section_id);
            else onChange(copyCustomCorner(sheet, section.section_id));
          }}>Copy to Opposite Corner</button>}
        </div>}
      </section>)}
    </div>
    <AlertDialog open={!!copySource} onOpenChange={open => { if (!open) setCopySource(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Copy to Opposite Corner</AlertDialogTitle>
        <AlertDialogDescription>Replace the current {target?.section_name} values with the {source?.section_name} values?</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (copySource) onChange?.(copyCustomCorner(sheet, copySource)); setCopySource(null); }}>Copy</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </>;
}

type GateProps = { user: User | null; selectedCar: string; children: React.ReactNode };
export function CustomCarGate(props: GateProps) {
  if (props.selectedCar !== CUSTOM_CAR) return <>{props.children}</>;
  return <CustomCarGateContent key={props.user?.id || 'guest'} {...props} />;
}

function CustomCarGateContent({ user, selectedCar, children }: GateProps) {
  const [template, setTemplate] = useState<Sheet | null>(null);
  const [draft, setDraft] = useState(emptyCustomSheet);
  const [initialSheet, setInitialSheet] = useState<Sheet | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const userId = user?.id;
  useEffect(() => {
    if (selectedCar !== CUSTOM_CAR) return;
    let cancelled = false;
    setLoaded(false); setError(''); setTemplate(null); setInitialSheet(null); setDraft(emptyCustomSheet());
    (async () => {
      try {
        let stored: unknown;
        if (userId) {
          const { data, error } = await supabase.auth.getUser();
          if (error) throw error;
          if (data.user?.id !== userId) throw new Error('Please sign in again.');
          stored = data.user.user_metadata[CUSTOM_SHEET_KEY];
        } else stored = localStorage.getItem(`${CUSTOM_SHEET_KEY}_guest`);
        const sheet = readCustomSheet(stored);
        if (stored && !sheet) throw new Error('The saved sheet could not be read. Your saved data has not been changed.');
        if (!cancelled) { setTemplate(sheet); setLoaded(true); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load setup sheet.'); }
    })();
    return () => { cancelled = true; };
  }, [userId, selectedCar, retry]);
  const save = async (sheet: Sheet) => {
    if (sheet.sections.some(s => s.fields.some(f => !f.label.trim()))) throw new Error('Give every field a name before saving the sheet.');
    const definition = snapshotCustomSheet(sheet, true);
    if (user) {
      const { error } = await supabase.auth.updateUser({ data: { [CUSTOM_SHEET_KEY]: definition } });
      if (error) throw error;
    } else localStorage.setItem(`${CUSTOM_SHEET_KEY}_guest`, JSON.stringify(definition));
    if (!template) setInitialSheet(snapshotCustomSheet(sheet));
    setTemplate(definition);
  };
  if (selectedCar !== CUSTOM_CAR) return <>{children}</>;
  if (!loaded) return <div className="p-6" role="status">{error || 'Loading setup sheet…'}{error && <button className={buttonClass} onClick={() => setRetry(n => n + 1)}>Retry</button>}</div>;
  return <SheetContext.Provider value={{ template, initialSheet, save }}>
    {template ? children : <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h2 className="text-2xl font-bold text-[#1A1B23]">Create Setup Sheet</h2>
      <p className="text-sm text-[#6B7280]">Add your own fields. Your fields become the template for future setups. Values entered here start your first setup.</p>
      <CustomSheetFields sheet={draft} onChange={setDraft} editing />
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button disabled={busy} className="bg-[#00A8E8] text-white px-6 py-2.5 rounded-lg font-semibold disabled:opacity-50" onClick={async () => {
        setBusy(true); setError('');
        try { await save(draft); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save setup sheet.'); } finally { setBusy(false); }
      }}>{busy ? 'Saving…' : 'Save Setup Sheet'}</button>
    </div>}
  </SheetContext.Provider>;
}

export default function CustomCarSetupForm({ data, onChange }: { data: Record<string, string>; onChange: (field: string, value: string) => void }) {
  const { template, save } = useCustomCarTemplate();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const serializedSheet = data[CUSTOM_SHEET_KEY];
  const sheet = readCustomSheet(serializedSheet) || snapshotCustomSheet(template || emptyCustomSheet());
  useEffect(() => {
    if (!serializedSheet && template) onChange(CUSTOM_SHEET_KEY, JSON.stringify(snapshotCustomSheet(template)));
  }, [serializedSheet, template, onChange]);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold">Custom Car Setup Sheet</h2>
      <button type="button" className={buttonClass} onClick={() => setEditing(!editing)}>{editing ? 'Done Editing' : 'Edit Sheet'}</button>
      {editing && <button type="button" disabled={busy} className={buttonClass} onClick={async () => {
        setBusy(true); setMessage('');
        try { await save(sheet); setMessage('Sheet saved for future setups. Existing setups keep their own fields and values.'); }
        catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to save sheet.'); } finally { setBusy(false); }
      }}>Save Setup Sheet for Future Setups</button>}
    </div>
    {editing && <p className="text-sm text-[#6B7280]">Changes apply to this setup. Save the sheet for future setups to update your reusable layout.</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <CustomSheetFields sheet={sheet} editing={editing} onChange={next => {
      if (next.sections.some((s, i) => s.fields.length > sheet.sections[i].fields.length)) setEditing(true);
      onChange(CUSTOM_SHEET_KEY, JSON.stringify(next));
    }} />
  </div>;
}
