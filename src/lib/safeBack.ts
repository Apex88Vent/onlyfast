import type { NavigateFunction } from 'react-router-dom';
import { isNativeApp } from './paymentVisibility';

export const SAFE_BACK_DASHBOARD_EVENT = 'onlyfast-safe-navigate';

const HOME_PATH = '/';
const HOME_VIEW = 'home';
const MAX_STACK_LENGTH = 50;
const GUARD_STATE_KEY = '__onlyfastBackGuard';

interface SafeBackTarget {
  path: string;
  dashboardView?: string;
}

let internalStack: SafeBackTarget[] = [];
let currentPath = HOME_PATH;
let currentDashboardView = HOME_VIEW;
let dashboardPath = HOME_PATH;
let pendingDashboardView: string | null = null;
let isApplyingSafeBack = false;

const normalizePath = (path: string) => path || HOME_PATH;
const isDashboardPath = (path: string) => ['/', '/app'].includes(path.split(/[?#]/)[0]);

const targetKey = (target: SafeBackTarget) =>
  `${normalizePath(target.path)}::${target.dashboardView || ''}`;

const targetsMatch = (a: SafeBackTarget, b: SafeBackTarget) => targetKey(a) === targetKey(b);

const currentTarget = (): SafeBackTarget => ({
  path: currentPath,
  dashboardView: isDashboardPath(currentPath) ? currentDashboardView : undefined,
});

const homeTarget = (): SafeBackTarget => ({
  path: dashboardPath,
  dashboardView: HOME_VIEW,
});

const isHomeTarget = (target: SafeBackTarget) =>
  isDashboardPath(normalizePath(target.path)) && (!target.dashboardView || target.dashboardView === HOME_VIEW);

const dispatchDashboardView = (view: string) => {
  window.dispatchEvent(new CustomEvent(SAFE_BACK_DASHBOARD_EVENT, { detail: { view } }));
};

export const armSafeBackGuard = () => {
  if (!isNativeApp) return;
  try {
    const state = window.history.state || {};
    if (state[GUARD_STATE_KEY]) return;
    window.history.replaceState({ ...state, [GUARD_STATE_KEY]: false }, '', window.location.href);
    window.history.pushState({ ...state, [GUARD_STATE_KEY]: true }, '', window.location.href);
  } catch {
    // History can be restricted in some embedded browsers. Safe in-app buttons still work.
  }
};

export const recordSafeBackRoute = (path: string) => {
  currentPath = normalizePath(path);
  if (isDashboardPath(currentPath)) dashboardPath = currentPath;
  const target: SafeBackTarget = isDashboardPath(currentPath)
    ? { path: currentPath, dashboardView: currentDashboardView }
    : { path: currentPath };
  recordSafeBackTarget(target);
};

export const recordSafeBackDashboardView = (view: string) => {
  currentDashboardView = view || HOME_VIEW;
  if (!isDashboardPath(currentPath)) return;
  recordSafeBackTarget({ path: currentPath, dashboardView: currentDashboardView });
};

export const consumePendingSafeBackDashboardView = () => {
  const view = pendingDashboardView;
  pendingDashboardView = null;
  return view;
};

export const recordSafeBackTarget = (target: SafeBackTarget) => {
  if (isApplyingSafeBack) return;

  const normalized: SafeBackTarget = {
    path: normalizePath(target.path),
    dashboardView: isDashboardPath(target.path) ? (target.dashboardView || HOME_VIEW) : undefined,
  };
  const last = internalStack[internalStack.length - 1];
  if (last && targetsMatch(last, normalized)) return;

  internalStack.push(normalized);
  if (internalStack.length > MAX_STACK_LENGTH) {
    internalStack = internalStack.slice(-MAX_STACK_LENGTH);
  }
};

export const safeBack = (navigate: NavigateFunction) => {
  const current = currentTarget();

  if (isHomeTarget(current)) {
    armSafeBackGuard();
    return;
  }

  while (internalStack.length && targetsMatch(internalStack[internalStack.length - 1], current)) {
    internalStack.pop();
  }

  let previous = internalStack.pop();
  while (previous && targetsMatch(previous, current)) {
    previous = internalStack.pop();
  }

  const target = previous || (!isHomeTarget(current) ? homeTarget() : null);
  if (!target) return;

  isApplyingSafeBack = true;
  currentPath = normalizePath(target.path);
  if (target.dashboardView) {
    currentDashboardView = target.dashboardView;
    pendingDashboardView = target.dashboardView;
  }

  if (current.path !== target.path) {
    navigate(target.path, { replace: true });
  }

  if (target.dashboardView) {
    window.setTimeout(() => dispatchDashboardView(target.dashboardView as string), 0);
  }

  window.setTimeout(() => {
    isApplyingSafeBack = false;
    armSafeBackGuard();
  }, 0);
};
