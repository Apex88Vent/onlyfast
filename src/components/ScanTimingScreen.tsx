import React, { useState, useRef, useCallback, useId } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface LapRow {
  lap: number;
  time: string;
  seconds?: number | null;
}

export interface ScanResult {
  track_name: string | null;
  event_name: string | null;
  race_date: string | null;
  race_class: string | null;
  session_type: string | null;
  driver_name: string | null;
  car_number: string | null;
  finishing_position: number | null;
  total_laps: number | null;
  best_lap_time: string | null;
  best_lap_seconds: number | null;
  average_lap_time: string | null;
  average_lap_seconds: number | null;
  lap_times: LapRow[];
  confidence: number | null;
  fields_missing: string[];
  raw_text: string;
  model_used?: string;
}

const SESSION_TYPES = [
  { value: '', label: '—' },
  { value: 'practice', label: 'Practice / Hot Laps' },
  { value: 'qualifying', label: 'Qualifying / Time Trials' },
  { value: 'heat', label: 'Heat Race' },
  { value: 'b_main', label: 'B Main' },
  { value: 'a_main', label: 'A Main / Feature' },
];

interface Props {
  user: User | null;
  currentSetupName?: string;
  currentSetupId?: string;
  currentSetupType?: 'base' | 'heat' | 'main';
  onSignInClick: () => void;
}

type Step = 'idle' | 'scanning' | 'review' | 'saving' | 'saved';

const ScanTimingScreen: React.FC<Props> = ({
  user,
  currentSetupName,
  currentSetupId,
  currentSetupType,
  onSignInClick,
}) => {
  const [step, setStep] = useState<Step>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachToCurrent, setAttachToCurrent] = useState<boolean>(true);
  const [savedMessage, setSavedMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefix = useId();

  const reset = useCallback(() => {
    setStep('idle');
    setPreviewUrl(null);
    setImageDataUrl(null);
    setScan(null);
    setError(null);
    setSavedMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error || new Error('Could not read file'));
      r.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, etc.).');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Image is too large. Please keep it under 12 MB.');
      return;
    }
    setError(null);
    setSavedMessage('');
    try {
      const dataUrl = await readFileAsDataURL(file);
      setImageDataUrl(dataUrl);
      setPreviewUrl(dataUrl);
      setStep('scanning');
      const { data, error: fnErr } = await supabase.functions.invoke('scan-timing-screen', {
        body: { image_data_url: dataUrl },
      });
      if (fnErr) throw fnErr;
      if (data && data.error) throw new Error(data.error + (data.detail ? `: ${data.detail}` : ''));
      const result = data as ScanResult;
      // Defensive defaults
      result.lap_times = Array.isArray(result.lap_times) ? result.lap_times : [];
      result.fields_missing = Array.isArray(result.fields_missing) ? result.fields_missing : [];
      setScan(result);
      setStep('review');
    } catch (err: any) {
      setError(err?.message || 'Scan failed. Please try again.');
      setStep('idle');
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const updateScan = (patch: Partial<ScanResult>) => {
    setScan(prev => (prev ? { ...prev, ...patch } : prev));
  };

  const updateLap = (idx: number, time: string) => {
    setScan(prev => {
      if (!prev) return prev;
      const next = [...prev.lap_times];
      next[idx] = { ...next[idx], time };
      return { ...prev, lap_times: next };
    });
  };

  const addLap = () => {
    setScan(prev => {
      if (!prev) return prev;
      const nextLap = (prev.lap_times[prev.lap_times.length - 1]?.lap || 0) + 1;
      return { ...prev, lap_times: [...prev.lap_times, { lap: nextLap, time: '' }] };
    });
  };

  const removeLap = (idx: number) => {
    setScan(prev => {
      if (!prev) return prev;
      const next = prev.lap_times.filter((_, i) => i !== idx);
      return { ...prev, lap_times: next };
    });
  };

  const saveSession = async () => {
    if (!user) { onSignInClick(); return; }
    if (!scan) return;
    setStep('saving');
    setError(null);
    try {
      const payload: any = {
        user_id: user.id,
        source: 'screenshot_scan',
        track_name: scan.track_name || null,
        event_name: scan.event_name || null,
        race_date: scan.race_date || null,
        race_class: scan.race_class || null,
        session_type: scan.session_type || null,
        driver_name: scan.driver_name || null,
        car_number: scan.car_number || null,
        finishing_position: scan.finishing_position ?? null,
        total_laps: scan.total_laps ?? (scan.lap_times.length || null),
        best_lap_time: scan.best_lap_time || null,
        best_lap_seconds: scan.best_lap_seconds ?? null,
        average_lap_time: scan.average_lap_time || null,
        average_lap_seconds: scan.average_lap_seconds ?? null,
        lap_times: scan.lap_times || [],
        scan_raw_ocr: scan.raw_text || null,
        scan_confidence: scan.confidence ?? null,
        scan_model: scan.model_used || null,
        scan_fields_missing: scan.fields_missing || [],
      };
      if (attachToCurrent) {
        if (currentSetupId) payload.setup_id = currentSetupId;
        if (currentSetupName) payload.setup_name = currentSetupName;
        if (currentSetupType) payload.setup_type = currentSetupType;
      }
      const { error: insErr } = await supabase.from('race_sessions').insert(payload);
      if (insErr) throw insErr;
      setStep('saved');
      setSavedMessage(
        attachToCurrent && currentSetupName
          ? `Session saved & attached to "${currentSetupName}"`
          : 'Session saved'
      );
      setTimeout(() => {
        reset();
      }, 1800);
    } catch (err: any) {
      setError(err?.message || 'Could not save session.');
      setStep('review');
    }
  };

  // ---------- RENDER ----------
  if (step === 'review' && scan) {
    return (
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="scan-review-heading">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 id="scan-review-heading" className="text-base font-bold text-[#1A1B23] flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Review Scanned Data
            </h3>
            <p className="text-xs text-[#6B7280] mt-1">
              Verify everything below, then click Save Session. Blank fields could not be read — please fill them in.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {typeof scan.confidence === 'number' && (
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${
                scan.confidence >= 0.75 ? 'bg-green-50 text-green-700 border-green-200' :
                scan.confidence >= 0.5 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                Confidence {Math.round((scan.confidence || 0) * 100)}%
              </span>
            )}
            <button
              onClick={reset}
              className="text-xs text-[#6B7280] hover:text-red-600 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            >
              Discard
            </button>
          </div>
        </div>

        {scan.fields_missing.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>The scanner wasn't confident about: <strong>{scan.fields_missing.join(', ')}</strong>. Please fill those in.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,260px)] gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField id={`${prefix}-track`} label="Track" value={scan.track_name || ''} onChange={(v) => updateScan({ track_name: v || null })} placeholder="e.g. Eldora Speedway" />
              <TextField id={`${prefix}-event`} label="Event" value={scan.event_name || ''} onChange={(v) => updateScan({ event_name: v || null })} placeholder="e.g. Friday Night Series" />
              <TextField id={`${prefix}-date`} label="Date" type="date" value={scan.race_date || ''} onChange={(v) => updateScan({ race_date: v || null })} />
              <TextField id={`${prefix}-class`} label="Class / Division" value={scan.race_class || ''} onChange={(v) => updateScan({ race_class: v || null })} placeholder="e.g. Late Model" />
              <SelectField id={`${prefix}-stype`} label="Session Type" value={scan.session_type || ''} onChange={(v) => updateScan({ session_type: v || null })} options={SESSION_TYPES} />
              <TextField id={`${prefix}-driver`} label="Driver Name" value={scan.driver_name || ''} onChange={(v) => updateScan({ driver_name: v || null })} placeholder="e.g. J. Smith" />
              <TextField id={`${prefix}-car`} label="Car #" value={scan.car_number || ''} onChange={(v) => updateScan({ car_number: v || null })} placeholder="e.g. 21x" />
              <TextField
                id={`${prefix}-finpos`}
                label="Finishing Position"
                type="number"
                value={scan.finishing_position?.toString() || ''}
                onChange={(v) => updateScan({ finishing_position: v ? parseInt(v, 10) : null })}
                placeholder="e.g. 3"
              />
              <TextField
                id={`${prefix}-totlaps`}
                label="Total Laps"
                type="number"
                value={scan.total_laps?.toString() || ''}
                onChange={(v) => updateScan({ total_laps: v ? parseInt(v, 10) : null })}
                placeholder="e.g. 20"
              />
              <TextField id={`${prefix}-best`} label="Best Lap" value={scan.best_lap_time || ''} onChange={(v) => updateScan({ best_lap_time: v || null })} placeholder="e.g. 14.523" />
              <TextField id={`${prefix}-avg`} label="Average Lap" value={scan.average_lap_time || ''} onChange={(v) => updateScan({ average_lap_time: v || null })} placeholder="e.g. 14.812" />
            </div>

            {/* Lap times */}
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-[#1A1B23] flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  Individual Lap Times {scan.lap_times.length > 0 && <span className="text-[#9CA3AF] font-normal">({scan.lap_times.length})</span>}
                </h4>
                <button
                  onClick={addLap}
                  className="text-xs text-[#00A8E8] hover:underline font-semibold focus:outline-none focus:ring-2 focus:ring-[#00A8E8] rounded px-1"
                >
                  + Add lap
                </button>
              </div>
              {scan.lap_times.length === 0 ? (
                <p className="text-xs text-[#9CA3AF]">No lap-by-lap data extracted. You can add laps manually.</p>
              ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                  {scan.lap_times.map((lap, i) => (
                    <li key={i} className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5">
                      <span className="text-[10px] font-bold text-[#6B7280] w-7 flex-shrink-0">L{lap.lap}</span>
                      <input
                        type="text"
                        value={lap.time}
                        onChange={(e) => updateLap(i, e.target.value)}
                        className="flex-1 min-w-0 text-xs px-1 py-1 border border-transparent rounded focus:border-[#00A8E8] focus:ring-1 focus:ring-[#00A8E8] outline-none text-[#1A1B23] bg-transparent"
                        placeholder="14.523"
                      />
                      <button
                        onClick={() => removeLap(i)}
                        aria-label={`Remove lap ${lap.lap}`}
                        className="text-[#9CA3AF] hover:text-red-500 flex-shrink-0 p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Attach to setup */}
            <div className="bg-[#00A8E8]/5 border border-[#00A8E8]/20 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachToCurrent}
                  onChange={(e) => setAttachToCurrent(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-[#00A8E8] text-[#00A8E8] focus:ring-[#00A8E8]"
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-[#1A1B23]">
                    Attach to current setup
                  </span>
                  <span className="block text-xs text-[#6B7280] mt-0.5">
                    {currentSetupName
                      ? <>This session will be linked to <strong className="text-[#00A8E8]">"{currentSetupName}"</strong>{currentSetupType ? ` · ${currentSetupType === 'base' ? 'Hot Laps' : currentSetupType === 'heat' ? 'Heat' : 'Main'}` : ''}.</>
                      : <>No saved setup yet — uncheck to save this session as a standalone record.</>}
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs" role="alert">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 flex-wrap pt-2">
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
              >
                Cancel
              </button>
              <button
                onClick={saveSession}
                disabled={step === 'saving'}
                className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
              >
                {step === 'saving' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" />
                    </svg>
                    Save Session
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview */}
          <aside aria-label="Scanned image preview" className="hidden lg:block">
            {previewUrl && (
              <div className="sticky top-32">
                <div className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">Source image</div>
                <img
                  src={previewUrl}
                  alt="Scanned timing screenshot"
                  className="w-full rounded-lg border border-[#E5E7EB] shadow-sm"
                />
                {scan.model_used && (
                  <div className="text-[10px] text-[#9CA3AF] mt-2">
                    Parsed by <span className="font-mono">{scan.model_used}</span>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </section>
    );
  }

  // Idle / scanning / saved states
  return (
    <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="scan-heading">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div>
          <h3 id="scan-heading" className="text-base font-bold text-[#1A1B23] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="3" y1="12" x2="21" y2="12" />
            </svg>
            Scan Timing Screen
          </h3>
          <p className="text-xs text-[#6B7280] mt-1">
            Upload a screenshot from MyRacePass or any timing/results app. We'll OCR & extract the race info — you'll review before saving.
          </p>
        </div>
        <span className="text-[10px] font-semibold bg-[#00A8E8]/10 text-[#00A8E8] px-2 py-1 rounded-full border border-[#00A8E8]/20">
          AI · Beta
        </span>
      </div>

      {step === 'saved' && savedMessage && (
        <div className="mb-3 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2" role="status">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {savedMessage}
        </div>
      )}

      {error && step === 'idle' && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs" role="alert">
          {error}
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          step === 'scanning'
            ? 'border-[#00A8E8] bg-[#00A8E8]/5'
            : 'border-[#E5E7EB] hover:border-[#00A8E8]/40 hover:bg-[#F9FAFB]'
        }`}
      >
        {step === 'scanning' ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <svg className="animate-spin h-8 w-8 text-[#00A8E8]" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-semibold text-[#1A1B23]">Reading screenshot…</p>
            <p className="text-xs text-[#6B7280]">
              Extracting track, class, lap times and finishing position
            </p>
            {previewUrl && (
              <img src={previewUrl} alt="Scanning preview" className="mt-2 max-h-32 rounded border border-[#E5E7EB]" />
            )}
          </div>
        ) : (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-[#00A8E8]/10 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#1A1B23] mb-1">Drop a screenshot here, or</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
            >
              Choose image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            <p className="text-[11px] text-[#9CA3AF] mt-3">
              PNG · JPG · WEBP · up to 12 MB. Works with MyRacePass, RaceMonitor, MyLaps, etc.
            </p>
          </>
        )}
      </div>
    </section>
  );
};

// ---------- Small inline field helpers ----------
const TextField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}> = ({ id, label, value, onChange, type = 'text', placeholder }) => {
  const isMissing = value.trim() === '';
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
        {label}{isMissing && <span className="ml-1 text-amber-600 normal-case font-normal tracking-normal">(empty)</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-all bg-white ${
          isMissing
            ? 'border-amber-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400'
            : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8]'
        }`}
      />
    </div>
  );
};

const SelectField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ id, label, value, onChange, options }) => {
  const isMissing = value.trim() === '';
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
        {label}{isMissing && <span className="ml-1 text-amber-600 normal-case font-normal tracking-normal">(empty)</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-all bg-white ${
          isMissing
            ? 'border-amber-300 focus:ring-2 focus:ring-amber-400 focus:border-amber-400'
            : 'border-[#E5E7EB] focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8]'
        }`}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
};

export default ScanTimingScreen;
