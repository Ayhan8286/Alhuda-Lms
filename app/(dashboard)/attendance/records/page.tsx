"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getAttendanceByDate, AttendanceWithStudent, getMissingAttendanceStudents } from "@/lib/api/attendance";
import { Calendar } from "@/components/ui/calendar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, UserCheck, UserX, Clock, Loader2, ArrowLeft, CalendarOff, Filter, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingShimmer } from "@/components/ui/LoadingShimmer";

type StatusFilter = "all" | "Present" | "Absent" | "Late" | "Leave" | "Unmarked";

import { Suspense } from "react";

function AttendanceRecordsContent() {
    const searchParams = useSearchParams();
    const initialStatus = (searchParams.get("status") as StatusFilter) || "all";

    const cookies = typeof document !== 'undefined' ? document.cookie.split(';').map(c => c.trim()) : [];
    const role = cookies.find(c => c.startsWith("auth_role="))?.split("=")[1];
    const teacherId = cookies.find(c => c.startsWith("teacher_id="))?.split("=")[1];
    const supervisorId = cookies.find(c => c.startsWith("supervisor_id="))?.split("=")[1];

    const [selectedDate, setSelectedDate] = useState<Date>(subDays(new Date(), 1));
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
    const [supervisorFilter, setSupervisorFilter] = useState<string | null>(null);

    const { data: records = [], isLoading: isLoadingMarked } = useQuery({
        queryKey: ["attendanceRecords", format(selectedDate, "yyyy-MM-dd")],
        queryFn: () => getAttendanceByDate(format(selectedDate, "yyyy-MM-dd")),
    });

    const { data: missingStudents = [], isLoading: isLoadingMissing } = useQuery({
        queryKey: ["missingAttendance", format(selectedDate, "yyyy-MM-dd")],
        queryFn: () => getMissingAttendanceStudents(format(selectedDate, "yyyy-MM-dd")),
    });

    const isLoading = isLoadingMarked || isLoadingMissing;

    const unmarkedRecords: AttendanceWithStudent[] = missingStudents.map(s => ({
        id: `unmarked-${s.id}`,
        student_id: s.id,
        date: format(selectedDate, "yyyy-MM-dd"),
        status: "Unmarked" as any, // Use any here because Unmarked is a UI state not in the DB enum
        student: s,
        remarks: null,
        class_id: null,
        marked_by: null
    }));

    const allRecordsRaw: AttendanceWithStudent[] = [...records, ...unmarkedRecords];

    const allRecords = allRecordsRaw.filter((r) => {
        let matchesRole = true;

        if (role === "teacher" && teacherId) {
            const studentClasses = (r.student as any)?.classes || [];
            matchesRole = studentClasses.some((c: any) => {
                const t = Array.isArray(c.teacher) ? c.teacher[0] : c.teacher;
                return t && t.id === teacherId;
            });
        } else if (role === "supervisor" && supervisorId) {
            const sId = r.student?.supervisor_id;
            const sObj = r.student?.supervisor as any;

            if (sId === supervisorId || sObj?.id === supervisorId) {
                matchesRole = true;
            } else {
                const studentClasses = (r.student as any)?.classes || [];
                matchesRole = studentClasses.some((c: any) => {
                    const t = Array.isArray(c.teacher) ? c.teacher[0] : c.teacher;
                    const tSup = t?.supervisor;
                    return tSup && (tSup.id === supervisorId || t.supervisor_id === supervisorId);
                });
            }
        }

        return matchesRole;
    });

    const filteredRecords = allRecords.filter((r) => {
        const matchesStatus = statusFilter === "all" ? true : r.status === statusFilter;
        const matchesSupervisor = !supervisorFilter ? true : r.student?.supervisor?.name === supervisorFilter;
        return matchesStatus && matchesSupervisor;
    });

    const summary = {
        total: allRecords.length,
        present: allRecords.filter((r) => r.status === "Present").length,
        absent: allRecords.filter((r) => r.status === "Absent").length,
        late: allRecords.filter((r) => r.status === "Late").length,
        leave: allRecords.filter((r) => r.status === "Leave").length,
        unmarked: allRecords.filter((r) => (r.status as any) === "Unmarked").length,
    };

    const getStatusConfig = (status: string) => {
        const configs: Record<string, { bg: string; text: string; dot: string; shadow: string }> = {
            Present: { bg: "bg-green-500/10", text: "text-green-500", dot: "bg-green-500", shadow: "shadow-[0_0_10px_rgba(34,197,94,0.4)]" },
            Absent: { bg: "bg-red-500/10", text: "text-red-500", dot: "bg-red-500", shadow: "shadow-[0_0_10px_rgba(239,68,68,0.4)]" },
            Late: { bg: "bg-yellow-500/10", text: "text-yellow-500", dot: "bg-yellow-500", shadow: "shadow-[0_0_10px_rgba(234,179,8,0.4)]" },
            Leave: { bg: "bg-blue-500/10", text: "text-blue-500", dot: "bg-blue-500", shadow: "shadow-[0_0_10px_rgba(59,130,246,0.4)]" },
            Unmarked: { bg: "bg-slate-500/10", text: "text-slate-500", dot: "bg-slate-500", shadow: "shadow-[0_0_10px_rgba(100,116,139,0.4)]" },
        };
        return configs[status] || { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", shadow: "" };
    };

    const supervisorBreakdown = allRecords.reduce((acc, record) => {
        const supervisorName = record.student?.supervisor?.name || "Unassigned";
        if (!acc[supervisorName]) {
            acc[supervisorName] = { present: 0, absent: 0, late: 0, leave: 0, unmarked: 0, total: 0 };
        }
        acc[supervisorName].total++;
        const status = record.status;
        if (status === "Present") acc[supervisorName].present++;
        else if (status === "Absent") acc[supervisorName].absent++;
        else if (status === "Late") acc[supervisorName].late++;
        else if (status === "Leave") acc[supervisorName].leave++;
        else if (status === "Unmarked") acc[supervisorName].unmarked++;
        return acc;
    }, {} as Record<string, { present: number, absent: number, late: number, leave: number, unmarked: number, total: number }>);

    return (
        <div className="w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6 font-display flex-1">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/attendance">
                        <button className="rounded-full border border-border hover:border-primary/30 p-2 transition-all text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    </Link>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground mb-1">History</p>
                        <h1 className="text-3xl font-black tracking-tight text-foreground leading-none">
                            Attendance Records
                            <span className="text-primary ml-2 text-2xl">✦</span>
                        </h1>
                        <p className="text-muted-foreground mt-1.5 text-sm">View recorded attendance by date.</p>
                        {role === "teacher" && (
                            <div className="text-xs text-muted-foreground font-mono bg-accent/20 p-2 rounded-lg mt-2 max-w-max">
                                Debug: role={role}, teacherId={teacherId}, total={allRecords.length}, filtered={filteredRecords.length}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Date Picker & Summary */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Date Picker Card */}
                <div className="bg-card rounded-3xl border border-border p-6 shadow-sm card-hover">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-foreground">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                        Select Date
                    </h3>
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className={cn(
                                    "pill-input w-full bg-card border border-border rounded-full px-5 py-3 text-sm font-semibold text-foreground appearance-none focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all cursor-pointer flex items-center gap-2 text-left",
                                    !selectedDate && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Pick a date"}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-card border border-border rounded-2xl shadow-xl" align="start">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => date && setSelectedDate(date)}
                                className="rounded-md"
                            />
                        </PopoverContent>
                    </Popover>

                    {/* Quick date buttons */}
                    <div className="flex gap-2 mt-4">
                        <button
                            className="px-4 py-2 rounded-full border border-border bg-card text-sm font-bold hover:border-primary/30 hover:bg-primary/5 transition-all text-foreground"
                            onClick={() => setSelectedDate(new Date())}
                        >
                            Today
                        </button>
                        <button
                            className="px-4 py-2 rounded-full border border-border bg-card text-sm font-bold hover:border-primary/30 hover:bg-primary/5 transition-all text-foreground"
                            onClick={() => setSelectedDate(subDays(new Date(), 1))}
                        >
                            Yesterday
                        </button>
                    </div>
                </div>

                {/* Summary Card */}
                <div className="bg-card rounded-3xl border border-border p-6 shadow-sm card-hover flex flex-col justify-center">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-foreground">
                        <Filter className="h-5 w-5 text-primary" />
                        Overall Summary · {format(selectedDate, "MMM d")}
                    </h3>
                    {isLoading ? (
                        <LoadingShimmer rows={2} rowHeight="h-10" />
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                            {([
                                { key: "all" as StatusFilter, label: "Total", value: summary.total, color: "text-foreground", activeBg: "bg-primary/10 border-primary/30" },
                                { key: "Present" as StatusFilter, label: "Present", value: summary.present, color: "text-green-500", activeBg: "bg-green-500/10 border-green-500/30" },
                                { key: "Absent" as StatusFilter, label: "Absent", value: summary.absent, color: "text-red-500", activeBg: "bg-red-500/10 border-red-500/30" },
                                { key: "Late" as StatusFilter, label: "Late", value: summary.late, color: "text-yellow-500", activeBg: "bg-yellow-500/10 border-yellow-500/30" },
                                { key: "Leave" as StatusFilter, label: "Leave", value: summary.leave, color: "text-blue-500", activeBg: "bg-blue-500/10 border-blue-500/30" },
                                { key: "Unmarked" as StatusFilter, label: "Unmarked", value: summary.unmarked, color: "text-slate-500", activeBg: "bg-slate-500/10 border-slate-500/30" },
                            ]).map(({ key, label, value, color, activeBg }) => (
                                <button
                                    key={key}
                                    className={cn(
                                        "rounded-2xl p-3 cursor-pointer transition-all border text-center",
                                        statusFilter === key
                                            ? `${activeBg} border-current`
                                            : "bg-accent/30 border-transparent hover:bg-accent/60"
                                    )}
                                    onClick={() => setStatusFilter(key)}
                                >
                                    <p className={cn("text-2xl font-black", color)}>{value}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide mt-1">{label}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Supervisor Breakdown */}
            {!isLoading && allRecords.length > 0 && role === "admin" && (
                <div className="bg-card rounded-3xl border border-border p-6 shadow-sm card-hover">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-black flex items-center gap-2 text-foreground">
                            <UserCheck className="h-5 w-5 text-primary" />
                            Supervisor Breakdown
                        </h3>
                        {supervisorFilter && (
                            <button
                                onClick={() => setSupervisorFilter(null)}
                                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                                Clear Supervisor Filter
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(supervisorBreakdown).map(([name, stats]) => (
                            <button
                                key={name}
                                onClick={() => setSupervisorFilter(supervisorFilter === name ? null : name)}
                                className={cn(
                                    "rounded-2xl p-4 border transition-all flex flex-col gap-3 text-left w-full group",
                                    supervisorFilter === name
                                        ? "bg-primary/5 border-primary shadow-[0_0_20px_rgba(var(--primary),0.05)]"
                                        : "bg-accent/20 border-border hover:border-primary/30"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-foreground group-hover:text-primary transition-colors">{name}</span>
                                    <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                        supervisorFilter === name ? "bg-primary text-white" : "bg-primary/10 text-primary"
                                    )}>
                                        {stats.total} Students
                                    </span>
                                </div>
                                <div className="grid grid-cols-5 gap-1.5">
                                    <div className="text-center p-1.5 rounded-xl bg-green-500/5 border border-green-500/10">
                                        <p className="text-sm font-black text-green-500">{stats.present}</p>
                                        <p className="text-[8px] text-muted-foreground uppercase font-bold">Pres.</p>
                                    </div>
                                    <div className="text-center p-1.5 rounded-xl bg-red-500/5 border border-red-500/10">
                                        <p className="text-sm font-black text-red-500">{stats.absent}</p>
                                        <p className="text-[8px] text-muted-foreground uppercase font-bold">Abs.</p>
                                    </div>
                                    <div className="text-center p-1.5 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                                        <p className="text-sm font-black text-yellow-500">{stats.late}</p>
                                        <p className="text-[8px] text-muted-foreground uppercase font-bold">Late</p>
                                    </div>
                                    <div className="text-center p-1.5 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                        <p className="text-sm font-black text-blue-500">{stats.leave}</p>
                                        <p className="text-[8px] text-muted-foreground uppercase font-bold">Leave</p>
                                    </div>
                                    <div className="text-center p-1.5 rounded-xl bg-slate-500/5 border border-slate-500/10">
                                        <p className="text-sm font-black text-slate-500">{stats.unmarked}</p>
                                        <p className="text-[8px] text-muted-foreground uppercase font-bold">Unm.</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Records Table */}
            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col flex-1 card-hover">
                <div className="p-5 border-b border-border bg-accent/20 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-3">
                        <UserCheck className="h-5 w-5 text-primary" />
                        <span className="font-black text-foreground uppercase tracking-wide">
                            {statusFilter === "all" ? (supervisorFilter ? `${supervisorFilter}'s Students` : "All Records") : `${statusFilter} Students`}
                        </span>
                        <span className="text-sm font-semibold text-muted-foreground">({filteredRecords.length})</span>
                    </div>
                    {(statusFilter !== "all" || supervisorFilter) && (
                        <button
                            className="px-4 py-2 rounded-full border border-border bg-card text-sm font-bold hover:border-primary/30 hover:bg-primary/5 transition-all text-foreground"
                            onClick={() => {
                                setStatusFilter("all");
                                setSupervisorFilter(null);
                            }}
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto min-h-[300px]">
                    {isLoading ? (
                        <div className="p-6"><LoadingShimmer rows={5} rowHeight="h-14" /></div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="flex items-center justify-center p-12 text-muted-foreground font-semibold">
                            {records.length === 0
                                ? "No attendance recorded for this date."
                                : `No ${statusFilter.toLowerCase()} records for this date.`}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-accent/40 text-muted-foreground text-[10px] uppercase tracking-[0.1em] font-black">
                                <tr>
                                    <th className="px-6 py-4 border-b border-border">Student Name</th>
                                    <th className="px-6 py-4 border-b border-border">Reg. No.</th>
                                    <th className="px-6 py-4 border-b border-border">Teacher</th>
                                    <th className="px-6 py-4 text-center border-b border-border">Status</th>
                                    <th className="px-6 py-4 border-b border-border">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredRecords.map((record) => {
                                    const statusCfg = getStatusConfig(record.status);
                                    return (
                                        <tr key={record.id} className="group hover:bg-accent/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary border border-primary/20">
                                                        {(record.student?.full_name || "U").substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        {record.student?.id ? (
                                                            <Link
                                                                href={`/students/${record.student.id}`}
                                                                className="font-bold text-foreground text-[15px] group-hover:text-primary transition-colors hover:underline"
                                                            >
                                                                {record.student.full_name}
                                                            </Link>
                                                        ) : (
                                                            <span className="font-bold text-foreground text-[15px]">Unknown Student</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground font-semibold">
                                                #{record.student?.reg_no || "—"}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-foreground bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10">
                                                    {(() => {
                                                        const classes = (record.student as any)?.classes || [];
                                                        if (classes.length === 0) return "Unassigned";
                                                        const t = Array.isArray(classes[0].teacher) ? classes[0].teacher[0] : classes[0].teacher;
                                                        return t?.name || "Unassigned";
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
                                                    statusCfg.bg, statusCfg.text
                                                )}>
                                                    <span className={cn("w-2 h-2 rounded-full", statusCfg.dot, statusCfg.shadow)}></span>
                                                    {record.status === "Present" && <UserCheck className="h-3 w-3" />}
                                                    {record.status === "Absent" && <UserX className="h-3 w-3" />}
                                                    {record.status === "Late" && <Clock className="h-3 w-3" />}
                                                    {record.status === "Leave" && <CalendarOff className="h-3 w-3" />}
                                                    {(record.status as any) === "Unmarked" && <UserMinus className="h-3 w-3" />}
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground font-semibold">
                                                {record.remarks || "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AttendanceRecordsPage() {
    return (
        <Suspense fallback={<div className="flex h-full items-center justify-center p-8"><LoadingShimmer rows={3} rowHeight="h-16" /></div>}>
            <AttendanceRecordsContent />
        </Suspense>
    );
}
