import React from 'react';
import { Link } from 'react-router-dom';

// Embedded only where an existing feature/limit notice is already displayed.
export default function LockedFeatureNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div className="space-y-2 text-sm text-[#4B5563]" role="status">
    <p>{message}</p>
    <div className="flex flex-wrap gap-4">
      <Link to="/pricing" className="font-semibold text-[#00A8E8] underline">View Plans</Link>
      <button onClick={onDismiss} className="text-[#6B7280] underline">Not Now</button>
    </div>
  </div>;
}
