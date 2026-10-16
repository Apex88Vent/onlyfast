import { setupClassLabel } from '@/lib/setupLibrary';
import { useState } from 'react';
import HomeLanding, { type HomeAction } from './HomeLanding';
import ChassisSetupForm from './ChassisSetupForm';
import { CustomSheetFields } from './CustomCarSheet';
import { CUSTOM_CAR, emptyCustomSheet } from '@/lib/customCar';

// Visual continuation for the protected onboarding preview. It reuses the
// actual landing and form components, with no account reads, saves or resets.
const SetupPreviewLanding = ({ selectedCar, onChangeClass }: {
  selectedCar: string;
  onChangeClass: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [customSheet, setCustomSheet] = useState(emptyCustomSheet);
  const [notice, setNotice] = useState('');
  const onAction = (action: HomeAction) => {
    if (action === 'new-setup') { setEditing(true); setNotice(''); return; }
    setNotice('This is a visual preview. Account tools are available from this landing page in the app.');
  };

  return <>
    <p className="px-4 py-3 text-center text-sm text-[#6B7280] bg-white border-b border-[#E5E7EB]">
      Preview — selected class: {setupClassLabel(selectedCar)}. No account data is changed.
    </p>
    {notice && <p role="status" className="p-4 text-sm text-[#6B7280]">{notice}</p>}
    {editing ? <main className="p-4">
      <button type="button" className="mb-4 font-semibold text-[#00A8E8]" onClick={() => setEditing(false)}>Back to landing</button>
      <h1 className="text-2xl font-bold text-[#1A1B23] mb-4">{setupClassLabel(selectedCar)} Setup Sheet</h1>
      {selectedCar === CUSTOM_CAR ? <CustomSheetFields sheet={customSheet} onChange={setCustomSheet} editing /> :
        <ChassisSetupForm raceClass={selectedCar} data={values} customFields={[]}
          onChange={(key, value) => setValues(previous => ({ ...previous, [key]: value }))} />}
    </main> : <HomeLanding selectedCar={selectedCar} onChangeClass={onChangeClass} onAction={onAction} />}
  </>;
};

export default SetupPreviewLanding;
