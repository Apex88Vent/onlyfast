import React from 'react';
import { Check } from 'lucide-react';
import type { PlanMeta } from '@/lib/membership';

/** Presentation only. Each existing entry point supplies its own action. */
export default function MembershipPlanCard({ plan, children, onClick }: {
  plan: PlanMeta;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
}) {
  return <article className={`membership-card membership-card--${plan.tier}`} data-plan={plan.tier} onClick={onClick} aria-label={`${plan.displayName} plan`}>
    <div className="membership-card__heading">
      <div className="membership-card__title">
        <h3>{plan.displayName}</h3>
        {plan.badge && <span className="membership-card__badge">{plan.badge}</span>}
      </div>
      <p className="membership-card__price">
        {plan.tier === 'rookie' ? 'FREE' : plan.priceDisplay.split('/')[0]}
        {plan.tier !== 'rookie' && <span>/month</span>}
      </p>
    </div>
    <p className="membership-card__description">{plan.description}</p>
    <ul className="membership-card__features">
      {plan.synopsis.map(line => <li key={line}><Check size={20} strokeWidth={3} aria-hidden="true" /><span>{line}</span></li>)}
    </ul>
    <div className="membership-card__footer">
      <div className="membership-card__support membership-card__support--before">{plan.tier !== 'rookie' && plan.supportingText ? <p>{plan.supportingText}</p> : null}</div>
      {children}
      <div className="membership-card__support membership-card__support--after">{plan.tier === 'rookie' && plan.supportingText ? <p>{plan.supportingText}</p> : null}</div>
    </div>
  </article>;
}
