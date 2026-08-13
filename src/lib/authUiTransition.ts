export interface AuthUiTransitionInput {
  previousUserId: string | null;
  nextUserId: string | null;
  event: string;
  onboardingLoginEscape: boolean;
}

export interface AuthUiTransitionDecision {
  event: string;
  nextUserId: string | null;
  identityChanged: boolean;
  shouldRecheckOnboarding: boolean;
  shouldMarkOnboardingChecked: boolean;
  preservesMountedApp: boolean;
}

/**
 * Decide whether an auth notification represents a real identity transition.
 * Supabase may emit SIGNED_IN or TOKEN_REFRESHED again when a mobile WebView
 * resumes. Those same-user notifications must not reset the app entry gate,
 * because doing so unmounts the active dashboard screen and its file input.
 */
export const resolveAuthUiTransition = ({
  previousUserId,
  nextUserId,
  event,
  onboardingLoginEscape,
}: AuthUiTransitionInput): AuthUiTransitionDecision => {
  const identityChanged = previousUserId !== nextUserId;
  const shouldMarkOnboardingChecked = onboardingLoginEscape;
  const shouldRecheckOnboarding = identityChanged && !shouldMarkOnboardingChecked;

  return {
    event,
    nextUserId,
    identityChanged,
    shouldRecheckOnboarding,
    shouldMarkOnboardingChecked,
    preservesMountedApp: !shouldRecheckOnboarding && !shouldMarkOnboardingChecked,
  };
};
