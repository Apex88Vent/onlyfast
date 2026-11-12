import React, { useState } from 'react';
import { checkSavePermission, getSetupPermissions } from '@/lib/membership';
import { PLANS_2027, SUBSCRIPTION_2027, type Tier2027 } from '@/lib/subscription2027Catalog';
import MembershipPlanCard from '@/components/MembershipPlanCard';
import '@/components/membership-plans.css';

/** A permission inspector, never a subscription assignment or purchase flow. */
export default function Phase2027Preview() {
  const [inspected, setInspected] = useState<Tier2027>('sportsman');
  const [age, setAge] = useState(49);
  const [baseCount, setBaseCount] = useState(2);
  const [regularCount, setRegularCount] = useState(5);
  const [car, setCar] = useState('Dwarf Cars');
  const limits = SUBSCRIPTION_2027[inspected].limits;
  const permissions = getSetupPermissions(inspected, new Date(Date.now() - age * 3600000).toISOString());
  const context = { tier: inspected, activeCarType: 'Dwarf Cars', isExistingSave: false,
    existingRaceWeekendCount: regularCount, existingBaseSetupCount: baseCount,
    existingCarTypes: ['Dwarf Cars'], newCarType: car };
  const base = checkSavePermission({ ...context, kind: 'base_template' });
  const regular = checkSavePermission({ ...context, kind: 'race_weekend' });
  return <main className="membership-page min-h-screen text-[#0f172a]">
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="membership-brand"><img src="/onlyfast-logo.png" alt="OnlyFast" width="1250" height="455" /><p>Race Smarter. Finish Faster.</p></div>
      <header className="space-y-2 text-center">
        <p className="font-semibold text-[#075b7a]">ONLYFAST 2027 · DEVELOPMENT PREVIEW</p>
        <h1 className="text-2xl font-bold">Choose your next season</h1>
        <p>All three plans are ad-free. Existing memberships and billing keep their current access.</p>
        <p role="status" className="rounded-xl border border-[#d5dbe4] bg-white p-4 text-sm">
          Preview only. Purchases, sign-in and account changes are disabled while an isolated test backend is prepared.
          Inspecting a plan below does not activate a subscription or grant access.
        </p>
      </header>
      <section className="membership-plans" aria-label="2027 subscription plans">
        {PLANS_2027.map(plan => <MembershipPlanCard key={plan.tier} plan={plan}>
          <button data-plan-action aria-pressed={inspected === plan.tier}
            onClick={() => setInspected(plan.tier as Tier2027)}>Inspect {plan.displayName} permissions</button>
        </MembershipPlanCard>)}
      </section>
      <section className="rounded-2xl border-2 border-[#d5dbe4] bg-white p-4 space-y-4" aria-label="Sample permission inspector">
        <h2 className="text-xl font-bold">{PLANS_2027.find(plan => plan.tier === inspected)?.displayName} · sample permission inspector</h2>
        <p className="text-sm text-[#475569]">These are disposable examples. No account is selected and nothing is saved. OnlyLaps and telemetry are future permissions; integration is not installed.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1">Saved base setups<input aria-label="Saved base setups" type="number" min="0" max="100" value={baseCount} onChange={e => setBaseCount(Math.max(0, Number(e.target.value)))} className="rounded border p-2 w-full" /></label>
          <label className="grid gap-1">Total regular setups<input aria-label="Total regular setups" type="number" min="0" max="100" value={regularCount} onChange={e => setRegularCount(Math.max(0, Number(e.target.value)))} className="rounded border p-2 w-full" /></label>
          <label className="grid gap-1">Setup age in hours<input aria-label="Setup age in hours" type="number" min="0" value={age} onChange={e => setAge(Math.max(0, Number(e.target.value)))} className="rounded border p-2 w-full" /></label>
          <label className="grid gap-1">Class to save<select aria-label="Class to save" value={car} onChange={e => setCar(e.target.value)} className="rounded border p-2 w-full"><option>Dwarf Cars</option><option>Modified</option></select></label>
        </div>
        <ul aria-live="polite" className="space-y-2 text-sm">
          <li>New base setup: {base.allowed ? 'Allowed' : 'Blocked — ' + base.reason.replace(/_/g, ' ')}</li>
          <li>New regular setup: {regular.allowed ? 'Allowed' : 'Blocked — ' + regular.reason.replace(/_/g, ' ')}</li>
          <li>Editing existing regular setup: {permissions.canEdit ? 'Allowed' : 'Read-only after 48 hours'}</li>
          <li>Viewing existing regular setup: Always available within your selected class.</li>
          <li>OnlyLaps / telemetry: {limits.onlyLapsEnabled ? 'Included when integration launches' : 'Not included'}</li>
          <li>Advertisements: None.</li>
        </ul>
        <fieldset className="rounded-xl border p-4 space-y-2" aria-label="Sample saved setup">
          <legend className="px-2 font-semibold">Sample saved setup · {permissions.locked ? 'Read-only' : 'Editable example'}</legend>
          <p>Class: Dwarf Cars · Track: Example Speedway</p>
          <p>RF spring: 250 lb/in · Cross weight: 50% · Gear ratio: 4.11</p>
          <label className="block">Notes<textarea key={inspected + String(permissions.locked)} readOnly={!permissions.canEdit} defaultValue="Good turn-in; retain these notes after the editing window." className="block mt-1 w-full rounded border p-2" /></label>
          <p>Session results: Heat 2nd · Main 3rd · Fastest lap 15.482s</p>
          <p className="text-sm">Locked setups stay in the total allowance. No automatic deletion or slot recycling is introduced.</p>
        </fieldset>
      </section>
      <footer className="text-center text-sm text-[#475569] space-y-2">
        <p>Prices shown in USD for the proposed 2027 plans. No new products are available to purchase in this preview.</p>
        <p>Legacy Rookie, Pro and Team access is preserved. Account-based tier switching awaits a separately isolated testing database.</p>
      </footer>
    </div>
  </main>;
}
