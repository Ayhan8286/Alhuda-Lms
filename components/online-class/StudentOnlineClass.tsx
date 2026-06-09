"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getSessionsByStudent,
    getStudentSessionHistory,
} from "@/lib/api/online-classes";
import { OnlineSession } from "@/types/student";
import { supabase } from "@/lib/supabase";
import { STALE_SHORT } from "@/lib/query-config";
import {
    Video,
    Clock,
    Calendar,
    Loader2,
    ExternalLink,
    UserCircle2,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    XCircle,
    Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────

function getPakistanDate(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

function formatDate(dateStr: string): string {
    const today = getPakistanDate();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });

    if (dateStr === today) return "Today";
    if (dateStr === tomorrowStr) return "Tomorrow";

    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}

function groupSessionsByDate(sessions: OnlineSession[]): Record<string, OnlineSession[]> {
    const groups: Record<string, OnlineSession[]> = {};
    sessions.forEach((s) => {
        if (!groups[s.scheduled_date]) groups[s.scheduled_date] = [];
        groups[s.scheduled_date].push(s);
    });
    return groups;
}

// ─── Main Component ─────────────────────────────────────────────

export function StudentOnlineClass({ studentId }: { studentId: string }) {
    const queryClient = useQueryClient();
    const [showHistory, setShowHistory] = useState(false);

    // ─── Queries ─────────────────────────────────────────────

    const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
        queryKey: ["studentSessions", studentId],
        queryFn: () => getSessionsByStudent(studentId),
        ...STALE_SHORT,
    });

    const { data: history = [], isLoading: historyLoading } = useQuery({
        queryKey: ["studentSessionHistory", studentId],
        queryFn: () => getStudentSessionHistory(studentId),
        enabled: showHistory,
        ...STALE_SHORT,
    });

    // ─── Real-time subscription ──────────────────────────────

    useEffect(() => {
        const channel = supabase
            .channel(`online-sessions-student-${studentId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "online_sessions",
                    filter: `student_id=eq.${studentId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["studentSessions", studentId] });
                    if (showHistory) {
                        queryClient.invalidateQueries({ queryKey: ["studentSessionHistory", studentId] });
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [studentId, queryClient, showHistory]);

    // ─── Derived ─────────────────────────────────────────────

    const liveSessions = sessions.filter((s) => s.status === "live");
    const upcomingSessions = sessions.filter((s) => s.status === "scheduled");
    const grouped = groupSessionsByDate(upcomingSessions);
    const sortedDates = Object.keys(grouped).sort();

    // ─── Loading ─────────────────────────────────────────────

    if (sessionsLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-30">
                <Loader2 className="size-10 animate-spin text-primary mb-6" />
                <p className="text-sm font-black uppercase tracking-[0.2em] animate-pulse">
                    Loading Classes...
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 animate-entrance max-w-4xl mx-auto w-full">
            {/* ── Header ── */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20 flex items-center gap-2">
                        <div className="size-1.5 rounded-full bg-primary animate-pulse" />
                        Virtual Campus
                    </div>
                </div>
                <h1 className="text-4xl font-black tracking-tighter text-foreground leading-none">
                    Online <span className="text-primary italic">Class</span>
                </h1>
                <p className="text-muted-foreground mt-2 text-sm font-medium max-w-2xl">
                    View your scheduled online classes and join with one click — no login required.
                </p>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="glass-panel rounded-3xl p-5 border border-white/20 dark:border-white/5 shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
                    <div className="size-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-3">
                        <Wifi className="size-5 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-black tracking-tight text-emerald-500">{liveSessions.length}</p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">Live Now</p>
                </div>
                <div className="glass-panel rounded-3xl p-5 border border-white/20 dark:border-white/5 shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
                    <div className="size-10 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-3">
                        <Calendar className="size-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-black tracking-tight text-blue-500">{upcomingSessions.length}</p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">Upcoming</p>
                </div>
                <div className="glass-panel rounded-3xl p-5 border border-white/20 dark:border-white/5 shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
                    <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                        <Video className="size-5 text-primary" />
                    </div>
                    <p className="text-2xl font-black tracking-tight text-primary">{sessions.length}</p>
                    <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">Total Active</p>
                </div>
            </div>

            {/* ── Live Sessions (Priority) ── */}
            {liveSessions.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="size-3 rounded-full bg-emerald-500 animate-pulse" />
                        <h2 className="text-lg font-black tracking-tight text-foreground">Live Now</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {liveSessions.map((session) => (
                            <LiveSessionCard key={session.id} session={session} />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Upcoming Sessions ── */}
            <div>
                <h2 className="text-lg font-black tracking-tight text-foreground mb-4">
                    Upcoming Sessions
                </h2>
                {upcomingSessions.length === 0 ? (
                    <div className="text-center py-16 glass-panel rounded-3xl border border-white/10">
                        <Calendar className="size-12 mx-auto text-muted-foreground opacity-40 mb-3" />
                        <p className="font-bold text-foreground">No upcoming classes</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Your teacher will schedule sessions for you. Check back later!
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {sortedDates.map((date) => (
                            <div key={date}>
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        {formatDate(date)}
                                    </span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {grouped[date].map((session) => (
                                        <UpcomingSessionCard key={session.id} session={session} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── History (Collapsible) ── */}
            <div>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                    {showHistory ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    Past Sessions
                </button>
                {showHistory && (
                    <div className="mt-4">
                        {historyLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : history.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">No past sessions yet.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-60">
                                {history.map((session) => (
                                    <HistoryCard key={session.id} session={session} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Live Session Card ──────────────────────────────────────────

function LiveSessionCard({ session }: { session: OnlineSession }) {
    const teacherName = session.teacher
        ? (Array.isArray(session.teacher) ? (session.teacher as any)[0]?.name : session.teacher.name)
        : "Your Teacher";

    return (
        <div className="glass-panel rounded-3xl border-2 border-emerald-500/40 overflow-hidden shadow-xl shadow-emerald-500/10 bg-emerald-500/[0.02]">
            <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-foreground truncate">{session.title}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                            <UserCircle2 className="size-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-bold">{teacherName}</span>
                        </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse shrink-0">
                        ● Live
                    </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        <span className="font-bold">{session.scheduled_time}</span>
                    </div>
                    <span className="font-medium">{session.duration_mins} min</span>
                </div>
            </div>
            <div className="px-5 pb-5">
                <a
                    href={session.meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 flex items-center justify-center gap-2 rounded-full text-sm font-black bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-500/90 transition-all active:scale-95"
                >
                    <ExternalLink className="size-4" />
                    Join Class Now
                </a>
            </div>
        </div>
    );
}

// ─── Upcoming Session Card ──────────────────────────────────────

function UpcomingSessionCard({ session }: { session: OnlineSession }) {
    const teacherName = session.teacher
        ? (Array.isArray(session.teacher) ? (session.teacher as any)[0]?.name : session.teacher.name)
        : "Your Teacher";

    return (
        <div className="glass-panel rounded-3xl border border-white/20 dark:border-white/5 overflow-hidden shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
            <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-foreground truncate">{session.title}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                            <UserCircle2 className="size-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-bold">{teacherName}</span>
                        </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
                        Scheduled
                    </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        <span className="font-bold">{formatDate(session.scheduled_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        <span className="font-bold">{session.scheduled_time}</span>
                    </div>
                    <span className="font-medium">{session.duration_mins} min</span>
                </div>
            </div>
            <div className="px-5 pb-4">
                <div className="py-2.5 flex items-center justify-center gap-2 rounded-full text-sm font-bold border border-border text-muted-foreground">
                    <Clock className="size-3.5" />
                    Waiting for teacher to start
                </div>
            </div>
        </div>
    );
}

// ─── History Card ───────────────────────────────────────────────

function HistoryCard({ session }: { session: OnlineSession }) {
    const teacherName = session.teacher
        ? (Array.isArray(session.teacher) ? (session.teacher as any)[0]?.name : session.teacher.name)
        : "Teacher";
    const isCompleted = session.status === "completed";

    return (
        <div className="glass-panel rounded-3xl border border-border/40 overflow-hidden bg-accent/5 p-5">
            <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-bold text-foreground truncate flex-1">{session.title}</h4>
                {isCompleted ? (
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                ) : (
                    <XCircle className="size-4 text-red-400 shrink-0" />
                )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium">{teacherName}</span>
                <span>•</span>
                <span>{formatDate(session.scheduled_date)}</span>
                <span>•</span>
                <span>{session.scheduled_time}</span>
            </div>
        </div>
    );
}
