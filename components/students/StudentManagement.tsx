"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getStudents, deleteStudent } from "@/lib/api/students";
import { Student } from "@/types/student";
import { AddStudentDialog } from "@/components/dialogs/AddStudentDialog";
import { ManageStudentDialog } from "@/components/dialogs/ManageStudentDialog";
import { Users, Search, Plus, Trash2, Edit2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { exportToCSV } from "@/lib/utils/csv";
import { STALE_LONG } from "@/lib/query-config";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";

export function StudentManagement() {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const initialStatus = searchParams.get("status") || "All Status";
    const initialShift = searchParams.get("shift") || "All Shifts";

    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState(initialStatus);
    const [shiftFilter, setShiftFilter] = useState(initialShift);
    const [page, setPage] = useState(1);
    const limit = 20;
    
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset page on filter change
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, statusFilter, shiftFilter]);

    const role = typeof document !== 'undefined' ? document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith("auth_role="))?.split("=")[1] : "admin";
    const isSupervisor = role === "supervisor";
    const isTeacher = role === "teacher";

    const handleEditClick = (student: Student) => {
        setSelectedStudentId(student.id);
        setIsEditOpen(true);
    };

    // Queries
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["students", debouncedSearch, statusFilter, shiftFilter, page],
        queryFn: async () => {
            const cookies = document.cookie.split(';').map(c => c.trim());
            const role = cookies.find(c => c.startsWith("auth_role="))?.split("=")[1];
            const supervisorId = cookies.find(c => c.startsWith("supervisor_id="))?.split("=")[1];
            const teacherId = cookies.find(c => c.startsWith("teacher_id="))?.split("=")[1];

            return await getStudents({
                page,
                limit,
                search: debouncedSearch,
                status: statusFilter,
                shift: shiftFilter,
                supervisorId: role === "supervisor" ? supervisorId : undefined,
                teacherId: role === "teacher" ? teacherId : undefined
            });
        },
        ...STALE_LONG,
    });

    const students = data?.data || [];
    const totalCount = data?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    const deleteMutation = useMutation({
        mutationFn: deleteStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["students"] });
        },
    });

    const handleDelete = (id: string, name: string) => {
        if (window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
            deleteMutation.mutate(id);
        }
    };

    const filteredStudents = students;

    if (error) {
        return <ErrorState message="Failed to load students. Please check your Supabase connection." onRetry={() => refetch()} />;
    }

    return (
        <div className="flex flex-col gap-6 relative z-10 w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground leading-none">
                        Student Directory
                        <span className="text-primary ml-2 text-xl">✦</span>
                    </h1>
                    <p className="text-muted-foreground mt-1.5 text-sm">Manage and view all enrolled students across the institution.</p>
                </div>
                <div className="flex-shrink-0">
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 bg-forest hover:bg-forest/90 text-white font-black rounded-full text-sm fab-glow transition-all",
                            (isSupervisor || isTeacher) && "hidden"
                        )}
                    >
                        <Plus className="h-4 w-4" />
                        Add New Student
                    </button>
                </div>
            </div>

            <AddStudentDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
            <ManageStudentDialog
                studentId={selectedStudentId}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={() => refetch()}
            />

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total Students", value: totalCount, sub: "In Library", accent: "#13ec37", Icon: Users },
                ].map(({ label, value, sub, accent, Icon }, i) => (
                    <div key={i} className="card-hover relative glass-panel rounded-3xl p-5 border border-white/20 dark:border-white/5 overflow-hidden group flex flex-col gap-3 shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
                        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-xl opacity-50 group-hover:opacity-80 transition-opacity" style={{ background: accent }} />
                        <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${accent}18` }}>
                            <Icon className="h-5 w-5" style={{ color: accent }} />
                        </div>
                        <div className="relative">
                            <p className="text-3xl font-black tracking-tight" style={{ color: accent }}>{value}</p>
                            <p className="text-[11px] font-bold text-foreground mt-1.5">{label}</p>
                            <p className="text-[10px] text-muted-foreground">{sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-3">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
                        <input
                            className="pill-input pl-10 pr-5 py-2.5 glass-panel border border-white/20 dark:border-white/5 text-sm text-foreground w-64 placeholder:text-muted-foreground/50"
                            placeholder="Search students..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select 
                        className="appearance-none pl-4 pr-10 py-2.5 glass-panel border border-white/20 dark:border-white/5 rounded-full text-sm font-semibold text-foreground cursor-pointer outline-none focus:ring-2 focus:ring-primary/20"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option>All Status</option>
                        <option>Active</option>
                        <option>Inactive</option>
                        <option>Trial</option>
                    </select>
                    <select 
                        className="appearance-none pl-4 pr-10 py-2.5 glass-panel border border-white/20 dark:border-white/5 rounded-full text-sm font-semibold text-foreground cursor-pointer outline-none focus:ring-2 focus:ring-primary/20"
                        value={shiftFilter}
                        onChange={(e) => setShiftFilter(e.target.value)}
                    >
                        <option>All Shifts</option>
                        <option>Morning</option>
                        <option>Night</option>
                    </select>
                </div>
                <button
                    onClick={() => exportToCSV(
                        filteredStudents.map(s => ({
                            "Full Name": s.full_name,
                            "Reg No": s.reg_no || "",
                            "Guardian Name": s.guardian_name || "",
                            "Status": s.status || "",
                            "Shift": s.shift || ""
                        })),
                        `students_${new Date().toISOString().slice(0, 10)}`
                    )}
                    className="flex items-center gap-2 px-4 py-2.5 glass-panel border border-white/20 dark:border-white/5 rounded-full text-sm font-bold hover:border-primary/30 transition-all text-foreground"
                >
                    <Download className="h-4 w-4" />
                    Export CSV
                </button>
            </div>

            {/* Table */}
            <div className="glass-panel rounded-2xl border border-white/20 dark:border-white/5 overflow-hidden shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-white/40 dark:bg-white/5 border-b border-white/10 dark:border-white/5">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Name</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Courses</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Platform</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Roll Number</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Guardian Info</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-10 w-40 bg-white/[0.07] rounded-full" /></td>
                                        <td className="px-6 py-4"><div className="h-5 w-28 bg-white/[0.06] rounded-lg" /></td>
                                        <td className="px-6 py-4"><div className="h-3.5 w-20 bg-white/[0.05] rounded-full" /></td>
                                        <td className="px-6 py-4"><div className="h-3.5 w-24 bg-white/[0.05] rounded-full" /></td>
                                        <td className="px-6 py-4"><div className="h-5 w-16 bg-white/[0.06] rounded-full" /></td>
                                        <td className="px-6 py-4 text-right"><div className="h-8 w-24 bg-white/[0.05] ml-auto rounded" /></td>
                                    </tr>
                                ))
                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <p className="text-muted-foreground">No students found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((student: Student, index: number) => {
                                    const mockAvatars = [
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuBDaC1fHTvvgBPee7HBpfHvJ7VLR7l1My9nm_CLK3cwK3xgEHhOzksFfspMx3A524PVHBlMsPNi1Qoqjh-lSlFyg1AldJrb3KGL2NQ9qsAyuq9UBCg9cijNPROL-KJR__68c_WQ5G63GzcgMQHpRU53MFFYhuIB5V8znbONxfuyEi8AUKwl1b434VYKsUA-Ke-k0rCjVGrFCU2uQBI-TmfIQ6BKaIcdXekqfJQzWXhzSx2uq5eppSCuLlth0UE6OtkAlReElTqEaUo",
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuDMzHwELeXHGsxIcUwE1xsb1qreHvnetgCa4jP9YdDTgj9ElavjIpg5HqLKMQCZvETc_fAMFkCfzbN900K-0SZdem-F2NsIIy_fyXEdyjc8l-raD2C36P0z7Uc39v34h05HAMnXj28CH0_0t3V1w6ZiYgNalpA_sjWre_BJsGiHwx0EvQSo3PpxKUMmJgtqhmu1zrc2yjdc68SnVqBPPvCf0VpGBTk3J0vuncSWniSk8TwQUrAm07mk7eESwUAZEDM7Xe1w7QuCITI",
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuCA33gnzW6KMzQKsUvc-F4EfpI5siOSbxGZM8ESVLJ4PLGpeHQBt0hSIXuWFGUDgmuY03iTp6IIAAkVIy9qYIvZojYYLyZV-tX1Z-18yUARtsHGZjuA5ycUsI-3Ti681odJ13ak55f6daEM6qxaW2cjPvSDCBauOKBWyIqpFuUahxB4KkbyPYRGDtSwZ4-AJCQhWrGzEpvlxcBp1YwRjsFfvVO24lQO4OSp_ToLjKbQbh6zgm7hKEF22PO_ti1zzqkRI7Xg3AYI2k4"
                                    ];
                                    const avatarUrl = mockAvatars[index % mockAvatars.length];
                                    const isActive = student.status?.toLowerCase() === 'active';

                                    return (
                                        <tr key={student.id} className="group hover:bg-slate-50/80 dark:hover:bg-[#1a331d]/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <img src={avatarUrl} className="w-10 h-10 rounded-full bg-slate-100" />
                                                    <Link href={`/students/${student.id}`} className="font-bold text-sm text-foreground hover:text-primary transition-colors">
                                                        {student.full_name}
                                                    </Link>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                {student.classes?.map(c => c.course?.name).join(", ") || "No active subjects"}
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                {Array.from(new Set(student.classes?.map(c => c.app_account?.platform).filter(Boolean))).join(", ") || "Direct"}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono font-bold text-muted-foreground">{student.reg_no || "—"}</td>
                                            <td className="px-6 py-4 text-sm text-muted-foreground">{student.guardian_name || "—"}</td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-bold",
                                                    isActive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"
                                                )}>
                                                    {student.status || "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {!isSupervisor && !isTeacher && (
                                                        <>
                                                            <button onClick={() => handleEditClick(student)} className="p-2 text-slate-400 hover:text-primary transition-colors" title="Manage Student">
                                                                <Edit2 className="h-4 w-4" />
                                                            </button>
                                                            <button onClick={() => handleDelete(student.id, student.full_name)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Delete Student">
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalCount > 0 && (
                    <div className="px-6 py-4 bg-slate-50 dark:bg-[#1a331d]/50 flex items-center justify-between border-t border-border">
                        <p className="text-sm text-muted-foreground">
                            Showing <span className="font-bold text-foreground">{(page - 1) * limit + 1}</span> to <span className="font-bold text-foreground">{Math.min(page * limit, totalCount)}</span> of <span className="font-bold text-foreground">{totalCount}</span>
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border rounded-xl disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 border rounded-xl disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
