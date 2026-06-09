"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getTeacherMeetLink,
    updateTeacherMeetLink,
    getSessionsByTeacher,
    createSession,
    updateSessionStatus,
    deleteSession,
} from "@/lib/api/online-classes";
import { getTeacherClasses } from "@/lib/api/classes";
import { OnlineSession } from "@/types/student";
import { supabase } from "@/lib/supabase";
import { STALE_SHORT } from "@/lib/query-config";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FormInput } from "@/components/ui/form-input";
import { toast } from "sonner";
import {
    Video,
    Link2,
    Edit3,
    Check,
    X,
    Plus,
    Play,
    CheckCircle2,
    Trash2,
    Clock,
    Users,
    Calendar,
    Loader2,
    ExternalLink,
    AlertCircle,
    XCircle,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────

function getPakistanDate(): string {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

function getPakistanTime(): string {
    return new Date().toLocaleTimeString("en-US", {
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
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

function isValidMeetLink(url: string): boolean {
    return /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(url) ||
        /^https:\/\/meet\.google\.com\/.+/i.test(url);
}

function groupSessionsByDate(sessions: OnlineSession[]): Record<string, OnlineSession[]> {
    const groups: Record<string, OnlineSession[]> = {};
    sessions.forEach((s) => {
        if (!groups[s.scheduled_date]) groups[s.scheduled_date] = [];
        groups[s.scheduled_date].push(s);
    });
    return groups;
}

function getNextClassDate(scheduleDays?: Record<string, string> | null): string {
    if (!scheduleDays || typeof scheduleDays !== "object") {
        return getPakistanDate();
    }
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Get current date in Pakistan
    const pkDateStr = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Karachi" });
    const pkDate = new Date(pkDateStr);
    
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(pkDate);
        checkDate.setDate(pkDate.getDate() + i);
        
        const dayName = daysOfWeek[checkDate.getDay()];
        if (scheduleDays[dayName] === "Class") {
            return checkDate.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
        }
    }
    return getPakistanDate();
}

// ─── Main Component ─────────────────────────────────────────────

export function TeacherOnlineClass({ teacherId }: { teacherId: string }) {
    const queryClient = useQueryClient();
    const [isEditingLink, setIsEditingLink] = useState(false);
    const [linkDraft, setLinkDraft] = useState("");
    const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);

    // ─── Queries ─────────────────────────────────────────────

    const { data: meetLink, isLoading: linkLoading } = useQuery({
        queryKey: ["meetLink", teacherId],
        queryFn: () => getTeacherMeetLink(teacherId),
        ...STALE_SHORT,
    });

    const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
        queryKey: ["teacherSessions", teacherId],
        queryFn: () => getSessionsByTeacher(teacherId),
        ...STALE_SHORT,
    });

    const { data: teacherClasses = [] } = useQuery({
        queryKey: ["teacherClasses", teacherId],
        queryFn: () => getTeacherClasses(teacherId),
        ...STALE_SHORT,
    });

    // ─── Real-time subscription ──────────────────────────────

    useEffect(() => {
        const channel = supabase
            .channel(`online-sessions-teacher-${teacherId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "online_sessions",
                    filter: `teacher_id=eq.${teacherId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["teacherSessions", teacherId] });
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [teacherId, queryClient]);

    // ─── Mutations ───────────────────────────────────────────

    const saveLinkMutation = useMutation({
        mutationFn: () => updateTeacherMeetLink(teacherId, linkDraft.trim()),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["meetLink", teacherId] });
            setIsEditingLink(false);
            toast.success("Meet link saved!");
        },
        onError: () => toast.error("Failed to save meet link"),
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: "live" | "completed" | "cancelled" }) =>
            updateSessionStatus(id, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["teacherSessions", teacherId] });
        },
        onError: () => toast.error("Failed to update session"),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteSession,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["teacherSessions", teacherId] });
            toast.success("Session deleted");
        },
        onError: () => toast.error("Failed to delete session"),
    });

    // ─── Derived Data ────────────────────────────────────────

    const activeSessions = sessions.filter((s) => s.status === "scheduled" || s.status === "live");
    const completedSessions = sessions.filter((s) => s.status === "completed" || s.status === "cancelled");
    const groupedActive = groupSessionsByDate(activeSessions);
    const sortedDates = Object.keys(groupedActive).sort();

    // ─── Unique students from classes ────────────────────────

    const uniqueStudents = useMemo(() => {
        const map = new Map<string, { id: string; full_name: string; reg_no: string }>();
        teacherClasses.forEach((cls) => {
            const s = cls.student;
            if (s && !map.has(s.id)) {
                map.set(s.id, s);
            }
        });
        return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
    }, [teacherClasses]);

    // ─── Loading State ───────────────────────────────────────

    if (linkLoading || sessionsLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-30">
                <Loader2 className="size-10 animate-spin text-primary mb-6" />
                <p className="text-sm font-black uppercase tracking-[0.2em] animate-pulse">
                    Loading Online Class...
                </p>
            </div>
        );
    }

    // ─── Handle Save Link ────────────────────────────────────

    const handleSaveLink = () => {
        const trimmed = linkDraft.trim();
        if (!trimmed) {
            toast.error("Please enter a Google Meet link");
            return;
        }
        if (!isValidMeetLink(trimmed)) {
            toast.error("Please enter a valid Google Meet link (https://meet.google.com/...)");
            return;
        }
        saveLinkMutation.mutate();
    };

    const handleStartClass = (session: OnlineSession) => {
        window.open(session.meet_link, "_blank");
        if (session.status !== "live") {
            statusMutation.mutate({ id: session.id, status: "live" });
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-entrance max-w-5xl mx-auto w-full">
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
                    Set your Google Meet link, schedule sessions for your students, and start classes with one click.
                </p>
            </div>

            {/* ── Meet Link Card ── */}
            <div className="glass-panel rounded-3xl border border-white/20 dark:border-white/5 p-6 shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
                <div className="flex items-center gap-3 mb-4">
                    <div className="size-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                        <Video className="size-5 text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-foreground">Google Meet Link</h3>
                        <p className="text-xs text-muted-foreground">Your fixed meeting room — paste once, reuse forever</p>
                    </div>
                </div>

                {isEditingLink ? (
                    <div className="flex gap-3 items-center">
                        <div className="flex-1 relative">
                            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <input
                                type="url"
                                value={linkDraft}
                                onChange={(e) => setLinkDraft(e.target.value)}
                                placeholder="https://meet.google.com/abc-defg-hij"
                                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-accent/20 border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveLink();
                                    if (e.key === "Escape") setIsEditingLink(false);
                                }}
                            />
                        </div>
                        <button
                            onClick={handleSaveLink}
                            disabled={saveLinkMutation.isPending}
                            className="p-3 rounded-2xl bg-forest text-white hover:bg-forest/90 transition-all active:scale-95"
                        >
                            <Check className="size-4" />
                        </button>
                        <button
                            onClick={() => setIsEditingLink(false)}
                            className="p-3 rounded-2xl bg-accent text-muted-foreground hover:text-foreground transition-all active:scale-95"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                ) : meetLink ? (
                    <div className="flex items-center gap-3">
                        <div className="flex-1 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 flex items-center gap-3">
                            <Link2 className="size-4 text-emerald-600 shrink-0" />
                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 truncate">{meetLink}</span>
                        </div>
                        <button
                            onClick={() => {
                                setLinkDraft(meetLink);
                                setIsEditingLink(true);
                            }}
                            className="p-3 rounded-2xl bg-accent text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-all active:scale-95"
                        >
                            <Edit3 className="size-4" />
                        </button>
                        <a
                            href={meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-2xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all active:scale-95"
                        >
                            <ExternalLink className="size-4" />
                        </a>
                    </div>
                ) : (
                    <button
                        onClick={() => {
                            setLinkDraft("");
                            setIsEditingLink(true);
                        }}
                        className="w-full py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary font-bold text-sm hover:bg-primary/5 hover:border-primary/50 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        <Link2 className="size-4" />
                        Set Your Google Meet Link
                    </button>
                )}
            </div>

            {/* ── Actions Row ── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black tracking-tight text-foreground">
                        Scheduled Sessions
                    </h2>
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-black">
                        {activeSessions.length}
                    </span>
                </div>
                <button
                    onClick={() => {
                        if (!meetLink) {
                            toast.error("Please set your Google Meet link first");
                            return;
                        }
                        setIsNewSessionOpen(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-forest hover:bg-forest/90 text-white font-black rounded-full text-sm shadow-xl transition-all active:scale-95"
                >
                    <Plus className="size-4" />
                    New Session
                </button>
            </div>

            {/* ── Sessions List ── */}
            {activeSessions.length === 0 ? (
                <div className="text-center py-16 glass-panel rounded-3xl border border-white/10">
                    <Calendar className="size-12 mx-auto text-muted-foreground opacity-40 mb-3" />
                    <p className="font-bold text-foreground">No sessions scheduled</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create your first online class session above.
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
                                <span className="text-xs font-bold text-muted-foreground">
                                    {groupedActive[date].length} session{groupedActive[date].length !== 1 ? "s" : ""}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {groupedActive[date].map((session) => (
                                    <SessionCard
                                        key={session.id}
                                        session={session}
                                        onStart={() => handleStartClass(session)}
                                        onComplete={() =>
                                            statusMutation.mutate({ id: session.id, status: "completed" })
                                        }
                                        onCancel={() =>
                                            statusMutation.mutate({ id: session.id, status: "cancelled" })
                                        }
                                        onDelete={() => {
                                            if (window.confirm("Delete this session?")) {
                                                deleteMutation.mutate(session.id);
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Completed Sessions (Collapsible) ── */}
            {completedSessions.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showCompleted ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        Past Sessions ({completedSessions.length})
                    </button>
                    {showCompleted && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 opacity-60">
                            {completedSessions.slice(0, 10).map((session) => (
                                <SessionCard key={session.id} session={session} readonly />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── New Session Dialog ── */}
            <NewSessionDialog
                open={isNewSessionOpen}
                onOpenChange={setIsNewSessionOpen}
                teacherId={teacherId}
                meetLink={meetLink || ""}
                students={uniqueStudents}
                teacherClasses={teacherClasses}
            />
        </div>
    );
}

// ─── Session Card ───────────────────────────────────────────────

function SessionCard({
    session,
    onStart,
    onComplete,
    onCancel,
    onDelete,
    readonly = false,
}: {
    session: OnlineSession;
    onStart?: () => void;
    onComplete?: () => void;
    onCancel?: () => void;
    onDelete?: () => void;
    readonly?: boolean;
}) {
    const studentName = session.student
        ? (Array.isArray(session.student) ? (session.student as any)[0]?.full_name : session.student.full_name)
        : "Unknown Student";

    const isLive = session.status === "live";
    const isCompleted = session.status === "completed";
    const isCancelled = session.status === "cancelled";

    return (
        <div
            className={cn(
                "glass-panel rounded-3xl border overflow-hidden transition-all duration-300",
                isLive
                    ? "border-emerald-500/40 shadow-xl shadow-emerald-500/10 bg-emerald-500/[0.02]"
                    : isCompleted
                    ? "border-border/40 bg-accent/5"
                    : isCancelled
                    ? "border-red-500/20 bg-red-500/[0.02]"
                    : "border-white/20 dark:border-white/5 shadow-[0px_0px_48px_rgba(45,52,50,0.06)]"
            )}
        >
            <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-foreground truncate">{session.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {studentName}
                        </p>
                    </div>
                    <StatusBadge status={session.status} />
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        <span className="font-bold">{session.scheduled_time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="font-medium">{session.duration_mins} min</span>
                    </div>
                </div>
            </div>

            {!readonly && (
                <div className="px-5 pb-4 flex gap-2">
                    {session.status === "scheduled" && (
                        <>
                            <button
                                onClick={onStart}
                                className="flex-1 py-2.5 flex items-center justify-center gap-2 rounded-full text-sm font-black bg-forest text-white shadow-lg shadow-forest/20 hover:bg-forest/90 transition-all active:scale-95"
                            >
                                <Play className="size-3.5" />
                                Start Class
                            </button>
                            <button
                                onClick={onCancel}
                                className="p-2.5 rounded-full bg-accent text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-95"
                                title="Cancel"
                            >
                                <XCircle className="size-4" />
                            </button>
                        </>
                    )}
                    {isLive && (
                        <>
                            <button
                                onClick={onStart}
                                className="flex-1 py-2.5 flex items-center justify-center gap-2 rounded-full text-sm font-black bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500/90 transition-all active:scale-95 animate-pulse"
                            >
                                <ExternalLink className="size-3.5" />
                                Rejoin Meet
                            </button>
                            <button
                                onClick={onComplete}
                                className="p-2.5 rounded-full bg-accent text-muted-foreground hover:text-forest hover:bg-forest/10 transition-all active:scale-95"
                                title="Mark Complete"
                            >
                                <CheckCircle2 className="size-4" />
                            </button>
                        </>
                    )}
                    {(isCompleted || isCancelled) && onDelete && (
                        <button
                            onClick={onDelete}
                            className="p-2.5 rounded-full bg-accent text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-95"
                            title="Delete"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Status Badge ───────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string }> = {
        scheduled: {
            label: "Scheduled",
            className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        },
        live: {
            label: "● Live",
            className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse",
        },
        completed: {
            label: "Completed",
            className: "bg-muted text-muted-foreground border-border",
        },
        cancelled: {
            label: "Cancelled",
            className: "bg-red-500/10 text-red-500 border-red-500/20",
        },
    };

    const c = config[status] || config.scheduled;

    return (
        <span
            className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-black border shrink-0",
                c.className
            )}
        >
            {c.label}
        </span>
    );
}

// ─── New Session Dialog ─────────────────────────────────────────

function NewSessionDialog({
    open,
    onOpenChange,
    teacherId,
    meetLink,
    students,
    teacherClasses,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teacherId: string;
    meetLink: string;
    students: { id: string; full_name: string; reg_no: string }[];
    teacherClasses: any[];
}) {
    const queryClient = useQueryClient();
    const [studentId, setStudentId] = useState("");
    const [scheduledDate, setScheduledDate] = useState(getPakistanDate());
    const [scheduledTime, setScheduledTime] = useState("3:00 PM");
    const [durationMins, setDurationMins] = useState("30");
    const [title, setTitle] = useState("");

    const createMutation = useMutation({
        mutationFn: createSession,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["teacherSessions", teacherId] });
            onOpenChange(false);
            resetForm();
            toast.success("Session scheduled!");
        },
        onError: () => toast.error("Failed to create session"),
    });

    const resetForm = () => {
        setStudentId("");
        setScheduledDate(getPakistanDate());
        setScheduledTime("3:00 PM");
        setDurationMins("30");
        setTitle("");
    };

    useEffect(() => {
        if (!open) return;
        resetForm();
    }, [open]);

    // Auto-generate title and auto-fill date/time when student is selected
    useEffect(() => {
        if (studentId) {
            const student = students.find((s) => s.id === studentId);
            if (student) {
                setTitle(`Session — ${student.full_name}`);
            }

            // Find the class schedule for this student
            const studentClass = teacherClasses.find((c) => c.student_id === studentId);
            if (studentClass) {
                // 1. Auto-fill scheduled time
                if (studentClass.pak_start_time) {
                    setScheduledTime(studentClass.pak_start_time);
                }

                // 2. Auto-fill next scheduled date based on schedule_days
                if (studentClass.schedule_days) {
                    const nextDate = getNextClassDate(studentClass.schedule_days);
                    setScheduledDate(nextDate);
                }
            }
        }
    }, [studentId, students, teacherClasses]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentId) {
            toast.error("Please select a student");
            return;
        }
        createMutation.mutate({
            teacher_id: teacherId,
            student_id: studentId,
            title: title || "Online Class",
            meet_link: meetLink,
            scheduled_date: scheduledDate,
            scheduled_time: scheduledTime,
            duration_mins: parseInt(durationMins) || 30,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-[520px] rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl"
            >
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-xl font-black">
                        Schedule Online Class
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted-foreground ml-1">
                            Student *
                        </label>
                        <Select value={studentId} onValueChange={setStudentId}>
                            <SelectTrigger className="rounded-2xl border-border h-11">
                                <Users className="size-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Select a student..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl max-h-60">
                                {students.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.full_name} ({s.reg_no})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <FormInput
                        label="Session Title"
                        name="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Quran Recitation — Amira"
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground ml-1">
                                Date *
                            </label>
                            <input
                                type="date"
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl bg-accent/20 border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                                required
                            />
                        </div>
                        <FormInput
                            label="Time (PKT) *"
                            name="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            placeholder="e.g. 3:00 PM"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground ml-1">
                                Duration
                            </label>
                            <Select value={durationMins} onValueChange={setDurationMins}>
                                <SelectTrigger className="rounded-2xl border-border h-11">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    <SelectItem value="15">15 minutes</SelectItem>
                                    <SelectItem value="30">30 minutes</SelectItem>
                                    <SelectItem value="45">45 minutes</SelectItem>
                                    <SelectItem value="60">1 hour</SelectItem>
                                    <SelectItem value="90">1.5 hours</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground ml-1">
                                Meet Link
                            </label>
                            <div className="px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
                                {meetLink || "Not set"}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 gap-3">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="px-6 py-3 rounded-full text-sm font-bold text-muted-foreground hover:text-foreground transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="px-7 py-3 bg-forest text-white font-black rounded-full text-sm hover:bg-forest/90 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
                        >
                            {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                            Schedule Session
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
