const FILE_PICKER_ACTIVE_KEY = 'onlyfast_file_picker_active';
const FILE_PICKER_STARTED_AT_KEY = 'onlyfast_file_picker_started_at';
const FILE_PICKER_ACTIVE_MS = 2 * 60 * 1000;

type FilePickerWindow = Window & {
  __onlyfastFilePickerOpen?: boolean;
  __onlyfastFilePickerStartedAt?: number | null;
};

const filePickerWindow = () => window as FilePickerWindow;

const clearStoredPickerState = () => {
  try {
    localStorage.removeItem(FILE_PICKER_ACTIVE_KEY);
    localStorage.removeItem(FILE_PICKER_STARTED_AT_KEY);
  } catch {/* Storage can be unavailable in restricted WebViews. */}

  try {
    filePickerWindow().__onlyfastFilePickerOpen = false;
    filePickerWindow().__onlyfastFilePickerStartedAt = null;
  } catch {/* Window globals can be unavailable during startup. */}
};

export const setOnlyFastFilePickerActive = (active: boolean): void => {
  if (!active) {
    clearStoredPickerState();
    return;
  }

  const startedAt = Date.now();
  try {
    filePickerWindow().__onlyfastFilePickerOpen = true;
    filePickerWindow().__onlyfastFilePickerStartedAt = startedAt;
  } catch {/* Ignore WebView globals that cannot be written. */}

  try {
    localStorage.setItem(FILE_PICKER_ACTIVE_KEY, 'true');
    localStorage.setItem(FILE_PICKER_STARTED_AT_KEY, String(startedAt));
  } catch {/* Ignore storage failures in restricted WebViews. */}
};

export const isOnlyFastFilePickerOpen = (): boolean => {
  try {
    const globalActive = Boolean(filePickerWindow().__onlyfastFilePickerOpen);
    const storedActive = localStorage.getItem(FILE_PICKER_ACTIVE_KEY) === 'true';
    const startedAtRaw =
      localStorage.getItem(FILE_PICKER_STARTED_AT_KEY) ||
      String(filePickerWindow().__onlyfastFilePickerStartedAt || '');
    const startedAt = Number(startedAtRaw);

    if (!globalActive && !storedActive) return false;
    if (!Number.isFinite(startedAt) || Date.now() - startedAt >= FILE_PICKER_ACTIVE_MS) {
      clearStoredPickerState();
      return false;
    }

    return true;
  } catch {
    return false;
  }
};
