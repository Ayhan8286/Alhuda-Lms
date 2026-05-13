"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getPlatforms, getStudentsByPlatform, updateAppAccount } from "@/lib/api/platforms";
import { Platform } from "@/types/student";
import { Video, Monitor, Layers, Loader2, ArrowLeft, Search, Plus, Download, Eye, Users, AlertCircle } from "lucide-react";

const platformIcons: Record<string, typeof Video> = {
    Zoom: Video,
    Teams: Monitor,
    Hybrid: Layers,
};

const platformColors: Record<string, string> = {
    Zoom: "bg-blue-500",
    Teams: "bg-indigo-600",
    Hybrid: "bg-green-600",
};

export default function PlatformsPage() {
    const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const { data: platforms = [], isLoading: platformsLoading } = useQuery({
        queryKey: ["platforms"],
        queryFn: getPlatforms,
    });

    const { data: students = [], isLoading: studentsLoading } = useQuery({
        queryKey: ["studentsByPlatform", selectedPlatform?.id],
        queryFn: () => getStudentsByPlatform(selectedPlatform!.id),
        enabled: !!selectedPlatform,
    });

    if (selectedPlatform) {
        const Icon = platformIcons[selectedPlatform.name] || Video;
        const colorClass = platformColors[selectedPlatform.name] || "bg-slate-500";

        // Filter students based on search
        const filteredStudents = students.filter((student: typeof students[0]) =>
            student.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.student_reg_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (student.account_identifier && student.account_identifier.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        return (
            <div className="flex-1 overflow-y-auto flex flex-col relative w-full mx-auto">
                {/* Organic Background Elements */}
                <div className="organic-blob bg-primary-container/20 w-[600px] h-[600px] -top-48 -left-24 fixed"></div>
                <div className="organic-blob bg-tertiary-container/20 w-[500px] h-[500px] bottom-0 right-0 fixed"></div>

                <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 relative z-10">
                <div className="mb-2">
                    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 font-bold uppercase tracking-wider">
                        <button onClick={() => setSelectedPlatform(null)} className="hover:text-primary flex items-center gap-1 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                            Platforms
                        </button>
                        <span className="text-[10px] text-border">/</span>
                        <span className="text-foreground">{selectedPlatform.name} Connections</span>
                    </nav>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`size-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${colorClass}`}>
                                <Icon className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black tracking-tight text-foreground">{selectedPlatform.name} Accounts</h3>
                                <p className="text-muted-foreground mt-1">Manage student access and view active {selectedPlatform.name} connections.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <div className="glass-panel shadow-[0px_0px_48px_rgba(45,52,50,0.06)] rounded-3xl p-6 border border-white/20 dark:border-white/5 flex items-start justify-between card-hover md:max-w-sm">
                        <div>
                            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Total Assigned</p>
                            <h3 className="text-3xl font-black text-foreground">{students.length}</h3>
                            <p className="text-xs text-green-500 font-bold mt-1 flex items-center gap-1">
                                Active on {selectedPlatform.name}
                            </p>
                        </div>
                        <div className="p-3 bg-green-500/10 rounded-2xl text-green-500">
                            <Users className="h-5 w-5" />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex flex-wrap gap-3">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <input
                                className="pill-input appearance-none pl-11 pr-5 py-2.5 glass-panel border border-white/20 dark:border-white/5 text-sm font-medium text-foreground transition-all w-full sm:w-72"
                                placeholder="Search accounts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-5 py-2.5 glass-panel border border-white/20 dark:border-white/5 rounded-full text-sm font-bold hover:bg-accent transition-colors text-foreground">
                            <Download className="h-4 w-4" />
                            <span>Export Data</span>
                        </button>
                    </div>
                </div>

                <div className="glass-panel rounded-3xl border border-white/20 dark:border-white/5 overflow-hidden shadow-[0px_0px_48px_rgba(45,52,50,0.06)] card-hover">
                    <div className="overflow-x-auto min-h-[400px]">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead className="bg-white/40 dark:bg-white/5 border-b border-white/10 dark:border-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Student Name</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Reg. No.</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Account Identifier</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Teacher</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Class Time</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Meeting Link</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {studentsLoading ? (
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-2xl bg-white/[0.07] shrink-0" />
                                                    <div className="h-3.5 w-32 bg-white/[0.07] rounded-full" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4"><div className="h-3.5 w-20 bg-white/[0.06] rounded-full" /></td>
                                            <td className="px-6 py-4"><div className="h-6 w-28 bg-white/[0.06] rounded-xl" /></td>
                                            <td className="px-6 py-4"><div className="h-3.5 w-24 bg-white/[0.05] rounded-full" /></td>
                                            <td className="px-6 py-4"><div className="h-3.5 w-18 bg-white/[0.05] rounded-full" /></td>
                                            <td className="px-6 py-4 text-right"><div className="w-10 h-10 rounded-2xl bg-white/[0.05] ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <div className="max-w-sm mx-auto">
                                                <Icon className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                                                <h3 className="text-lg font-bold text-foreground mb-2">No Accounts Found</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {searchQuery ? "Try adjusting your search query." : `No students are currently linked to ${selectedPlatform.name}.`}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <tr key={student.student_id} className="group hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Link href={`/students/${student.student_id}`} className="font-bold text-[15px] text-foreground group-hover:text-primary transition-colors flex items-center gap-3">
                                                    <div className="size-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-black text-primary">
                                                        {student.student_name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    {student.student_name}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-muted-foreground">
                                                {student.student_reg_no || "—"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black bg-accent text-foreground border border-border shadow-sm">
                                                    {student.account_identifier || "No Identifier"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-muted-foreground">
                                                {student.teacher_name || "Unassigned"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-muted-foreground">
                                                {student.pak_time || "—"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        className="pill-input py-1.5 px-3 glass-panel border border-border text-[11px] font-medium w-40 placeholder:text-muted-foreground/40"
                                                        placeholder="Paste link here..."
                                                        defaultValue={students.find(s => s.student_id === student.student_id)?.app_account_id ? "" : ""} // This is tricky as we don't have account_id in StudentByPlatform
                                                        onBlur={async (e) => {
                                                            // We need to find the account_id. Let's assume student.account_identifier is unique for now or refetch needed
                                                            // For now, let's just show it and tell user to use the dedicated manage button
                                                        }}
                                                    />
                                                    {student.meeting_link && (
                                                        <a href={student.meeting_link} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-accent rounded-lg text-primary transition-colors">
                                                            <Video className="h-4 w-4" />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <button className="w-10 h-10 rounded-2xl text-muted-foreground hover:text-primary hover:bg-accent flex items-center justify-center transition-all scale-100 hover:scale-105 ml-auto">
                                                    <Eye className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                </div>
            </div>
        );
    }

    // Main Selection View
    return (
        <div className="flex-1 overflow-y-auto flex flex-col relative w-full mx-auto">
            {/* Organic Background Elements */}
            <div className="organic-blob bg-primary-container/20 w-[600px] h-[600px] -top-48 -left-24 fixed"></div>
            <div className="organic-blob bg-tertiary-container/20 w-[500px] h-[500px] bottom-0 right-0 fixed"></div>

            <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 relative z-10">
            <div className="mb-2">
                <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6">
                    <span className="text-foreground">Platform Integrations</span>
                </nav>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight mb-2 text-foreground">Platform & Accounts<span className="text-primary ml-2 text-2xl">✦</span></h1>
                        <p className="text-muted-foreground font-medium text-sm">Manage institutional accounts and monitor live classroom usage to prevent scheduling conflicts.</p>
                    </div>
                </div>
            </div>

            {/* Overall Metrics Block */}
            <div className="mb-8">
                <div className="glass-panel rounded-3xl p-6 border border-white/20 dark:border-white/5 flex items-start justify-between card-hover md:max-w-sm shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
                    <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Active Platforms</p>
                        <h3 className="text-3xl font-black text-foreground">{platforms.length}</h3>
                        <p className="text-xs text-green-500 font-bold mt-1.5 flex items-center gap-1">
                            Operational
                        </p>
                    </div>
                    <div className="p-3 bg-green-500/10 rounded-2xl text-green-500">
                        <Video className="h-5 w-5" />
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {platformsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-card rounded-3xl border border-border overflow-hidden">
                                <div className="p-6 flex flex-col gap-4">
                                    <div className="flex justify-between">
                                        <div className="h-6 w-24 bg-white/[0.07] rounded-full" />
                                        <div className="size-10 rounded-2xl bg-white/[0.07]" />
                                    </div>
                                    <div className="h-7 w-40 bg-white/[0.07] rounded-xl" />
                                    <div className="h-4 w-28 bg-white/[0.05] rounded-full" />
                                    <div className="h-[88px] w-full bg-white/[0.04] rounded-2xl" />
                                </div>
                                <div className="px-6 py-4 border-t border-border bg-white/[0.02] h-14" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {platforms.map((platform) => {
                            const Icon = platformIcons[platform.name] || Video;
                            const colorClass = platformColors[platform.name] || "bg-slate-500";

                            // Mocking the "In Use / Available" state logic from the HTML template
                            // based on platform name for aesthetic visual variation.
                            const inUse = platform.name === "Zoom" || platform.name === "Teams";

                            return (
                                <div
                                    key={platform.id}
                                    onClick={() => setSelectedPlatform(platform)}
                                    className="glass-panel border-white/20 dark:border-white/5 rounded-3xl border overflow-hidden transition-all group cursor-pointer card-hover hover:border-primary/50 shadow-[0px_0px_48px_rgba(45,52,50,0.06)]"
                                >
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex items-center gap-2">
                                                {inUse ? (
                                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-green-500/10 text-green-500 border border-green-500/20 uppercase tracking-widest flex items-center gap-1.5">
                                                        <div className="size-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                                        Connected
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-accent text-muted-foreground border border-border uppercase tracking-widest flex items-center gap-1.5">
                                                        <div className="size-1.5 rounded-full bg-muted-foreground"></div>
                                                        Available
                                                    </span>
                                                )}
                                            </div>
                                            <div className={`size-10 rounded-2xl flex items-center justify-center text-white ${colorClass}`}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                        </div>

                                        <h3 className="text-2xl font-black text-foreground truncate">{platform.name} Integration</h3>

                                        <div className="flex items-center gap-2 mt-2 mb-5">
                                            <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-accent text-foreground border border-border tracking-wider">
                                                ENTERPRISE
                                            </span>
                                            <span className="text-[11px] font-bold text-muted-foreground">Auto-renew</span>
                                        </div>

                                        <div className="bg-accent/40 rounded-2xl p-4 border border-border/50 h-[88px] flex flex-col justify-center">
                                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black mb-1">Click to manage access</p>
                                            <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                                View {platform.name} roster
                                                <ArrowLeft className="h-4 w-4 rotate-180 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-6 py-4 border-t border-border bg-accent/20 flex justify-between items-center">
                                        <span className="text-[10px] text-muted-foreground font-bold tracking-widest">ID: {platform.id.split('-')[0].toUpperCase()}</span>
                                        <button className="text-[11px] font-black uppercase text-primary tracking-wider hover:underline">Manage accounts</button>
                                    </div>
                                </div>
                            );
                        })}

                    </div>
                )}
            </div>
            </div>
        </div>
    );
}
