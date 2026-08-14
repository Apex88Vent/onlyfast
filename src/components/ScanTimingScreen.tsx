import React, { useState, useRef, useCallback, useEffect, useId } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { mergeTimingScanResults } from '@/lib/timingData';
import { isOnlyFastFilePickerOpen, setOnlyFastFilePickerActive } from '@/lib/filePickerState';

interface LapRow {
  lap: number;
  time: string;
  seconds?: number | null;
  session_id?: string | null;
  position?: number | string | null;
  driver_name?: string | null;
  car_number?: string | null;
}

export interface ScanResult {
  session_id: string | null;
  track_name: string | null;
  event_name: string | null;
  race_date: string | null;
  race_class: string | null;
  session_type: string | null;
  driver_name: string | null;
  car_number: string | null;
  finishing_position: number | null;
  starting_position: number | null;
  positions_gained_lost: number | null;
  total_laps: number | null;
  best_lap_time: string | null;
  best_lap_seconds: number | null;
  slowest_lap_time: string | null;
  slowest_lap_seconds: number | null;
  average_lap_time: string | null;
  average_lap_seconds: number | null;
  fastest_lap_on_lap: number | null;
  lap_times: LapRow[];
  confidence: number | null;
  fields_missing: string[];
  raw_text: string;
  model_used?: string;
  provider?: string;
  function_version?: string;
  _debug?: Record<string, any>;
}

const EXPECTED_FUNCTION_VERSION = 'scan-v3-testmode';


const SESSION_TYPES = [
  { value: '', label: '—' },
  { value: 'practice', label: 'Practice / Hot Laps' },
  { value: 'qualifying', label: 'Qualifying / Time Trials' },
  { value: 'heat', label: 'Heat Race' },
  { value: 'b_main', label: 'B Main' },
  { value: 'a_main', label: 'A Main / Feature' },
];

const FRONTEND_TIMEOUT_MS = 45_000;
const MAX_IMAGE_WIDTH = 1200;
const JPEG_QUALITY = 0.7;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const IMAGE_ACCEPT = 'image/*';
const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'];
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

const devWarn = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.warn(...args);
};

const devError = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.error(...args);
};

interface Props {
  user: User | null;
  currentSetupName?: string;
  currentSetupId?: string;
  currentSetupType?: 'base' | 'heat' | 'main' | 'extra1' | 'extra2' | 'extra3';
  onSignInClick: () => void;
  onPickerOpening?: () => void;
  onSaved?: (setupId: string, timingData: any) => void;
}

// Toggle to show the dev-only Test Mode button. Leave false in production —
// flip back to `true` if you need to debug the edge function without uploading
// a screenshot. The full Test Mode logic (runTestMode, handleInvokeResult test
// path, stale-deployment detection) is intentionally left intact below.
const SHOW_TEST_MODE_BUTTON = false;


type Step = 'idle' | 'scanning' | 'review' | 'saving' | 'saved';

type BatchImageStatus = 'selected' | 'uploading' | 'processing' | 'success' | 'failed';

interface BatchImageItem {
  id: string;
  signature: string;
  sessionId: string;
  file: File;
  previewUrl: string;
  status: BatchImageStatus;
  error?: string;
  result?: ScanResult;
}

const fileSignature = (file: File): string =>
  `${file.name || 'image'}|${file.size}|${file.lastModified}`;

const getImageExtension = (file: File): string => {
  const name = file.name.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.find(ext => name.endsWith(ext)) || '';
};

const inferImageMimeType = (file: File): string => {
  if (file.type && file.type.startsWith('image/')) return file.type;
  return IMAGE_MIME_BY_EXTENSION[getImageExtension(file)] || 'image/jpeg';
};

const parseImageDataUrl = (dataUrl: string, fallbackMimeType: string) => {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = m?.[1] || fallbackMimeType;
  const base64 = m?.[2] || dataUrl.replace(/^data:[^,]+,/, '');
  const bytes = Math.floor(base64.length * 0.75);
  return { mimeType, base64, bytes };
};

// Compress an image File to a JPEG data URL with a max width.
// Returns { dataUrl, base64, mimeType, width, height, bytes }
async function compressImage(
  file: File,
  maxWidth = MAX_IMAGE_WIDTH,
  quality = JPEG_QUALITY,
): Promise<{ dataUrl: string; base64: string; mimeType: string; width: number; height: number; bytes: number }> {
  const fallbackMimeType = inferImageMimeType(file);
  const dataUrlOrig: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error || new Error('Could not read file'));
    r.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not decode image preview'));
      i.src = dataUrlOrig;
    });

    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    // White background in case the source has transparency (JPEG has no alpha)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const parsed = parseImageDataUrl(dataUrl, 'image/jpeg');
    return { dataUrl, base64: parsed.base64, mimeType: parsed.mimeType, width: w, height: h, bytes: parsed.bytes };
  } catch (err) {
    devWarn('[ScanTimingScreen] Preview/compression failed; scanning original image instead.', err);
    const parsed = parseImageDataUrl(dataUrlOrig, fallbackMimeType);
    return { dataUrl: dataUrlOrig, base64: parsed.base64, mimeType: parsed.mimeType, width: 0, height: 0, bytes: parsed.bytes };
  }
}

const fileHasSupportedImageType = (file: File): boolean => {
  if (file.type && file.type.startsWith('image/')) return true;
  return Boolean(getImageExtension(file));
};

const ScanTimingScreen: React.FC<Props> = ({
  user,
  currentSetupName,
  currentSetupId,
  currentSetupType,
  onSignInClick,
  onPickerOpening,
  onSaved,
}) => {

  const [step, setStep] = useState<Step>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [errorStage, setErrorStage] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [attachToCurrent, setAttachToCurrent] = useState<boolean>(true);
  const [savedMessage, setSavedMessage] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string>('Ready to upload screenshot');
  const [selectedFileInfo, setSelectedFileInfo] = useState<string | null>(null);
  const [batchImages, setBatchImages] = useState<BatchImageItem[]>([]);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isPickingFileRef = useRef(false);
  const pickerChangeReceivedRef = useRef(false);
  const processingFileSignatureRef = useRef<string | null>(null);
  const batchImagesRef = useRef<BatchImageItem[]>([]);
  const prefix = useId();
  const isSavingStep = step === 'saving';

  const setFilePickingActive = useCallback((active: boolean) => {
    isPickingFileRef.current = active;
    setOnlyFastFilePickerActive(active);
  }, []);

  const replaceBatchImages = useCallback((next: BatchImageItem[]) => {
    batchImagesRef.current = next;
    setBatchImages(next);
  }, []);

  const updateBatchImage = useCallback((id: string, patch: Partial<BatchImageItem>) => {
    replaceBatchImages(batchImagesRef.current.map(item => item.id === id ? { ...item, ...patch } : item));
  }, [replaceBatchImages]);

  const reset = useCallback(() => {
    setStep('idle');
    setPreviewUrl(null);
    setScan(null);
    setError(null);
    setErrorDetail(null);
    setErrorStage(null);
    setRawResponse(null);
    setShowDebug(false);
    setSavedMessage('');
    setUploadStatus('Ready to upload screenshot');
    setSelectedFileInfo(null);
    batchImagesRef.current.forEach(item => {
      try { URL.revokeObjectURL(item.previewUrl); } catch {/* ignore */}
    });
    replaceBatchImages([]);
    pickerChangeReceivedRef.current = false;
    setFilePickingActive(false);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, [replaceBatchImages, setFilePickingActive]);

  useEffect(() => () => {
    batchImagesRef.current.forEach(item => {
      try { URL.revokeObjectURL(item.previewUrl); } catch {/* ignore */}
    });
  }, []);

  useEffect(() => {
    if (isOnlyFastFilePickerOpen()) {
      isPickingFileRef.current = true;
      try {
        (window as any).__onlyfastFilePickerOpen = true;
      } catch {
        // Ignore WebView globals that cannot be written.
      }
      setUploadStatus('Opening photo picker');
    }

    const handlePickerReturn = () => {
      if (!isPickingFileRef.current) return;
      window.setTimeout(() => {
        if (!isPickingFileRef.current || pickerChangeReceivedRef.current) return;
        const hasPendingFile = Boolean(
          uploadInputRef.current?.files?.length ||
          cameraInputRef.current?.files?.length
        );
        if (hasPendingFile) return;
        setUploadStatus('No image selected');
        setError(null);
        setErrorDetail(null);
        setErrorStage(null);
        setSelectedFileInfo(null);
        setFilePickingActive(false);
      }, 6000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handlePickerReturn();
    };

    window.addEventListener('focus', handlePickerReturn);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handlePickerReturn);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setFilePickingActive]);

  // Wraps supabase.functions.invoke in a hard frontend timeout (Promise.race).
  // If the edge function doesn't respond in time, we throw a synthetic timeout error.
  const invokeWithTimeout = async (payload: any, timeoutMs = FRONTEND_TIMEOUT_MS) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('Sign in to use timing scan.');
    }
    return await Promise.race([
      supabase.functions.invoke('scan-timing-screen', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: payload,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('FRONTEND_TIMEOUT')), timeoutMs)
      ),
    ]);
  };

  const describeInvokeError = async (
    error: any
  ): Promise<{ detail: string; stage: string; status?: number }> => {
    let detail = error?.message || 'Network error calling scan-timing-screen';
    let stage = 'transport';
    let status: number | undefined;
    try {
      const ctx = error?.context;
      if (ctx) {
        if (typeof ctx.status === 'number') status = ctx.status;
        if (typeof ctx.text === 'function') {
          const txt = await ctx.text();
          try {
            const parsed = JSON.parse(txt);
            if (parsed?.error) detail = String(parsed.error);
            if (parsed?.stage) stage = String(parsed.stage);
          } catch {
            if (txt) detail = txt.slice(0, 300);
          }
        }
      }
    } catch {
      /* ignore */
    }
    return { detail, stage, status };
  };

  const handleInvokeResult = async (
    result: any,
    opts: { testMode?: boolean; applyToReview?: boolean } = {},
  ): Promise<ScanResult> => {
    const { data, error: fnErr } = result || {};
    setRawResponse(data ?? { _transport_error: fnErr?.message || null });

    if (fnErr) {
      const diag = await describeInvokeError(fnErr);
      setErrorStage(diag.stage);
      throw new Error(diag.detail);
    }

    if (!data || typeof data !== 'object') {
      setErrorStage('empty-response');
      throw new Error('Edge function returned an empty or non-JSON response.');
    }

    // ── STALE DEPLOYMENT DETECTION ─────────────────────────────────────
    // If we sent testMode:true but the deployed function did not include
    // function_version === 'scan-v3-testmode' OR didn't return parsed_data,
    // it means the user is still running an OLD version of the edge function.
    const versionOK = data.function_version === EXPECTED_FUNCTION_VERSION;
    const looksLikeOldReachabilityResponse =
      typeof data.message === 'string' &&
      /edge function is reachable/i.test(data.message);

    if (opts.testMode && (!versionOK || looksLikeOldReachabilityResponse)) {
      setErrorStage('stale-deployment');
      setErrorDetail(
        `The deployed edge function did NOT return function_version="${EXPECTED_FUNCTION_VERSION}".\n` +
        `Got function_version=${JSON.stringify(data.function_version)}.\n\n` +
        `This means your Supabase project is still running an OLD copy of ` +
        `scan-timing-screen. You must redeploy:\n\n` +
        `1. Open https://supabase.com/dashboard/project/thpyjvwtfvfxiufchrxn/functions\n` +
        `2. Click the function named "scan-timing-screen"\n` +
        `3. Delete everything in the editor\n` +
        `4. Paste the contents of docs/edge-functions/scan-timing-screen.ts\n` +
        `5. Click "Deploy function"\n` +
        `6. Re-click "Run Test Mode (debug)" here.`
      );
      throw new Error('Stale edge function deployment — see details below.');
    }

    // Surface structured error from edge function (only AFTER stale check)
    if (data.success === false || ('error' in data && data.error)) {
      setErrorStage(data.stage || 'edge-function');
      setErrorDetail(data.detail || null);
      if (data.stage === 'ai-timeout') {
        throw new Error('Scan timed out. Try a smaller or clearer screenshot.');
      }
      const msg = `${data.error || 'Scan failed'}${data.stage ? ` (stage: ${data.stage})` : ''}`;
      throw new Error(msg);
    }

    const isTestMode =
      opts.testMode === true ||
      data.stage === 'test-mode' ||
      data?._debug?.testMode === true ||
      data?._debug?.bypassedOpenAI === true;

    // Prefer parsed_data when provided, falling back to flat top-level fields.
    const pd = (data.parsed_data && typeof data.parsed_data === 'object') ? data.parsed_data : {};
    const src: any = { ...data, ...pd }; // parsed_data wins for overlapping keys

    // Normalize lap_times — accept either {lap, time} OR {lap_number, lap_time}
    const rawLaps: any[] = Array.isArray(src.lap_times) ? src.lap_times : [];
    const lapTimes: LapRow[] = rawLaps.map((lt: any, i: number) => {
      const lapNum =
        typeof lt?.lap === 'number' ? lt.lap :
        typeof lt?.lap_number === 'number' ? lt.lap_number :
        i + 1;
      const timeStr =
        typeof lt?.time === 'string' ? lt.time :
        typeof lt?.lap_time === 'string' ? lt.lap_time :
        (lt?.time != null ? String(lt.time) :
         lt?.lap_time != null ? String(lt.lap_time) : '');
      const seconds =
        typeof lt?.seconds === 'number' ? lt.seconds :
        typeof lt?.lap_time === 'number' ? lt.lap_time :
        null;
      return {
        ...lt,
        lap: lapNum,
        time: timeStr,
        seconds,
        session_id: currentSetupId || null,
      };
    });

    const num = (v: any): number | null =>
      typeof v === 'number' ? v :
      (typeof v === 'string' && v.trim() !== '' && !isNaN(parseFloat(v))) ? parseFloat(v) :
      null;

    const str = (v: any): string | null =>
      v == null ? null :
      typeof v === 'string' ? (v.trim() === '' ? null : v) :
      String(v);

    const mapped: ScanResult = {
      session_id: currentSetupId || null,
      track_name: str(src.track_name),
      event_name: str(src.event_name),
      race_date: str(src.race_date ?? src.date),
      race_class: str(src.race_class ?? src.class_name),
      session_type: str(src.session_type ?? src.session_name),
      driver_name: str(src.driver_name),
      car_number: src.car_number != null ? String(src.car_number) : null,
      finishing_position: typeof src.finishing_position === 'number' ? src.finishing_position :
                          typeof src.finish_position === 'number' ? src.finish_position : null,
      starting_position: typeof src.starting_position === 'number' ? src.starting_position : null,
      positions_gained_lost: typeof src.positions_gained_lost === 'number' ? src.positions_gained_lost : null,
      total_laps: typeof src.total_laps === 'number' ? src.total_laps : null,
      best_lap_time:
        typeof src.best_lap_time === 'string' ? src.best_lap_time :
        typeof src.fastest_lap_time === 'string' ? src.fastest_lap_time :
        typeof src.best_lap === 'string' ? src.best_lap :
        (num(src.best_lap_time) ?? num(src.fastest_lap_time) ?? num(src.best_lap)) !== null
          ? String(num(src.best_lap_time) ?? num(src.fastest_lap_time) ?? num(src.best_lap))
          : null,
      best_lap_seconds: num(src.best_lap_seconds) ?? num(src.fastest_lap_time) ?? num(src.best_lap),
      slowest_lap_time:
        typeof src.slowest_lap_time === 'string' ? src.slowest_lap_time :
        num(src.slowest_lap_time) !== null ? String(num(src.slowest_lap_time)) : null,
      slowest_lap_seconds: num(src.slowest_lap_seconds) ?? num(src.slowest_lap_time),
      average_lap_time:
        typeof src.average_lap_time === 'string' ? src.average_lap_time :
        num(src.average_lap_time) !== null ? String(num(src.average_lap_time)) : null,
      average_lap_seconds: num(src.average_lap_seconds) ?? num(src.average_lap_time),
      fastest_lap_on_lap: typeof src.fastest_lap_on_lap === 'number' ? src.fastest_lap_on_lap : null,
      lap_times: lapTimes,
      confidence: typeof src.confidence === 'number' ? src.confidence : null,
      fields_missing: Array.isArray(src.fields_missing) ? src.fields_missing : [],
      raw_text: typeof src.raw_text === 'string' ? src.raw_text : '',
      model_used: src.model_used,
      provider: src.provider,
      function_version: typeof data.function_version === 'string' ? data.function_version : undefined,
      _debug: src._debug,
    };

    const populated = [
      mapped.track_name, mapped.event_name, mapped.race_date, mapped.race_class,
      mapped.session_type, mapped.driver_name, mapped.car_number,
      mapped.finishing_position, mapped.starting_position, mapped.total_laps,
      mapped.best_lap_time, mapped.average_lap_time, mapped.slowest_lap_time,
      mapped.fastest_lap_on_lap, mapped.positions_gained_lost,
    ].filter(v => v !== null && v !== '' && v !== undefined).length;

    // NEVER show no-data-extracted for test mode (it's canned, by definition has data)
    if (!isTestMode && populated === 0 && mapped.lap_times.length === 0) {
      setErrorStage('no-data-extracted');
      if (opts.applyToReview === false) {
        throw new Error('No timing data could be read from this screenshot.');
      }
      setError('The AI ran successfully but could not read any fields from this screenshot.');
      setErrorDetail(
        (mapped.raw_text ? `Raw text read: "${mapped.raw_text.slice(0, 200)}"` : 'No raw text returned.') +
        ' Try a clearer or higher-resolution screenshot.'
      );
    }

    if (opts.applyToReview !== false) {
      setScan(mapped);
      setStep('review');
    }
    return mapped;
  };



  const processBatchImage = async (item: BatchImageItem): Promise<ScanResult | null> => {
    const { file } = item;
    try {
      if (!fileHasSupportedImageType(file)) {
        throw new Error('Unsupported file type. Choose a PNG, JPG, WEBP, HEIC, or HEIF image.');
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error('Image is too large. Keep each screenshot under 25 MB.');
      }

      updateBatchImage(item.id, { status: 'uploading', error: undefined });
      setUploadStatus(`Uploading ${file.name || 'screenshot'}`);
      const compressed = await compressImage(file, MAX_IMAGE_WIDTH, JPEG_QUALITY);
      setPreviewUrl(compressed.dataUrl);

      updateBatchImage(item.id, { status: 'processing' });
      setUploadStatus(`Processing timing data from ${file.name || 'screenshot'}`);
      const result = await invokeWithTimeout({
        imageBase64: compressed.base64,
        mimeType: compressed.mimeType,
        sessionId: item.sessionId,
      });
      const mapped = await handleInvokeResult(result, { applyToReview: false });
      const sessionResult: ScanResult = {
        ...mapped,
        session_id: item.sessionId,
        lap_times: mapped.lap_times.map(lap => ({ ...lap, session_id: item.sessionId })),
      };
      updateBatchImage(item.id, { status: 'success', result: sessionResult, error: undefined });
      return sessionResult;
    } catch (err: any) {
      devError('[ScanTimingScreen] Screenshot processing failed:', err);
      const message = err?.message === 'FRONTEND_TIMEOUT'
        ? 'Scan timed out. Try a smaller or clearer screenshot.'
        : (err?.message || 'Upload or processing failed.');
      updateBatchImage(item.id, { status: 'failed', error: message, result: undefined });
      return null;
    }
  };

  const showCombinedBatchResult = () => {
    if (!currentSetupId) return false;
    const successful = batchImagesRef.current
      .filter(item => item.status === 'success' && item.result)
      .map(item => item.result as ScanResult);
    const combined = mergeTimingScanResults(
      successful as unknown as Record<string, unknown>[],
      currentSetupId,
    ) as unknown as ScanResult | null;
    if (!combined) return false;

    const failedCount = batchImagesRef.current.filter(item => item.status === 'failed').length;
    setScan(combined);
    setError(null);
    setErrorDetail(null);
    setErrorStage(null);
    setUploadStatus(
      failedCount > 0
        ? `${successful.length} screenshot${successful.length === 1 ? '' : 's'} processed; ${failedCount} failed`
        : `Upload successful: ${successful.length} screenshot${successful.length === 1 ? '' : 's'} combined`,
    );
    setSelectedFileInfo(`${combined.lap_times.length} unique lap${combined.lap_times.length === 1 ? '' : 's'} ready to review`);
    setStep('review');
    return true;
  };

  const handleFiles = async (files: File[]) => {
    if (!currentSetupId) {
      setError('Save this session before uploading timing screenshots.');
      setErrorStage('no-setup-row');
      setUploadStatus('Upload failed: Save the session first');
      return;
    }

    const existingSignatures = new Set(batchImagesRef.current.map(item => item.signature));
    const newItems = files
      .filter(file => !existingSignatures.has(fileSignature(file)))
      .map((file, index): BatchImageItem => ({
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        signature: fileSignature(file),
        sessionId: currentSetupId,
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'selected',
      }));
    if (newItems.length === 0) {
      setUploadStatus('Those screenshots are already in this batch');
      return;
    }

    replaceBatchImages([...batchImagesRef.current, ...newItems]);
    setError(null);
    setErrorDetail(null);
    setErrorStage(null);
    setRawResponse(null);
    setSavedMessage('');
    setStep('scanning');
    setUploadStatus(`${newItems.length} image${newItems.length === 1 ? '' : 's'} selected`);
    setSelectedFileInfo(newItems.map(item => item.file.name || 'screenshot').join(', '));

    for (const item of newItems) {
      await processBatchImage(item);
    }

    if (!showCombinedBatchResult()) {
      const message = 'Upload or processing failed for every screenshot. Retry a failed image or choose another screenshot.';
      setError(message);
      setErrorStage('batch-failed');
      setUploadStatus(message);
      setStep('idle');
    }
  };

  const runTestMode = async () => {
    setError(null);
    setErrorDetail(null);
    setErrorStage(null);
    setRawResponse(null);
    setSavedMessage('');
    setPreviewUrl(null);
    setStep('scanning');
    try {
      const payload = { testMode: true };
      const result = await invokeWithTimeout(payload, 15_000);
      await handleInvokeResult(result, { testMode: true });
    } catch (err: any) {

      devError('[ScanTimingScreen] Test mode failed:', err);
      if (err?.message === 'FRONTEND_TIMEOUT') {
        setErrorStage('frontend-timeout');
        setError('Test mode timed out — the edge function is not reachable.');
      } else {
        setError(err?.message || 'Test mode failed.');
      }
      setStep('idle');
    }
  };


  const openUploadPicker = () => {
    if (!currentSetupId) {
      setError('Save this session before uploading timing screenshots.');
      setErrorStage('no-setup-row');
      setUploadStatus('Upload failed: Save the session first');
      return;
    }
    setError(null);
    setErrorDetail(null);
    setErrorStage(null);
    setSelectedFileInfo(null);
    setUploadStatus('Opening photo picker');
    pickerChangeReceivedRef.current = false;
    onPickerOpening?.();
    setFilePickingActive(true);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
      uploadInputRef.current.click();
    } else {
      setFilePickingActive(false);
      setError('Upload is not ready. Please try again.');
      setErrorStage('file-picker');
      setUploadStatus('Upload failed: Upload is not ready');
    }
  };

  const openCameraPicker = () => {
    if (!currentSetupId) {
      setError('Save this session before taking a timing photo.');
      setErrorStage('no-setup-row');
      setUploadStatus('Upload failed: Save the session first');
      return;
    }
    setError(null);
    setErrorDetail(null);
    setErrorStage(null);
    setSelectedFileInfo(null);
    setUploadStatus('Opening photo picker');
    pickerChangeReceivedRef.current = false;
    onPickerOpening?.();
    setFilePickingActive(true);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    } else {
      setFilePickingActive(false);
      setError('Camera upload is not ready. Please try again.');
      setErrorStage('file-picker');
      setUploadStatus('Upload failed: Camera upload is not ready');
    }
  };

  const handleFileInputSelection = async (input: HTMLInputElement) => {
    setUploadStatus('Returned from photo picker');
    pickerChangeReceivedRef.current = true;
    const files = Array.from(input.files || []);
    if (files.length === 0) {
      setUploadStatus('No image selected');
      setError(null);
      setErrorDetail(null);
      setErrorStage(null);
      setSelectedFileInfo(null);
      setFilePickingActive(false);
      input.value = '';
      return;
    }
    const signature = files.map(fileSignature).join('||');
    if (processingFileSignatureRef.current === signature) return;
    processingFileSignatureRef.current = signature;
    try {
      await handleFiles(files);
    } finally {
      processingFileSignatureRef.current = null;
      setFilePickingActive(false);
      input.value = '';
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFileInputSelection(e.currentTarget);
  };

  const onFileInput = async (e: React.FormEvent<HTMLInputElement>) => {
    await handleFileInputSelection(e.currentTarget);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      void handleFiles(files);
      return;
    }
    const message = 'No image was received from the picker.';
    setUploadStatus(message);
    setError(message);
    setErrorStage('no-file-selected');
    setSelectedFileInfo(null);
  };

  const retryBatchImage = async (id: string) => {
    const item = batchImagesRef.current.find(candidate => candidate.id === id);
    if (!item || !currentSetupId) return;
    setStep('scanning');
    await processBatchImage({ ...item, sessionId: currentSetupId });
    if (!showCombinedBatchResult()) setStep('idle');
  };

  const removeBatchImage = (id: string) => {
    const item = batchImagesRef.current.find(candidate => candidate.id === id);
    if (!item || item.status === 'uploading' || item.status === 'processing') return;
    try { URL.revokeObjectURL(item.previewUrl); } catch {/* ignore */}
    replaceBatchImages(batchImagesRef.current.filter(candidate => candidate.id !== id));
    if (!showCombinedBatchResult()) {
      setScan(null);
      setStep('idle');
      setUploadStatus('Ready to upload screenshot');
      setSelectedFileInfo(null);
    }
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

    // Require an existing setup row to attach to — we now save scan results
    // INTO race_setups.timing_data, not into a separate race_sessions table.
    if (!currentSetupId) {
      setError('Please save this setup first, then re-run the scan. Timing data is stored on the setup record.');
      setErrorStage('no-setup-row');
      return;
    }

    setStep('saving');
    setError(null);
    try {
      // Build the canonical timing_data jsonb payload.
      // This is the single source of truth for the saved scan.
      const timingData: any = {
        session_id: currentSetupId,
        source: batchImagesRef.current.filter(item => item.status === 'success').length > 1
          ? 'screenshot_scan_batch'
          : 'screenshot_scan',
        scanned_at: new Date().toISOString(),
        screenshots: batchImagesRef.current.map(item => ({
          id: item.id,
          session_id: currentSetupId,
          file_name: item.file.name || 'screenshot',
          status: item.status,
          error: item.error || null,
        })),
        // The five "kept" fields the user asked for:
        fastest_lap_time: scan.best_lap_time || null,
        fastest_lap_on_lap: scan.fastest_lap_on_lap ?? null,
        finishing_position: scan.finishing_position ?? null,
        starting_position: scan.starting_position ?? null,
        slowest_lap_time: scan.slowest_lap_time || null,
        average_lap_time: scan.average_lap_time || null,
        positions_gained_lost: scan.positions_gained_lost ?? null,
        // Lap-by-lap array is still preserved on the record (per the spec),
        // even though we no longer render an editor for it.
        lap_times: (scan.lap_times || []).map(lap => ({
          ...lap,
          session_id: currentSetupId,
        })),
        // Raw OCR text if the edge function returned any — useful for debugging.
        raw_text: scan.raw_text || null,
        // Provenance / scanner metadata
        scan_model: scan.model_used || null,
        scan_confidence: scan.confidence ?? null,
        function_version: scan.function_version || null,
      };

      const { data: updated, error: updErr } = await supabase
        .from('race_setups')
        .update({ timing_data: timingData })
        .eq('id', currentSetupId)
        .eq('user_id', user.id)
        .select('id, timing_data')
        .single();

      if (updErr) throw updErr;

      setStep('saved');
      setSavedMessage(
        currentSetupName
          ? `Timing data saved to "${currentSetupName}"`
          : 'Timing data saved to setup'
      );

      if (onSaved && updated?.id) {
        onSaved(updated.id, updated.timing_data);
      }

      setTimeout(() => { reset(); }, 1600);
    } catch (err: any) {
      devError('[ScanTimingScreen] Save failed:', err);
      setError(err?.message || 'Could not save timing data to setup.');
      setErrorDetail(err?.message || null);
      setErrorStage('save-failed');
      setStep('review');
    }
  };

  const renderBatchImages = () => {
    if (batchImages.length === 0) return null;
    const statusLabel: Record<BatchImageStatus, string> = {
      selected: 'Image selected',
      uploading: 'Uploading',
      processing: 'Processing timing data',
      success: 'Upload successful',
      failed: 'Upload or processing failed',
    };
    return (
      <div className="mb-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-bold text-[#1A1B23]">Screenshots in this session batch</p>
          <span className="text-[10px] font-semibold text-[#00A8E8]">{batchImages.length} selected</span>
        </div>
        <div className="space-y-2">
          {batchImages.map(item => {
            const busy = item.status === 'uploading' || item.status === 'processing';
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] bg-white p-2">
                <img
                  src={item.previewUrl}
                  alt={`Selected timing screenshot ${item.file.name || ''}`.trim()}
                  className="h-12 w-12 rounded object-cover border border-[#E5E7EB] flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#1A1B23]">{item.file.name || 'screenshot'}</p>
                  <p className={`text-[10px] font-medium ${item.status === 'failed' ? 'text-red-600' : item.status === 'success' ? 'text-green-700' : 'text-[#6B7280]'}`}>
                    {statusLabel[item.status]}
                  </p>
                  {item.error && <p className="text-[10px] text-red-600 break-words">{item.error}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => void retryBatchImage(item.id)}
                      className="rounded-md border border-[#00A8E8] px-2 py-1 text-[10px] font-semibold text-[#00A8E8] hover:bg-[#00A8E8]/10 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeBatchImage(item.id)}
                    disabled={busy}
                    className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#6B7280] hover:bg-red-50 hover:text-red-600 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };


  // ---------- RENDER ----------
  if (step === 'review' && scan) {
    return (
      <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm" aria-labelledby="scan-review-heading">
        <input
          ref={uploadInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="sr-only"
          onInput={onFileInput}
          onChange={onFileChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          capture="environment"
          className="sr-only"
          onInput={onFileInput}
          onChange={onFileChange}
        />
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
              type="button"
              onClick={reset}
              className="text-xs text-[#6B7280] hover:text-red-600 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            >
              Discard
            </button>
          </div>
        </div>
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={openUploadPicker}
            className="rounded-lg border border-[#00A8E8] px-3 py-2 text-xs font-semibold text-[#00A8E8] hover:bg-[#00A8E8]/10 focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
          >
            Add Another Screenshot
          </button>
        </div>
        {renderBatchImages()}
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-xs" role="status" aria-live="polite">
          <p className="font-semibold">{uploadStatus}</p>
          {selectedFileInfo && <p className="mt-1 break-all text-green-700">{selectedFileInfo}</p>}
        </div>
        {error && (
          <DiagnosticBanner
            kind={errorStage === 'no-data-extracted' ? 'warning' : 'error'}
            title={error}
            detail={errorDetail}
            stage={errorStage}
            rawResponse={rawResponse}
            showDebug={showDebug}
            onToggleDebug={() => setShowDebug(v => !v)}
          />
        )}

        {/* Only warn about fields the user actually cares about (the 5 kept ones).
            Any other "fields_missing" entries from the AI (track_name, driver_name, etc.)
            are irrelevant now — silently filter them out. */}
        {(() => {
          const KEPT_FIELDS = new Set([
            'best_lap_time', 'fastest_lap_time',
            'fastest_lap_on_lap',
            'slowest_lap_time',
            'average_lap_time',
            'positions_gained_lost',
          ]);
          const FIELD_LABELS: Record<string, string> = {
            best_lap_time: 'Fastest Lap Time',
            fastest_lap_time: 'Fastest Lap Time',
            fastest_lap_on_lap: 'Fastest Lap On Lap #',
            slowest_lap_time: 'Slowest Lap Time',
            average_lap_time: 'Average Lap Time',
            positions_gained_lost: 'Positions Gained / Lost',
          };
          const relevant = (scan.fields_missing || [])
            .filter(f => KEPT_FIELDS.has(f))
            .map(f => FIELD_LABELS[f] || f);
          // Dedup
          const unique = Array.from(new Set(relevant));
          if (unique.length === 0) return null;
          return (
            <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>The scanner wasn't confident about: <strong>{unique.join(', ')}</strong>. Please fill those in.</span>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,260px)] gap-6">
          <div className="space-y-4">
            {/* Setup context (read-only banner) */}
            {currentSetupName ? (
              <div className="bg-[#00A8E8]/5 border border-[#00A8E8]/20 rounded-xl p-3 flex items-center gap-2 text-xs text-[#1A1B23]">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" />
                </svg>
                Saving timing data to <strong className="text-[#00A8E8] ml-1">"{currentSetupName}"</strong>
                {currentSetupType && (
                  <span className="text-[#6B7280]">· {currentSetupType === 'base' ? 'Hot Laps' : currentSetupType === 'heat' ? 'Heat' : 'Main'}</span>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                Save your setup first — timing data is stored on the setup record.
              </div>
            )}

            {/* The ONLY five fields the user cares about, per spec.
                Each gets its own colored card for visual differentiation. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorTextField
                id={`${prefix}-best`}
                label="Fastest Lap Time"
                value={scan.best_lap_time || ''}
                onChange={(v) => updateScan({ best_lap_time: v || null })}
                placeholder="e.g. 14.523"
                color="green"
                icon="zap"
              />
              <ColorTextField
                id={`${prefix}-bestlap`}
                label="Fastest Lap On Lap #"
                type="number"
                value={scan.fastest_lap_on_lap?.toString() || ''}
                onChange={(v) => updateScan({ fastest_lap_on_lap: v ? parseInt(v, 10) : null })}
                placeholder="e.g. 7"
                color="emerald"
                icon="hash"
              />
              <ColorTextField
                id={`${prefix}-slow`}
                label="Slowest Lap Time"
                value={scan.slowest_lap_time || ''}
                onChange={(v) => updateScan({ slowest_lap_time: v || null })}
                placeholder="e.g. 16.102"
                color="red"
                icon="turtle"
              />
              <ColorTextField
                id={`${prefix}-avg`}
                label="Average Lap Time"
                value={scan.average_lap_time || ''}
                onChange={(v) => updateScan({ average_lap_time: v || null })}
                placeholder="e.g. 14.812"
                color="blue"
                icon="activity"
              />
              <ColorTextField
                id={`${prefix}-posdelta`}
                label="Positions Gained / Lost"
                type="number"
                value={scan.positions_gained_lost?.toString() || ''}
                onChange={(v) => updateScan({ positions_gained_lost: v ? parseInt(v, 10) : null })}
                placeholder="+ gained, − lost"
                color="purple"
                icon="trending"
              />
            </div>

            {/* Lap-by-lap dropdown — lets user verify the AI read each lap correctly. */}
            {scan.lap_times.length > 0 && (
              <LapTimesDropdown laps={scan.lap_times} />
            )}



            <div className="flex items-center justify-end gap-2 flex-wrap pt-2">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSession}
                disabled={isSavingStep}
                className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
              >
                {isSavingStep ? (
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
                <div className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5">Source image (compressed)</div>
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
      <input
        ref={uploadInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="sr-only"
        onInput={onFileInput}
        onChange={onFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        className="sr-only"
        onInput={onFileInput}
        onChange={onFileChange}
      />
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
        <DiagnosticBanner
          kind="error"
          title={error}
          detail={errorDetail}
          stage={errorStage}
          rawResponse={rawResponse}
          showDebug={showDebug}
          onToggleDebug={() => setShowDebug(v => !v)}
        />
      )}

      {renderBatchImages()}

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
            <p className="text-[11px] font-medium text-[#6B7280]" role="status" aria-live="polite">
              {uploadStatus}
            </p>
            <p className="text-[10px] text-[#9CA3AF]">
              Times out after {FRONTEND_TIMEOUT_MS / 1000}s if the AI doesn't respond
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
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={openUploadPicker}
                className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
              >
                Upload Screenshot{batchImages.length > 0 ? 's' : ''}
              </button>
              <button
                type="button"
                onClick={openCameraPicker}
                className="bg-white hover:bg-[#F5F5F7] text-[#6B7280] border border-[#E5E7EB] px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
              >
                Take Photo
              </button>
              {SHOW_TEST_MODE_BUTTON && (
                <button
                  type="button"
                  onClick={runTestMode}
                  className="bg-white hover:bg-[#F5F5F7] text-[#6B7280] border border-[#E5E7EB] px-4 py-2 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
                  title="Bypass OpenAI and load canned test data — useful for debugging the review screen"
                >
                  Run Test Mode (debug)
                </button>
              )}

            </div>
            <div className="mt-3 text-center" role="status" aria-live="polite">
              <p className="text-[11px] font-medium text-[#6B7280]">{uploadStatus}</p>
              {selectedFileInfo && (
                <p className="text-[10px] text-[#9CA3AF] break-all mt-1">{selectedFileInfo}</p>
              )}
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-3">
              PNG / JPG / WEBP / HEIC. Auto-compressed to {MAX_IMAGE_WIDTH}px wide JPEG before upload when possible.
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


// ---------- Color-coded text field (for the 5 review stats) ----------
const COLOR_PALETTES: Record<string, { bg: string; border: string; ring: string; label: string; icon: string }> = {
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    ring: 'focus:ring-green-400 focus:border-green-400',
    label: 'text-green-800',
    icon: 'text-green-600',
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    ring: 'focus:ring-emerald-400 focus:border-emerald-400',
    label: 'text-emerald-800',
    icon: 'text-emerald-600',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    ring: 'focus:ring-red-400 focus:border-red-400',
    label: 'text-red-800',
    icon: 'text-red-600',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    ring: 'focus:ring-blue-400 focus:border-blue-400',
    label: 'text-blue-800',
    icon: 'text-blue-600',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    ring: 'focus:ring-purple-400 focus:border-purple-400',
    label: 'text-purple-800',
    icon: 'text-purple-600',
  },
};

const FieldIcon: React.FC<{ icon: string; className?: string }> = ({ icon, className }) => {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  };
  switch (icon) {
    case 'zap':
      return <svg {...common}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
    case 'hash':
      return <svg {...common}><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>;
    case 'turtle':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><polyline points="12 6 12 12 16 14" /></svg>;
    case 'activity':
      return <svg {...common}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
    case 'trending':
      return <svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
    default:
      return null;
  }
};

const ColorTextField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  color: keyof typeof COLOR_PALETTES;
  icon?: string;
}> = ({ id, label, value, onChange, type = 'text', placeholder, color, icon }) => {
  const isMissing = value.trim() === '';
  const p = COLOR_PALETTES[color] || COLOR_PALETTES.blue;
  return (
    <div className={`${p.bg} border ${p.border} rounded-xl p-3 transition-all`}>
      <label htmlFor={id} className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1.5 ${p.label}`}>
        {icon && <FieldIcon icon={icon} className={p.icon} />}
        {label}
        {isMissing && <span className="ml-1 text-amber-700 normal-case font-medium tracking-normal">(empty)</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border ${isMissing ? 'border-amber-300' : 'border-white'} bg-white rounded-lg text-sm font-semibold text-[#1A1B23] outline-none transition-all focus:ring-2 ${p.ring}`}
      />
    </div>
  );
};

// ---------- Collapsible lap-times dropdown ----------
const LapTimesDropdown: React.FC<{ laps: LapRow[] }> = ({ laps }) => {
  const [open, setOpen] = useState(false);

  // Find fastest/slowest seconds for highlighting
  const numericLaps = laps
    .map((l, i) => ({ idx: i, n: typeof l.seconds === 'number' ? l.seconds : parseFloat(l.time) }))
    .filter(x => !isNaN(x.n) && isFinite(x.n));
  const fastestIdx = numericLaps.length ? numericLaps.reduce((a, b) => (a.n < b.n ? a : b)).idx : -1;
  const slowestIdx = numericLaps.length ? numericLaps.reduce((a, b) => (a.n > b.n ? a : b)).idx : -1;

  return (
    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#F0F0F2] transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[#1A1B23]">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A8E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Lap-by-lap times
          <span className="text-[10px] font-semibold bg-[#00A8E8]/10 text-[#00A8E8] px-2 py-0.5 rounded-full border border-[#00A8E8]/20">
            {laps.length} lap{laps.length === 1 ? '' : 's'}
          </span>
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6B7280"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[#E5E7EB] max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-white sticky top-0">
              <tr className="text-[10px] uppercase tracking-wider text-[#6B7280]">
                <th className="text-left px-4 py-2 font-semibold w-20">Lap</th>
                <th className="text-left px-4 py-2 font-semibold">Time</th>
                <th className="text-right px-4 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {laps.map((l, i) => {
                const isFast = i === fastestIdx;
                const isSlow = i === slowestIdx && fastestIdx !== slowestIdx;
                return (
                  <tr
                    key={`${l.lap}-${i}`}
                    className={`border-t border-[#E5E7EB] ${isFast ? 'bg-green-50' : isSlow ? 'bg-red-50' : 'bg-white'}`}
                  >
                    <td className="px-4 py-1.5 font-mono font-semibold text-[#1A1B23]">{l.lap}</td>
                    <td className="px-4 py-1.5 font-mono text-[#1A1B23]">{l.time || '—'}</td>
                    <td className="px-4 py-1.5 text-right">
                      {isFast && <span className="text-[10px] font-bold text-green-700 uppercase">Fastest</span>}
                      {isSlow && <span className="text-[10px] font-bold text-red-700 uppercase">Slowest</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};



// ---------- Diagnostic banner with collapsible debug payload ----------
const DiagnosticBanner: React.FC<{
  kind: 'error' | 'warning';
  title: string;
  detail?: string | null;
  stage?: string | null;
  rawResponse?: any;
  showDebug: boolean;
  onToggleDebug: () => void;
}> = ({ kind, title, detail, stage, rawResponse, showDebug, onToggleDebug }) => {
  const palette = kind === 'error'
    ? { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', accent: 'text-red-600' }
    : { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', accent: 'text-amber-700' };

  return (
    <div className={`mb-4 ${palette.bg} border ${palette.border} ${palette.text} rounded-lg px-3 py-2.5 text-xs`} role="alert">
      <div className="flex items-start gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="font-semibold leading-snug break-words">{title}</div>
          {stage && (
            <div className={`text-[10px] uppercase tracking-wider font-bold mt-0.5 ${palette.accent}`}>
              Stage: {stage}
            </div>
          )}
          {detail && (
            <div className="mt-1 text-[11px] opacity-90 whitespace-pre-wrap break-words">
              {detail}
            </div>
          )}
          {rawResponse !== undefined && rawResponse !== null && (
            <button
              type="button"
              onClick={onToggleDebug}
              className="mt-1.5 text-[10px] font-semibold underline hover:no-underline focus:outline-none"
            >
              {showDebug ? 'Hide raw response' : 'Show raw response'}
            </button>
          )}
          {showDebug && rawResponse !== undefined && rawResponse !== null && (
            <pre className="mt-2 bg-white/60 border border-current/20 rounded p-2 text-[10px] leading-snug max-h-48 overflow-auto font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanTimingScreen;
