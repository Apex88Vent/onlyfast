import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  linkOnlyLapsSession,
  loadOnlyLapsSessionCandidates,
  type OnlyLapsSessionCandidate,
  type OnlyLapsSessionPickerResult,
  unlinkOnlyLapsSession,
} from '@/lib/onlylapsSessionLink';
import { notifyOnlyLapsSessionLinkChanged } from '@/lib/onlylapsSessionScope';

interface OnlyLapsSessionLinkCardProps {
  onlyfastSessionId: string;
}

const PAGE_SIZE = 25;

function localTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function localDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function candidateName(candidate: OnlyLapsSessionCandidate): string {
  if (candidate.custom_name?.trim()) return candidate.custom_name.trim();
  const time = localTime(candidate.started_at);
  return time ? `Session — ${time}` : 'Timing Session';
}

function lapTime(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return (value / 1000).toFixed(3);
}

function CandidateDetails({
  candidate,
  compact = false,
}: {
  candidate: OnlyLapsSessionCandidate;
  compact?: boolean;
}) {
  const fastest = lapTime(candidate.fastest_valid_lap_ms);
  const date = localDate(candidate.started_at);
  const time = localTime(candidate.started_at);
  return (
    <div className="min-w-0">
      <div className="font-semibold text-[#1A1B23] truncate">
        {candidateName(candidate)}
      </div>
      {candidate.track_name && (
        <div className="text-xs text-[#6B7280] truncate">
          {candidate.track_name}
        </div>
      )}
      <div className="text-xs text-[#6B7280] mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
        {!compact && date && <span>{date}</span>}
        {time && <span>{time}</span>}
        <span>
          {candidate.lap_count} lap
          {candidate.lap_count === 1 ? '' : 's'}
        </span>
        {fastest && <span>Fastest {fastest}</span>}
      </div>
    </div>
  );
}

const OnlyLapsSessionLinkCard: React.FC<
  OnlyLapsSessionLinkCardProps
> = ({ onlyfastSessionId }) => {
  const [result, setResult] =
    useState<OnlyLapsSessionPickerResult | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(onlyfastSessionId);
  const requestVersionRef = useRef(0);

  const load = useCallback(
    async (
      scope: 'suggested' | 'all' = 'suggested',
      offset = 0,
      append = false,
    ) => {
      const requestedSessionId = onlyfastSessionId;
      const requestVersion = ++requestVersionRef.current;
      setLoading(true);
      setError(null);
      try {
        const next = await loadOnlyLapsSessionCandidates(
          requestedSessionId,
          scope,
          offset,
        );
        if (
          activeSessionIdRef.current !== requestedSessionId ||
          requestVersionRef.current !== requestVersion
        ) {
          return;
        }
        if (next.onlyfast_session_id !== requestedSessionId) {
          setResult(null);
          setError('OnlyLaps returned data for a different saved session.');
          return;
        }
        setResult((previous) => {
          if (!append || !previous) return next;
          const merged = new Map(
            [...previous.candidates, ...next.candidates].map(
              (candidate) => [
                candidate.onlylaps_session_id,
                candidate,
              ],
            ),
          );
          return { ...next, candidates: [...merged.values()] };
        });
      } catch (loadError) {
        if (
          activeSessionIdRef.current !== requestedSessionId ||
          requestVersionRef.current !== requestVersion
        ) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'OnlyLaps sessions could not be loaded.',
        );
      } finally {
        if (
          activeSessionIdRef.current === requestedSessionId &&
          requestVersionRef.current === requestVersion
        ) {
          setLoading(false);
        }
      }
    },
    [onlyfastSessionId],
  );

  useEffect(() => {
    activeSessionIdRef.current = onlyfastSessionId;
    requestVersionRef.current += 1;
    setResult(null);
    setPickerOpen(false);
    setBusyId(null);
    setLoading(true);
    setError(null);
    void load('suggested');
    return () => {
      if (activeSessionIdRef.current === onlyfastSessionId) {
        activeSessionIdRef.current = null;
      }
      requestVersionRef.current += 1;
    };
  }, [load, onlyfastSessionId]);

  const suggestion = useMemo(
    () =>
      result?.candidates.find(
        (candidate) =>
          candidate.onlylaps_session_id ===
          result.suggested_candidate_id,
      ) || null,
    [result],
  );

  const handleLink = async (
    candidate: OnlyLapsSessionCandidate,
    source: 'picker' | 'suggestion',
  ) => {
    const requestedSessionId = onlyfastSessionId;
    setBusyId(candidate.onlylaps_session_id);
    setError(null);
    try {
      await linkOnlyLapsSession(
        requestedSessionId,
        candidate,
        source,
      );
      if (activeSessionIdRef.current !== requestedSessionId) return;
      notifyOnlyLapsSessionLinkChanged(requestedSessionId);
      setPickerOpen(false);
      await load('suggested');
    } catch (linkError) {
      if (activeSessionIdRef.current !== requestedSessionId) return;
      setError(
        linkError instanceof Error
          ? linkError.message
          : 'The session could not be linked.',
      );
    } finally {
      if (activeSessionIdRef.current === requestedSessionId) {
        setBusyId(null);
      }
    }
  };

  const handleUnlink = async () => {
    const confirmed = window.confirm(
      'Unlink this OnlyLaps session? No session, lap, telemetry, analysis, or share data will be deleted.',
    );
    if (!confirmed) return;
    const requestedSessionId = onlyfastSessionId;
    setBusyId('unlink');
    setError(null);
    try {
      await unlinkOnlyLapsSession(requestedSessionId);
      if (activeSessionIdRef.current !== requestedSessionId) return;
      notifyOnlyLapsSessionLinkChanged(requestedSessionId);
      await load('suggested');
    } catch (unlinkError) {
      if (activeSessionIdRef.current !== requestedSessionId) return;
      setError(
        unlinkError instanceof Error
          ? unlinkError.message
          : 'The session could not be unlinked.',
      );
    } finally {
      if (activeSessionIdRef.current === requestedSessionId) {
        setBusyId(null);
      }
    }
  };

  const openPicker = () => {
    setPickerOpen(true);
    if (!result) void load('suggested');
  };

  return (
    <>
      <section
        className="bg-white rounded-xl border border-[#00A8E8]/20 px-4 py-3 shadow-sm"
        aria-label="OnlyLaps telemetry"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-wide text-[#00A8E8] uppercase">
              OnlyLaps Telemetry
            </div>
            {loading && !result ? (
              <div className="text-sm text-[#6B7280] mt-1">
                Checking OnlyLaps sessions…
              </div>
            ) : result?.current_session ? (
              <div className="mt-1">
                <CandidateDetails
                  candidate={result.current_session}
                  compact
                />
                <span className="inline-flex mt-1.5 text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                  Linked
                </span>
              </div>
            ) : suggestion ? (
              <div className="mt-1">
                <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">
                  Suggested OnlyLaps Session
                </div>
                <CandidateDetails candidate={suggestion} compact />
              </div>
            ) : (
              <div className="text-sm text-[#6B7280] mt-1">
                Not linked
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {result?.current_session ? (
              <>
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={Boolean(busyId)}
                  className="text-xs font-semibold text-[#00A8E8] hover:bg-[#00A8E8]/10 border border-[#00A8E8]/30 rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={Boolean(busyId)}
                  className="text-xs font-semibold text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded-lg px-2 py-1.5 disabled:opacity-50"
                >
                  {busyId === 'unlink' ? 'Unlinking…' : 'Unlink'}
                </button>
              </>
            ) : suggestion ? (
              <div className="flex flex-col sm:flex-row gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleLink(suggestion, 'suggestion')}
                  disabled={Boolean(busyId)}
                  className="text-xs font-semibold text-white bg-[#00A8E8] hover:bg-[#0090c7] rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  {busyId === suggestion.onlylaps_session_id
                    ? 'Linking…'
                    : 'Link Session'}
                </button>
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={Boolean(busyId)}
                  className="text-xs font-semibold text-[#6B7280] hover:text-[#00A8E8] rounded-lg px-2 py-1.5 disabled:opacity-50"
                >
                  Choose Different
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openPicker}
                disabled={loading}
                className="text-xs font-semibold text-white bg-[#00A8E8] hover:bg-[#0090c7] rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Select Session
              </button>
            )}
          </div>
        </div>
        {result?.ambiguous && !result.current_session && (
          <p className="text-xs text-[#6B7280] mt-2">
            Several nearby sessions may match. Choose the correct one.
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600 mt-2" role="alert">
            {error}
          </p>
        )}
      </section>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select OnlyLaps Session</DialogTitle>
            <DialogDescription>
              Choose one of your timing sessions. Session names are for
              display; the saved link uses permanent session IDs.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto -mx-1 px-1 space-y-2">
            {loading && !result ? (
              <div className="py-8 text-center text-sm text-[#6B7280]">
                Loading sessions…
              </div>
            ) : result?.candidates.length ? (
              result.candidates.map((candidate) => {
                const isCurrent = candidate.linked_to_current_session;
                const disabled =
                  candidate.linked_elsewhere ||
                  isCurrent ||
                  Boolean(busyId);
                return (
                  <button
                    key={candidate.onlylaps_session_id}
                    type="button"
                    onClick={() => void handleLink(candidate, 'picker')}
                    disabled={disabled}
                    className="w-full text-left border border-[#E5E7EB] rounded-xl px-4 py-3 hover:border-[#00A8E8]/50 hover:bg-[#00A8E8]/5 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <CandidateDetails candidate={candidate} />
                      <div className="flex-shrink-0">
                        {isCurrent ? (
                          <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">
                            Currently linked
                          </span>
                        ) : candidate.linked_elsewhere ? (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
                            Linked elsewhere
                          </span>
                        ) : busyId === candidate.onlylaps_session_id ? (
                          <span className="text-xs text-[#00A8E8]">
                            Linking…
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-8 text-center">
                <div className="text-sm font-semibold text-[#1A1B23]">
                  No nearby OnlyLaps sessions found
                </div>
                <div className="text-xs text-[#6B7280] mt-1">
                  View your other sessions to choose manually.
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="border-t border-[#E5E7EB] pt-3 flex items-center justify-between gap-3">
            {result?.scope === 'all' ? (
              result.has_more ? (
                <button
                  type="button"
                  onClick={() =>
                    void load(
                      'all',
                      result.offset + PAGE_SIZE,
                      true,
                    )
                  }
                  disabled={loading}
                  className="text-xs font-semibold text-[#00A8E8] hover:underline disabled:opacity-50"
                >
                  {loading ? 'Loading…' : 'Load more sessions'}
                </button>
              ) : (
                <span className="text-xs text-[#9CA3AF]">
                  All owned sessions shown
                </span>
              )
            ) : (
              <button
                type="button"
                onClick={() => void load('all', 0)}
                disabled={loading}
                className="text-xs font-semibold text-[#00A8E8] hover:underline disabled:opacity-50"
              >
                View other sessions
              </button>
            )}
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="text-xs font-semibold text-[#6B7280] hover:text-[#1A1B23] px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OnlyLapsSessionLinkCard;
