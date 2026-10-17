// Public purchases remain disabled until both native wrappers are approved.
export const NATIVE_PURCHASES_READY = false;
export class NativePurchaseError extends Error {
  cancelled: boolean;
  pending: boolean;
  constructor(message: string, cancelled = false, pending = false) { super(message); this.cancelled = cancelled; this.pending = pending; }
}
