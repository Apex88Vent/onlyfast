// Ported from OnlyLaps 22f372508582fb43d56b66947c26740233bcdb19; circuit branches only.
import { useEffect, useState } from "react";
import Link from "./TraceLink";
import { CalendarClock, ChevronRight, Loader2, Timer } from "lucide-react";
import { LapSessionShell } from "./LapSessionShell";
import { fetchCompletedLapSessions } from "../reviewService";
import { formatLapTime } from "../circuit/lapFiltering";
import { getSessionDisplayName } from "../circuit/sessionNames";
import type { SavedLapSession } from "../circuit/types";
type ReviewSessionsPageProps = {
    authBypassEnabled?: boolean;
};
function formatDateTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(value));
}
function formatDuration(startedAt: string, endedAt: string) {
    if (!endedAt || !Number.isFinite(Date.parse(startedAt)) || !Number.isFinite(Date.parse(endedAt))) return "--";
 const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}
function getSessionStatusBadge(session: SavedLapSession) {
    if (session.reviewStatus === "recording_error" || session.status === "failed") {
        return {
            label: "Recording Error",
            className: "bg-red-500/12 text-red-700"
        };
    }
    if (!session.endedAt) return {label: "Unfinished session", className:"bg-amber-100 text-amber-800"};
    if (session.reviewStatus === "no_gps_data" || session.gpsSampleCount === 0) {
        return {
            label: "No GPS Data",
            className: "bg-amber-400/20 text-amber-800"
        };
    }
    return {
        label: "Complete",
        className: "bg-emerald-500/12 text-emerald-700"
    };
}
export function ReviewSessionsPage({ authBypassEnabled = false }: ReviewSessionsPageProps) {
    const [sessions, setSessions] = useState<SavedLapSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        async function loadSessions() {
            setLoading(true);
            const result = await fetchCompletedLapSessions();
            if (!active) {
                return;
            }
            setSessions(result.data ?? []);
            setError(result.error);
            setLoading(false);
        }
        void loadSessions();
        return () => {
            active = false;
        };
    }, []);
    return (<LapSessionShell authBypassEnabled={authBypassEnabled}>
      <section className="space-y-4">
        <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00A8E8]">
            Review Sessions
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-none text-foreground">
            Lap history
          </h1>
          <p className="mt-4 text-base font-semibold leading-7 text-muted-foreground">
            Open completed sessions, replay laps, and compare telemetry traces.
          </p>
        </div>

        {loading ? (<div className="rounded-[22px] border border-border bg-card p-6 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-[#00A8E8]" aria-hidden="true"/>
            <p className="mt-3 font-semibold">Loading sessions</p>
          </div>) : null}

        {error && !loading ? (<p className="rounded-[16px] border border-red-300/24 bg-red-400/12 p-3 text-sm font-bold leading-6 text-red-800">
            {error}
          </p>) : null}

        {!loading && sessions.length === 0 ? (<div className="rounded-[22px] bg-white p-4 text-[#071018] shadow-sm">
            <p className="text-base font-semibold">No completed sessions yet.</p>
            <Link href="/timing/start" className="mt-4 flex min-h-[54px] items-center justify-center rounded-full bg-[#007DAE] px-5 text-base font-semibold text-foreground">
              Start Session
            </Link>
          </div>) : null}

        <div className="space-y-3">
          {sessions.map((session) => (<Link key={session.id} href={`/review-sessions/${encodeURIComponent(session.id)}`} className="group block rounded-[22px] bg-white p-4 text-[#071018] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#F4F8FF]">
              {(() => {
                const badge = getSessionStatusBadge(session);
                return (<>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-xl font-semibold">
                            {getSessionDisplayName(session)}
                          </h2>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${badge.className}`}>
                            {badge.label}
                          </span>
                          {session.isDemo ? (<span className="rounded-full bg-[#007DAE]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#007DAE]">
                              Demo test data
                            </span>) : null}
                        </div>
                        {session.sessionName?.trim() ? (<p className="mt-2 truncate text-sm font-bold text-[#5D6675]">
                            {session.trackName}
                          </p>) : null}
                        <p className="mt-2 flex items-center gap-2 text-xs font-bold text-[#6F7B88]">
                          <CalendarClock className="size-4 text-[#007DAE]" aria-hidden="true"/>
                          {formatDateTime(session.startedAt)}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 size-6 shrink-0 text-[#007DAE] transition group-hover:translate-x-0.5"/>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-[16px] bg-[#EFF6FF] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5D6675]">
                          Valid laps
                        </p>
                        <p className="mt-1 text-2xl font-semibold">{session.totalLapsSaved}</p>
                      </div>
                      <div className="rounded-[16px] bg-[#EFF6FF] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5D6675]">
                          Fastest
                        </p>
                        <p className="mt-1 text-2xl font-semibold">
                          {formatLapTime(session.fastestLapTimeMs)}
                        </p>
                      </div>
                      <div className="rounded-[16px] bg-[#EFF6FF] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5D6675]">
                          Average
                        </p>
                        <p className="mt-1 text-lg font-semibold">
                          {formatLapTime(session.averageLapTimeMs)}
                        </p>
                      </div>
                      <div className="rounded-[16px] bg-[#EFF6FF] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5D6675]">
                          Duration
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-lg font-semibold">
                          <Timer className="size-4 text-[#007DAE]" aria-hidden="true"/>
                          {formatDuration(session.startedAt, session.endedAt)}
                        </p>
                      </div>
                    </div>
                  </>);
            })()}
            </Link>))}
        </div>
      </section>
    </LapSessionShell>);
}
