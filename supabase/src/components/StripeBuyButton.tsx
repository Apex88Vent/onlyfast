import React, { useEffect, useRef } from 'react';
import { STRIPE_BUY_BUTTONS, STRIPE_PUBLISHABLE_KEY } from '@/lib/membership';

interface StripeBuyButtonProps {
  plan: 'pro' | 'teams';
  /** Logged-in Supabase user id, passed to Stripe as client-reference-id */
  clientReferenceId?: string | null;
}

const SCRIPT_SRC = 'https://js.stripe.com/v3/buy-button.js';

/**
 * Loads the Stripe Buy Button script exactly once (globally), then renders the
 * <stripe-buy-button> custom element. Attributes are set imperatively on the DOM
 * node so React doesn't complain about unknown attributes on a custom element,
 * while producing the exact same rendered HTML Stripe expects.
 */
const StripeBuyButton: React.FC<StripeBuyButtonProps> = ({ plan, clientReferenceId }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure the Stripe Buy Button script is loaded only once for the whole app.
  useEffect(() => {
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // (Re)create the custom element whenever the plan or user id changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';
    const el = document.createElement('stripe-buy-button');
    el.setAttribute('buy-button-id', STRIPE_BUY_BUTTONS[plan]);
    el.setAttribute('publishable-key', STRIPE_PUBLISHABLE_KEY);
    if (clientReferenceId) {
      el.setAttribute('client-reference-id', clientReferenceId);
    }
    container.appendChild(el);

    return () => {
      container.innerHTML = '';
    };
  }, [plan, clientReferenceId]);

  return <div ref={containerRef} className="w-full flex justify-center" />;
};

export default StripeBuyButton;
