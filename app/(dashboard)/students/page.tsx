"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getStudents, getStudentsBySupervisor, getStudentsByTeacher, deleteStudent } from "@/lib/api/students";
import { Student } from "@/types/student";
import { AddStudentDialog } from "@/components/dialogs/AddStudentDialog";
import { ManageStudentDialog } from "@/components/dialogs/ManageStudentDialog";
import { Users, UserPlus, Search, Plus, Loader2, Trash2, Eye, Edit2, Download, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { format } from "date-fns";
import { exportToCSV } from "@/lib/utils/csv";
import { STALE_LONG } from "@/lib/query-config";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";



export default function StudentsPage() {
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
    const role = typeof document !== 'undefined' ? document.cookie.split("; ").find(c => c.trim().startsWith("auth_role="))?.split("=")[1] : "admin";
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
            const cookies = document.cookie.split("; ");
            const role = cookies.find(c => c.trim().startsWith("auth_role="))?.split("=")[1];
            const supervisorId = cookies.find(c => c.trim().startsWith("supervisor_id="))?.split("=")[1];
            const teacherId = cookies.find(c => c.trim().startsWith("teacher_id="))?.split("=")[1];

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

    const filteredStudents = students; // Filtering now happens server-side

    if (error) {
        return <ErrorState message="Failed to load students. Please check your Supabase connection." onRetry={() => refetch()} />;
    }

    return (
        <div className="flex-1 overflow-y-auto flex flex-col relative w-full mx-auto">
            {/* Organic Background Elements */}
            <div className="organic-blob bg-primary-container/20 w-[600px] h-[600px] -top-48 -left-24 fixed"></div>
            <div className="organic-blob bg-tertiary-container/20 w-[500px] h-[500px] bottom-0 right-0 fixed"></div>

            <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 relative z-10">
            {/* Gen Z Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground mb-1">AL Huda Network</p>
                    <h1 className="text-3xl font-black tracking-tight text-foreground leading-none">
                        Students
                        <span className="text-primary ml-2 text-2xl">✦</span>
                    </h1>
                    <p className="text-muted-foreground mt-1.5 text-sm">Manage and view all enrolled students across the institution.</p>
                </div>
                {/* Conditional Admin Header Button */}
                <div className="flex-shrink-0">
                    <button
                        onClick={() => {
                            // Check role from cookies to prevent unauthorized dialog opening
                            const role = document.cookie.split("; ").find(c => c.trim().startsWith("auth_role="))?.split("=")[1];
                            if (role !== "supervisor" && role !== "teacher") {
                                setIsDialogOpen(true);
                            }
                        }}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 bg-forest hover:bg-forest/90 text-white font-black rounded-full text-sm fab-glow transition-all",
                            // Hide for supervisors and teachers
                            (typeof document !== 'undefined' && (document.cookie.includes("auth_role=supervisor") || document.cookie.includes("auth_role=teacher"))) && "hidden"
                        )}
                    >
                        <Plus className="h-4 w-4" />
                        Add New Student
                    </button>
                </div>
            </div>

            <AddStudentDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
            />
            <ManageStudentDialog
                studentId={selectedStudentId}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={() => refetch()}
            />


            {/* Gen Z KPI Cards */}
            <div className="flex items-center gap-3 mb-1">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Student Metrics</span>
                <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total Students", value: totalCount, sub: "In Library", accent: "#13ec37", Icon: Users },
                    { label: "Showing Results", value: students.length, sub: "This Page", accent: "#60a5fa", Icon: UserPlus },
                    { label: "Active Pool", value: students.filter((s: Student) => s.status?.toLowerCase() === 'active').length, sub: "Current view", accent: "#34d399", Icon: Users },
                    { label: "Inactive/Other", value: students.length - students.filter((s: Student) => s.status?.toLowerCase() === 'active').length, sub: "Current view", accent: "#f87171", Icon: Users },
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


            {/* Gen Z Search & Filter Bar */}
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
                    <button 
                        onClick={() => {
                            setSearchQuery("");
                            setStatusFilter("All Status");
                            setShiftFilter("All Shifts");
                        }}
                        className="px-4 py-2.5 text-sm font-bold text-primary hover:text-primary/70 transition-colors rounded-full hover:bg-primary/5"
                    >
                        Clear Filters
                    </button>
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

            <div className="glass-panel rounded-2xl border border-white/20 dark:border-white/5 overflow-hidden shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-white/40 dark:bg-white/5 border-b border-white/10 dark:border-white/5">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Name</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Courses</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Roll Number</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Guardian Info</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-white/[0.07] shrink-0" />
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="h-3.5 w-32 bg-white/[0.07] rounded-full" />
                                                    <div className="h-2.5 w-44 bg-white/[0.04] rounded-full" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4"><div className="h-5 w-28 bg-white/[0.06] rounded-lg" /></td>
                                        <td className="px-6 py-4"><div className="h-3.5 w-20 bg-white/[0.05] rounded-full" /></td>
                                        <td className="px-6 py-4"><div className="h-3.5 w-24 bg-white/[0.05] rounded-full" /></td>
                                        <td className="px-6 py-4"><div className="h-5 w-16 bg-white/[0.06] rounded-full" /></td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-8 h-8 rounded bg-white/[0.05]" />
                                                <div className="w-8 h-8 rounded bg-white/[0.05]" />
                                                <div className="w-8 h-8 rounded bg-white/[0.05]" />
                                            </div>
                                        </td>
                                    </tr>
                                ))

                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="max-w-sm mx-auto">
                                            <Users className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                                            <h3 className="text-lg font-bold text-foreground mb-2">No Students Found</h3>
                                            <p className="text-sm text-muted-foreground mb-6">
                                                {searchQuery ? "Try adjusting your search query." : "Register your first student to get started."}
                                            </p>
                                            {/* Hide button for supervisors and teachers */}
                                            {!(typeof document !== 'undefined' && (document.cookie.includes("auth_role=supervisor") || document.cookie.includes("auth_role=teacher"))) && (
                                                <button
                                                    onClick={() => setIsDialogOpen(true)}
                                                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary-hover transition-colors"
                                                >
                                                    Add New Student
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((student: Student, index: number) => {
                                    // Mock data avatars for visual polish matching design
                                    const mockAvatars = [
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuBDaC1fHTvvgBPee7HBpfHvJ7VLR7l1My9nm_CLK3cwK3xgEHhOzksFfspMx3A524PVHBlMsPNi1Qoqjh-lSlFyg1AldJrb3KGL2NQ9qsAyuq9UBCg9cijNPROL-KJR__68c_WQ5G63GzcgMQHpRU53MFFYhuIB5V8znbONxfuyEi8AUKwl1b434VYKsUA-Ke-k0rCjVGrFCU2uQBI-TmfIQ6BKaIcdXekqfJQzWXhzSx2uq5eppSCuLlth0UE6OtkAlReElTqEaUo",
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuDMzHwELeXHGsxIcUwE1xsb1qreHvnetgCa4jP9YdDTgj9ElavjIpg5HqLKMQCZvETc_fAMFkCfzbN900K-0SZdem-F2NsIIy_fyXEdyjc8l-raD2C36P0z7Uc39v34h05HAMnXj28CH0_0t3V1w6ZiYgNalpA_sjWre_BJsGiHwx0EvQSo3PpxKUMmJgtqhmu1zrc2yjdc68SnVqBPPvCf0VpGBTk3J0vuncSWniSk8TwQUrAm07mk7eESwUAZEDM7Xe1w7QuCITI",
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuCA33gnzW6KMzQKsUvc-F4EfpI5siOSbxGZM8ESVLJ4PLGpeHQBt0hSIXuWFGUDgmuY03iTp6IIAAkVIy9qYIvZojYYLyZV-tX1Z-18yUARtsHGZjuA5ycUsI-3Ti681odJ13ak55f6daEM6qxaW2cjPvSDCBauOKBWyIqpFuUahxB4KkbyPYRGDtSwZ4-AJCQhWrGzEpvlxcBp1YwRjsFfvVO24lQO4OSp_ToLjKbQbh6zgm7hKEF22PO_ti1zzqkRI7Xg3AYI2k4",
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuANX1BZK1e2zFlgHcypl9eEIG4VAAJnnCV3FtOFVvwdyrkUw6yiZd1HiW1xCkQHQ5wRCI9CJTyenHorbcu-pd5tWgszr_aGi2XlJWzHuwXx4N1cN2JYHt1avfn016MboBpigK-HEKORsD5SzCi-EDlu-8JwQrTf9gsBquWcVs6FQX2aMoBxU8fXcLIuvyFhYlrLihHbQrR6UYYnSuLBiQixj4CROPPeV4CUWHDTQaiDImDkytSd4eAkFLrl7xLwAINmHFbcohb_N58",
                                        "https://lh3.googleusercontent.com/aida-public/AB6AXuA1OZK7Pc1jBcgRsi3d0G5FIBSqKeapDa-RBSTCK2ntRtmomDrcA15L8Ki2PRSgIX9UR8gMLeNRuvesprnfm7CE3kDc_HH4Q8YIBy75QYysHItWtUA5CvzcxiTeSGoEljKJbnmZErsAV6rlVK5pbxm9DDlwzuuEdpJae63OV9rWNcxSFnd9Dh_gEtJVoStK_kKHRViS7sHsXWI7PNKHqc4RD5m4NUudfVq69UlOINrBmEXDdvNs1IcqYirTV0E2ksZrl2L0kU5nNTI"
                                    ];
                                    const avatarUrl = mockAvatars[index % mockAvatars.length];
                                    const mockEmail = `${student.full_name.toLowerCase().split(' ').join('.')}@qrastudy.edu`;
                                    const isActive = student.status?.toLowerCase() === 'active';

                                    return (
                                        <tr key={student.id} className="group hover:bg-slate-50/80 dark:hover:bg-[#1a331d]/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <img alt={student.full_name} className={`w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 bg-slate-100 ${!isActive ? 'grayscale opacity-70' : ''}`} src={avatarUrl} />
                                                        <span className={`absolute bottom-0 right-0 w-3 h-3 ${isActive ? 'bg-green-500' : 'bg-amber-500'} border-2 border-white dark:border-slate-900 rounded-full`}></span>
                                                    </div>
                                                    <div>
                                                        <Link href={`/students/${student.id}`} className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                                                            {student.full_name}
                                                        </Link>
                                                        <p className="text-xs text-muted-foreground font-medium">{mockEmail}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    {student.classes?.length ? (
                                                        student.classes.map((c, i) => (
                                                            c.course?.name && (
                                                                <span key={i} className="inline-max-w-[150px] truncate px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                                                    {c.course.name}
                                                                </span>
                                                            )
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">No active subjects</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-muted-foreground">
                                                {student.reg_no || "—"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                {student.guardian_name || "—"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {isActive ? (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-400 mr-1.5"></span>
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 opacity-90">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                                                        {student.status || "Inactive"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Link
                                                        href={`/students/${student.id}`}
                                                        className="w-8 h-8 rounded text-slate-400 hover:text-forest hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                                                        title="View Profile"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Link>
                                                    {!isSupervisor && !isTeacher && (
                                                        <>
                                                            <button
                                                                className="w-8 h-8 rounded text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                                                                title="Edit Student"
                                                                onClick={() => handleEditClick(student)}
                                                            >
                                                                <Edit2 className="h-4 w-4 font-light" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(student.id, student.full_name)}
                                                                disabled={deleteMutation.isPending}
                                                                className="w-8 h-8 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors disabled:opacity-50"
                                                                title="Remove Student"
                                                            >
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

                {totalCount > 0 && (
                    <div className="px-6 py-4 bg-slate-50 dark:bg-[#1a331d]/50 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-[#2a452e]">
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
                            Showing <span className="font-bold text-foreground">{(page - 1) * limit + 1}</span> to <span className="font-bold text-foreground">{Math.min(page * limit, totalCount)}</span> of <span className="font-bold text-foreground">{totalCount}</span> students
                        </p>
                        
                        {/* Pagination Controls */}
                        <div className="flex items-center gap-2 order-1 sm:order-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || isLoading}
                                className="w-10 h-10 flex items-center justify-center rounded-xl border border-border bg-card text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/30 transition-all"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                    // Basic pagination window logic
                                    let pageNum = i + 1;
                                    if (totalPages > 5 && page > 3) {
                                        pageNum = page - 3 + i;
                                        if (pageNum + (5 - i) > totalPages) pageNum = totalPages - 4 + i;
                                    }
                                    if (pageNum <= 0) return null;
                                    if (pageNum > totalPages) return null;

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={cn(
                                                "w-10 h-10 rounded-xl text-xs font-black transition-all",
                                                page === pageNum 
                                                    ? "bg-primary text-white shadow-md shadow-primary/20" 
                                                    : "bg-card border border-border text-foreground hover:border-primary/30"
                                            )}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || isLoading}
                                className="w-10 h-10 flex items-center justify-center rounded-xl border border-border bg-card text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/30 transition-all"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
        </div>
    );
}
