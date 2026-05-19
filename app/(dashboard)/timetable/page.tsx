"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeachers, getTeachersBySupervisor, getAllClasses } from "@/lib/api/classes";
import { getSupervisors } from "@/lib/api/supervisors";
import { Teacher, ClassSchedule } from "@/types/student";
import { Supervisor } from "@/types/supervisor";
import { 
    Calendar, 
    Clock, 
    Loader2, 
    Globe, 
    Users, 
    Zap, 
    ChevronRight,
    Search,
    Filter,
    ArrowRightLeft,
    Monitor,
    Play,
    UserCircle2,
    Shield,
    MoreVertical,
    Clock3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STALE_SHORT } from "@/lib/query-config";
import { ManageStudentDialog } from "@/components/dialogs/ManageStudentDialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ─── HELPERS ───────────────────────────────────────────────────

/** Converts "10:30 AM" or "10:30AM" to minutes from 00:00 */
const timeToMinutes = (timeStr?: string) => {
    if (!timeStr) return 0;
    const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM|am|pm)$/i);
    if (!match) return 0;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const modifier = match[3].toUpperCase();
    
    if (hours === 12) hours = 0;
    if (modifier === "PM") hours += 12;
    return hours * 60 + minutes;
};

/** Normalizes "10:3 am" to "10:03 AM" for consistent grouping keys */
const normalizeTime = (timeStr?: string) => {
    if (!timeStr) return "";
    const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM|am|pm)$/i);
    if (!match) return timeStr.trim();
    
    const hours = parseInt(match[1], 10);
    const minutes = match[2].padStart(2, '0');
    const modifier = match[3].toUpperCase();
    
    return `${hours}:${minutes} ${modifier}`;
};

/** Get current time in Pakistan (UTC+5) as minutes from 00:00 */
const getCurrentPKMinutes = () => {
    const now = new Date();
    const pkTimeStr = now.toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour12: true });
    return timeToMinutes(pkTimeStr);
};

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const SHORT_DAYS: Record<string, string> = {
    Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

const generateTimeSlots = () => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const isPM = h >= 12;
            const hour12 = h % 12 === 0 ? 12 : h % 12;
            const minStr = m.toString().padStart(2, '0');
            const modifier = isPM ? 'PM' : 'AM';
            const timeStr = `${hour12}:${minStr} ${modifier}`;
            slots.push({
                timeStr,
                startMinutes: h * 60 + m,
                endMinutes: h * 60 + m + 30
            });
        }
    }
    return slots;
};
const TIME_SLOTS = generateTimeSlots();

export default function TimetablePage() {
    const queryClient = useQueryClient();
    const activeRef = useRef<HTMLDivElement>(null);
    
    // ─── Filters & Global State ─────────────────────────────────
    const [selectedDay, setSelectedDay] = useState<string>(() => {
        return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Karachi" }).format(new Date());
    });
    
    const [isMounted, setIsMounted] = useState(false);
    const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("All");
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>("All");
    const [selectedTime, setSelectedTime] = useState<string>("All");
    const [nowMinutes, setNowMinutes] = useState(getCurrentPKMinutes());
    
    // Auth State safely loaded on client
    const [authRole, setAuthRole] = useState("admin");
    const [authSupervisorId, setAuthSupervisorId] = useState<string | undefined>(undefined);
    const [authTeacherId, setAuthTeacherId] = useState<string | undefined>(undefined);

    useEffect(() => {
        setIsMounted(true);
        if (typeof document !== 'undefined') {
            const roleMatch = document.cookie.split("; ").find(c => c.trim().startsWith("auth_role="));
            const supMatch = document.cookie.split("; ").find(c => c.trim().startsWith("supervisor_id="));
            const teacherMatch = document.cookie.split("; ").find(c => c.trim().startsWith("teacher_id="));
            
            const r = roleMatch ? roleMatch.split("=")[1] : "admin";
            const s = supMatch ? supMatch.split("=")[1] : undefined;
            const t = teacherMatch ? teacherMatch.split("=")[1] : undefined;
            
            setAuthRole(r);
            setAuthSupervisorId(s);
            setAuthTeacherId(t);
            
            if (r === "supervisor" && s) {
                setSelectedSupervisorId(s);
            } else if (r === "teacher" && t) {
                setSelectedTeacherId(t);
            }
        }
        
        const timer = setInterval(() => setNowMinutes(getCurrentPKMinutes()), 60000);
        return () => clearInterval(timer);
    }, []);

    const isSupervisor = authRole === "supervisor";
    const isTeacher = authRole === "teacher";

    // Manage Dialog State
    const [manageStudentId, setManageStudentId] = useState<string | null>(null);
    const [isManageOpen, setIsManageOpen] = useState(false);

    // ─── Queries ────────────────────────────────────────────────
    const { data: teachers = [], isLoading: teachersLoading } = useQuery({
        queryKey: (isSupervisor && authSupervisorId) 
            ? ["teachers", "supervisor", authSupervisorId] 
            : (isTeacher && authTeacherId)
                ? ["teachers", "self", authTeacherId]
                : ["teachers"],
        queryFn: async () => {
            if (isSupervisor && authSupervisorId) {
                return await getTeachersBySupervisor(authSupervisorId);
            }
            return await getTeachers();
        },
        enabled: isMounted, // Wait until role is determined
        ...STALE_SHORT,
    });

    const { data: allClasses = [], isLoading: allClassesLoading } = useQuery({
        queryKey: ["allClasses"],
        queryFn: getAllClasses,
        ...STALE_SHORT,
    });

    const { data: supervisors = [] } = useQuery({
        queryKey: ["supervisors"],
        queryFn: () => getSupervisors(),
    });

    // ─── Data Grouping & Sorting ─────────────────────────────────
    const timeBlocks = useMemo(() => {
        // 1. Flatten and Filter
        const sessions = allClasses.filter((cls) => {
            if (!cls.schedule_days) return false;
            const days = Object.keys(cls.schedule_days).map(d => d.toLowerCase());
            if (!days.includes(selectedDay.toLowerCase())) return false;

            const teacher = teachers.find(t => t.id === cls.teacher_id);
            if (!teacher) return false;

            const matchesSup = selectedSupervisorId === "All" || teacher.supervisor_id === selectedSupervisorId;
            const matchesTeacher = selectedTeacherId === "All" || teacher.id === selectedTeacherId;
            
            return matchesSup && matchesTeacher;
        }).map(cls => {
            const teacher = teachers.find(t => t.id === cls.teacher_id);
            const supervisor = supervisors.find(s => s.id === teacher?.supervisor_id);
            return {
                ...cls,
                teacherName: teacher?.name || "Unknown",
                supervisorName: supervisor?.name || "Admin",
                startMinutes: timeToMinutes(cls.pak_start_time),
                endMinutes: timeToMinutes(cls.pak_end_time)
            };
        });

        // 2. Map sessions into the 48 fixed time slots
        let blocks = TIME_SLOTS.map(slot => {
            const slotSessions = sessions.filter(
                cls => cls.startMinutes >= slot.startMinutes && cls.startMinutes < slot.endMinutes
            ).sort((a, b) => (a.student?.full_name || "").localeCompare(b.student?.full_name || ""));

            return {
                time: slot.timeStr,
                startMinutes: slot.startMinutes,
                endMinutes: slot.endMinutes,
                sessions: slotSessions
            };
        });

        // 3. Optional Time Filter
        if (selectedTime !== "All") {
            blocks = blocks.filter(block => block.time === selectedTime);
        }

        return blocks;
    }, [allClasses, teachers, supervisors, selectedDay, selectedSupervisorId, selectedTeacherId, selectedTime]);

    // Extract all unique normalized times for the filter dropdown
    const uniqueTimes = useMemo(() => {
        const times = new Set<string>();
        allClasses.forEach(cls => {
            if (cls.pak_start_time) times.add(normalizeTime(cls.pak_start_time));
        });
        return Array.from(times).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    }, [allClasses]);

    // ─── SCROLL TO RELEVANT BLOCK ───
    const currentBlockIdx = useMemo(() => {
        return timeBlocks.findIndex(block => {
            return nowMinutes >= block.startMinutes && nowMinutes < block.endMinutes;
        });
    }, [timeBlocks, nowMinutes]);

    const nextBlockIdx = useMemo(() => {
        return timeBlocks.findIndex(block => block.startMinutes > nowMinutes);
    }, [timeBlocks, nowMinutes]);

    useEffect(() => {
        if (!allClassesLoading && !teachersLoading && activeRef.current) {
            const timer = setTimeout(() => {
                activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [allClassesLoading, teachersLoading, selectedDay]);

    if (teachersLoading || allClassesLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-30">
                <Loader2 className="size-10 animate-spin text-primary mb-6" />
                <p className="text-sm font-black uppercase tracking-[0.2em] animate-pulse">Synchronizing Cluster...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto flex flex-col relative w-full mx-auto bg-[#fafafa] dark:bg-[#050505] p-6 lg:p-10 space-y-10 scroll-smooth">
            
            {/* ── HEADER ── */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20 flex items-center gap-2">
                             <div className="size-1.5 rounded-full bg-primary animate-pulse" />
                             High-Density Sync
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold border-border bg-card">
                            {timeBlocks.length} Groups Optimized
                        </Badge>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-foreground leading-none">
                        Time <span className="text-primary italic">Table</span>
                    </h1>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                    <div className="p-4 rounded-3xl bg-card border border-border flex items-center gap-3 min-w-[180px] shadow-sm">
                        <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                             <Monitor className="size-4" />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">{selectedDay}</p>
                            <p className="text-lg font-black leading-none">{allClasses.length}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── FILTER HUB ── */}
            <div className="sticky top-0 z-40 px-6 py-5 bg-background/80 backdrop-blur-3xl border border-border/80 rounded-[32px] shadow-2xl flex flex-col xl:flex-row items-center gap-6 transition-all">
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    <div className="space-y-1.5 min-w-[170px] flex-1 xl:flex-none">
                        <label className="text-[9px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Level Lead</label>
                        <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId} disabled={isSupervisor || isTeacher}>
                            <SelectTrigger className="h-10 rounded-2xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                <Shield className="size-3.5 mr-2 text-primary" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border shadow-2xl">
                                {!isSupervisor && <SelectItem value="All">Global Feed</SelectItem>}
                                {supervisors.map((s: Supervisor) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 min-w-[170px] flex-1 xl:flex-none">
                        <label className="text-[9px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Faculty Member</label>
                        <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId} disabled={isTeacher}>
                            <SelectTrigger className="h-10 rounded-2xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                <Search className="size-3.5 mr-2 text-primary" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border shadow-2xl">
                                <SelectItem value="All">All Teachers</SelectItem>
                                {teachers.map((t: Teacher) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 min-w-[170px] flex-1 xl:flex-none">
                        <label className="text-[9px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Time Slot</label>
                        <Select value={selectedTime} onValueChange={setSelectedTime}>
                            <SelectTrigger className="h-10 rounded-2xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                <Clock className="size-3.5 mr-2 text-primary" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-border shadow-2xl">
                                <SelectItem value="All">All Times</SelectItem>
                                {uniqueTimes.map((time) => (
                                    <SelectItem key={time} value={time}>{time}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="flex bg-accent/20 h-10 p-1 rounded-2xl border border-border w-full flex-wrap xl:min-w-[400px]">
                        {ALL_DAYS.map(day => (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                className={cn(
                                    "flex-1 h-full px-4 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all",
                                    selectedDay === day 
                                        ? "bg-primary text-white shadow-xl shadow-primary/20 scale-105" 
                                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                )}
                            >
                                {SHORT_DAYS[day]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <button 
                        onClick={() => { 
                            setSelectedSupervisorId(isSupervisor && authSupervisorId ? authSupervisorId : "All"); 
                            setSelectedTeacherId("All"); 
                            setSelectedTime("All");
                        }}
                        className="p-3 rounded-2xl bg-accent text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-all active:scale-90"
                    >
                        <Filter className="size-4" />
                    </button>
                </div>
            </div>

            {/* ── THE 24-HOUR GRID ── */}
            <main className="flex flex-col relative pb-40">
                {timeBlocks.length === 0 ? (
                    <div className="py-40 flex flex-col items-center justify-center opacity-40">
                        <Calendar className="size-16 mb-6" />
                        <p className="text-sm font-black uppercase tracking-[0.2em]">Zero Sessions Detected for Parameters</p>
                    </div>
                ) : (
                    timeBlocks.map((block, bIdx) => {
                        const isBlockLive = nowMinutes >= block.startMinutes && nowMinutes < block.endMinutes;
                        const isScrollTarget = currentBlockIdx !== -1 ? bIdx === currentBlockIdx : bIdx === nextBlockIdx;
                        const hasClasses = block.sessions.length > 0;

                        return (
                            <div 
                                key={block.time} 
                                ref={isScrollTarget ? activeRef : null}
                                className={cn(
                                    "group/block flex flex-col lg:flex-row gap-4 lg:gap-8 py-4 border-b border-border/40 relative",
                                    isBlockLive ? "bg-primary/[0.02]" : ""
                                )}
                            >
                                {/* Left Time Marker */}
                                <div className="lg:w-[100px] shrink-0 pt-1 flex items-center lg:items-start lg:flex-col gap-2">
                                    <div className={cn(
                                        "text-sm font-black tracking-tight shrink-0 transition-all duration-500 flex items-center gap-1",
                                        isBlockLive ? "text-primary scale-105" : "text-muted-foreground",
                                        !hasClasses && !isBlockLive && "opacity-50"
                                    )}>
                                        {block.time.split(" ")[0]}
                                        <span className="text-[10px] block opacity-60 font-black">{block.time.split(" ")[1]}</span>
                                    </div>
                                    {isBlockLive && (
                                        <div className="hidden lg:block w-3 h-3 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)] mt-1" />
                                    )}
                                </div>

                                {/* Right Grid / Empty State */}
                                <div className="flex-1 min-h-[60px]">
                                    {!hasClasses ? (
                                        <div className="h-full w-full rounded-2xl border-2 border-dashed border-border/30 flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition-opacity min-h-[60px]">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Open Slot</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                                            {block.sessions.map((cls) => {
                                                const isSessionLive = nowMinutes >= cls.startMinutes && nowMinutes < cls.endMinutes;
                                                const isCompleted = nowMinutes >= cls.endMinutes;

                                                return (
                                                    <button
                                                        key={cls.id}
                                                        onClick={() => { setManageStudentId(cls.student_id); setIsManageOpen(true); }}
                                                        className={cn(
                                                            "relative p-4 rounded-[24px] border-2 transition-all duration-500 text-left overflow-hidden group/card active:scale-95",
                                                            isSessionLive 
                                                                ? "bg-emerald-500/[0.04] border-emerald-500/40 shadow-xl shadow-emerald-500/10" 
                                                                : isCompleted
                                                                    ? "bg-accent/5 border-border/40 opacity-40 grayscale-[0.5]"
                                                                    : "bg-card border-border hover:border-primary/40 hover:shadow-xl hover:scale-[1.02]"
                                                        )}
                                                    >
                                                        {/* Card Header: Student */}
                                                <div className="space-y-2.5 relative z-10">
                                                    <div className="flex items-start justify-between">
                                                        <h3 className={cn(
                                                            "text-xs font-black leading-tight tracking-tight",
                                                            isSessionLive ? "text-emerald-600" : "text-foreground"
                                                        )}>
                                                            {cls.student?.full_name}
                                                        </h3>
                                                        <div className="size-6 rounded-lg bg-accent flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                             <ChevronRight className="size-3.5" />
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5">
                                                        <Badge variant="outline" className="text-[8px] font-mono border-border bg-background px-1.5 h-4">
                                                            {cls.student?.reg_no || "REG"}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-[8px] font-bold border-primary/20 text-primary bg-primary/5 px-1.5 h-4">
                                                            {cls.app_account?.platform || "PLAT"}
                                                        </Badge>
                                                    </div>

                                                    {/* Card Body: Faculty Trace */}
                                                    <div className="grid grid-cols-1 gap-2 pt-3 mt-3 border-t border-border/50">
                                                        <div className="flex items-center gap-2">
                                                            <div className="size-5 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                                                <UserCircle2 className="size-3" />
                                                            </div>
                                                            <p className="text-[9px] font-black text-muted-foreground truncate">{cls.teacherName}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="size-5 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                                                                <Shield className="size-3" />
                                                            </div>
                                                            <p className="text-[9px] font-bold text-muted-foreground/60 truncate">Lead {cls.supervisorName}</p>
                                                        </div>
                                                    </div>

                                                    {/* Card Footer: Time Range */}
                                                    <div className="flex items-center gap-2 pt-2 text-[9px] font-black text-muted-foreground/40">
                                                        <Clock3 className="size-3" />
                                                        <span>
                                                            {cls.pak_start_time.split(" ")[0]} — {cls.pak_end_time}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Interaction Decor */}
                                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/card:opacity-10 transition-opacity">
                                                    <Zap className="size-12" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                    </div>
                                )}
                            </div>
                        </div>
                        );
                    })
                )}
            </main>

            <ManageStudentDialog
                studentId={manageStudentId}
                open={isManageOpen}
                onOpenChange={setIsManageOpen}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["allClasses"] });
                    queryClient.invalidateQueries({ queryKey: ["teachers"] });
                }}
            />
        </div>
    );
}
