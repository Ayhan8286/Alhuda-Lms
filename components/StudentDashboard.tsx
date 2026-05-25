"use client";

import { useQuery } from "@tanstack/react-query";
import { getStudentById } from "@/lib/api/students";
import { getStudentAttendance } from "@/lib/api/attendance";
import { getStudentClasses } from "@/lib/api/classes";
import { getDailyReports } from "@/lib/api/reports";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import NotificationCenter from "@/components/NotificationCenter";
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  User, 
  GraduationCap, 
  Award, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  FileText,
  MessageSquare,
  ExternalLink,
  Loader2,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { RequestLeaveDialog } from "@/components/dialogs/RequestLeaveDialog";

export default function StudentDashboard({ 
    studentId 
}: { 
    studentId: string 
}) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'daily' | 'attendance' | 'performance' | 'monthly_class' | 'leave_requests'>('daily');
    const [isLeaveOpen, setIsLeaveOpen] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // 1. Fetch Student Details
    const { data: student, isLoading: isStudentLoading } = useQuery({
        queryKey: ["studentDetails", studentId],
        queryFn: () => getStudentById(studentId),
    });

    // 2. Fetch Student Attendance Records
    const { data: attendance = [], isLoading: isAttendanceLoading } = useQuery({
        queryKey: ["studentAttendance", studentId],
        queryFn: () => getStudentAttendance(studentId),
    });

    // 3. Fetch Class Timetable / Schedules
    const { data: classes = [], isLoading: isClassesLoading } = useQuery({
        queryKey: ["studentClasses", studentId],
        queryFn: () => getStudentClasses(studentId),
    });

    // 4. Fetch Monthly & Daily Reports
    const { data: reports = [], isLoading: isReportsLoading } = useQuery({
        queryKey: ["studentReports", studentId],
        queryFn: () => getDailyReports({ studentId }),
    });

    // 5. Fetch Leave Requests (Complaints where title starts with Leave Request)
    const { data: complaints = [], isLoading: isComplaintsLoading } = useQuery({
        queryKey: ["studentComplaints", studentId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("complaints")
                .select("*")
                .eq("student_id", studentId)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data || [];
        }
    });

    if (isStudentLoading || isAttendanceLoading || isClassesLoading || isReportsLoading || isComplaintsLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="mt-4 text-emerald-800/60 dark:text-emerald-200/60 text-sm font-medium">
                    Loading your personalized learning records...
                </p>
            </div>
        );
    }

    if (!student) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-6">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-foreground">Record Not Found</h3>
                <p className="text-muted-foreground text-sm text-center mt-2 max-w-sm">
                    We could not locate a student profile associated with your login session. Please contact support.
                </p>
            </div>
        );
    }

    // --- Calculations (Filtered to Current Calendar Month) ---
    const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-05"
    const currentMonthAttendance = attendance.filter(r => r.date && r.date.startsWith(currentMonthStr));

    const totalDays = currentMonthAttendance.length;
    const presentDays = currentMonthAttendance.filter(r => r.status === "Present").length;
    const lateDays = currentMonthAttendance.filter(r => r.status === "Late").length;
    const absentDays = currentMonthAttendance.filter(r => r.status === "Absent").length;
    const leaveDays = currentMonthAttendance.filter(r => r.status === "Leave").length;
    
    // Attendance percentage (Present + Late count positively, Late counts as present in most LMS metrics)
    const attendancePercentage = totalDays > 0 
        ? Math.round(((presentDays + lateDays) / totalDays) * 100) 
        : 100;

    // SVG Circle Calculations for r="70" => circum = 2 * PI * 70 = 439.82
    const dashArray = 439.82;
    const dashOffset = dashArray - (dashArray * attendancePercentage) / 100;

    // Filter reports by type
    const dailyReports = reports.filter(r => !r.report_type || r.report_type === 'daily');
    const attendanceReports = reports.filter(r => r.report_type === 'attendance');
    const performanceReports = reports.filter(r => r.report_type === 'performance');
    const monthlyClassReports = reports.filter(r => r.report_type === 'monthly_class');

    return (
        <div className="flex-1 flex flex-col min-h-screen relative font-body pb-12">
            {/* Background Mesh Elements */}
            <div className="organic-blob bg-primary-container/20 w-[400px] h-[400px] -top-24 -left-12" />
            <div className="organic-blob bg-secondary-container/10 w-[350px] h-[350px] bottom-12 right-12" />

            {/* Top Bar Header */}
            <header className="flex justify-between items-center px-6 md:px-10 py-6 w-full sticky top-0 z-20 glass-panel border-b border-white/20 dark:border-white/5">
                <div className="flex items-center space-x-2">
                    <BookOpen className="h-6 w-6 text-primary shrink-0" />
                    <h2 className="text-2xl font-black tracking-tight text-emerald-900 dark:text-emerald-50 brand-font">Student Portal</h2>
                </div>
                <div className="flex items-center space-x-4">
                    {mounted && (
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors text-emerald-800 dark:text-emerald-200"
                        >
                            <span className="material-symbols-outlined">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                        </button>
                    )}
                    <NotificationCenter userId={studentId} role="student" />
                </div>
            </header>

            {/* Main Bento Layout */}
            <div className="p-6 md:p-10 space-y-8 relative z-10 w-full max-w-7xl mx-auto">
                
                {/* 1. Welcome Glassmorphic Banner */}
                <div className="p-8 rounded-3xl glass-panel border border-white/30 dark:border-white/5 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary-hover dark:text-primary uppercase tracking-wider">
                            Active Student Profile
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-emerald-950 dark:text-white leading-tight">
                            Assalam o Alaikum, <span className="heading-gradient">{student.full_name}</span> 👋
                        </h1>
                        <p className="text-emerald-800/70 dark:text-emerald-200/70 font-medium">
                            Welcome back to your personalized learning academy! Here is your latest performance log.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                        <div className="px-4 py-3 bg-white/50 dark:bg-black/20 rounded-2xl border border-white/20 dark:border-white/5 min-w-[120px]">
                            <p className="text-[11px] text-emerald-800/60 dark:text-emerald-200/50 uppercase tracking-widest font-bold">Reg Number</p>
                            <p className="font-mono text-base mt-0.5">{student.reg_no}</p>
                        </div>
                        <div className="px-4 py-3 bg-white/50 dark:bg-black/20 rounded-2xl border border-white/20 dark:border-white/5 min-w-[120px]">
                            <p className="text-[11px] text-emerald-800/60 dark:text-emerald-200/50 uppercase tracking-widest font-bold">Assigned Shift</p>
                            <p className="text-base mt-0.5 capitalize">{student.shift || "Not Scheduled"}</p>
                        </div>
                    </div>
                </div>

                {/* Grid Content */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT COLUMN: Attendance Gauge & Timetable (Span 8) */}
                    <div className="lg:col-span-8 space-y-8">
                        
                        {/* 2. Visual Attendance Card */}
                        <div className="p-8 rounded-3xl glass-panel shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/20 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="space-y-4 max-w-sm text-center md:text-left">
                                <h3 className="text-xl font-extrabold text-emerald-900 dark:text-white">Attendance Rate (This Month)</h3>
                                <p className="text-sm text-emerald-800/70 dark:text-emerald-200/70 font-medium">
                                    Keeping consistent attendance builds strong learning habits. Your attendance is tracked live by your assigned teacher.
                                </p>
                                <div className="grid grid-cols-4 gap-2 text-center pt-2">
                                    <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{presentDays}</p>
                                        <p className="text-[10px] font-bold text-emerald-800/60 dark:text-emerald-200/60">Present</p>
                                    </div>
                                    <div className="p-2 bg-amber-500/10 dark:bg-amber-500/5 rounded-xl border border-amber-500/20">
                                        <p className="text-lg font-black text-amber-600 dark:text-amber-400">{lateDays}</p>
                                        <p className="text-[10px] font-bold text-amber-800/60 dark:text-emerald-200/60">Late</p>
                                    </div>
                                    <div className="p-2 bg-red-500/10 dark:bg-red-500/5 rounded-xl border border-red-500/20">
                                        <p className="text-lg font-black text-red-600 dark:text-red-400">{absentDays}</p>
                                        <p className="text-[10px] font-bold text-red-800/60 dark:text-emerald-200/60">Absent</p>
                                    </div>
                                    <div className="p-2 bg-blue-500/10 dark:bg-blue-500/5 rounded-xl border border-blue-500/20">
                                        <p className="text-lg font-black text-blue-600 dark:text-blue-400">{leaveDays}</p>
                                        <p className="text-[10px] font-bold text-emerald-800/60 dark:text-emerald-200/60">Leave</p>
                                    </div>
                                </div>
                            </div>

                            {/* SVG Radial Gauge */}
                            <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
                                <svg className="w-full h-full transform -rotate-90">
                                    {/* Track */}
                                    <circle
                                        cx="88"
                                        cy="88"
                                        r="70"
                                        className="stroke-emerald-100 dark:stroke-emerald-950/20"
                                        strokeWidth="14"
                                        fill="transparent"
                                    />
                                    {/* Colored Progress Ring */}
                                    <circle
                                        cx="88"
                                        cy="88"
                                        r="70"
                                        className="stroke-primary"
                                        strokeWidth="14"
                                        fill="transparent"
                                        strokeDasharray={dashArray}
                                        strokeDashoffset={dashOffset}
                                        strokeLinecap="round"
                                        style={{ transition: "stroke-dashoffset 1s ease" }}
                                    />
                                </svg>
                                <div className="absolute flex flex-col items-center justify-center">
                                    <span className="text-4xl font-black text-emerald-950 dark:text-white">{attendancePercentage}%</span>
                                    <span className="text-[10px] font-bold text-emerald-800/50 dark:text-emerald-200/50 uppercase tracking-widest mt-0.5">This Month</span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Class Timetable Card */}
                        <div className="p-8 rounded-3xl glass-panel shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/20 dark:border-white/5 space-y-6">
                            <div className="flex items-center justify-between border-b border-emerald-900/10 dark:border-white/10 pb-4">
                                <div className="flex items-center space-x-3">
                                    <span className="material-symbols-outlined text-primary p-2 bg-primary/10 rounded-xl" data-icon="calendar_month">calendar_month</span>
                                    <div>
                                        <h3 className="text-xl font-extrabold text-emerald-900 dark:text-white">Active Classroom Timetable</h3>
                                        <p className="text-xs text-emerald-800/60 dark:text-emerald-200/60 font-medium">Your scheduled courses and platforms</p>
                                    </div>
                                </div>
                            </div>

                            {classes.length === 0 ? (
                                <div className="py-8 text-center bg-white/20 dark:bg-black/10 rounded-2xl border border-dashed border-emerald-950/10 dark:border-white/10">
                                    <Calendar className="h-8 w-8 text-emerald-800/30 dark:text-emerald-200/30 mx-auto mb-2" />
                                    <p className="text-sm font-semibold text-emerald-950/70 dark:text-emerald-200/70">No Scheduled Classes</p>
                                    <p className="text-xs text-emerald-800/50 dark:text-emerald-200/50 mt-1">You are not assigned to any active online class right now.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                                    {classes.map((cls) => {
                                        const scheduleDaysList = cls.schedule_days ? Object.entries(cls.schedule_days).filter(([_, val]) => val).map(([day]) => day.substring(0, 3)) : [];
                                        const teacher = cls.teacher ? (Array.isArray(cls.teacher) ? cls.teacher[0] : cls.teacher) : null;
                                        const course = cls.course ? (Array.isArray(cls.course) ? cls.course[0] : cls.course) : null;
                                        const platform = cls.app_account ? (Array.isArray(cls.app_account) ? cls.app_account[0] : cls.app_account) : null;

                                        return (
                                            <div key={cls.id} className="p-5 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 hover:border-primary/30 dark:hover:border-primary/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-hover">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary-hover rounded-md border border-primary/20">
                                                            {course?.name || "LMS Course"}
                                                        </span>
                                                        {platform?.platform && (
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                                                via {platform.platform}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="text-base font-extrabold text-emerald-950 dark:text-white capitalize">
                                                        Class with {teacher?.name || "Teacher"}
                                                    </h4>
                                                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-medium text-emerald-800/60 dark:text-emerald-200/60">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            {cls.pak_start_time || "TBD"} - {cls.pak_end_time || "TBD"} (PKT)
                                                        </span>
                                                        {cls.uk_start_time && (
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3.5 w-3.5" />
                                                                {cls.uk_start_time} - {cls.uk_end_time} (UK)
                                                            </span>
                                                        )}
                                                    </div>
                                                    {scheduleDaysList.length > 0 && (
                                                        <div className="flex gap-1 pt-1">
                                                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
                                                                const isActive = scheduleDaysList.includes(d);
                                                                return (
                                                                    <span 
                                                                        key={d} 
                                                                        className={cn(
                                                                            "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                                                                            isActive 
                                                                                ? "bg-primary text-primary-foreground font-black" 
                                                                                : "bg-emerald-950/5 dark:bg-white/5 text-emerald-800/30 dark:text-emerald-200/20"
                                                                        )}
                                                                    >
                                                                        {d}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action Link */}
                                                {platform?.meeting_link ? (
                                                    <a 
                                                        href={platform.meeting_link} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="px-4 py-2.5 rounded-xl bg-forest dark:bg-emerald-600 hover:bg-forest/90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 hover:scale-[1.03]"
                                                    >
                                                        Join Classroom
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </a>
                                                ) : (
                                                    <button 
                                                        disabled
                                                        className="px-4 py-2.5 rounded-xl bg-emerald-950/5 dark:bg-white/5 text-emerald-800/40 dark:text-emerald-200/30 font-bold text-xs shrink-0 cursor-not-allowed border border-emerald-950/5 dark:border-white/5"
                                                    >
                                                        Link Unavailable
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Contact Panel & Sidebar Actions (Span 4) */}
                    <div className="lg:col-span-4 space-y-8">
                        
                        {/* 4. Staff Contacts Card */}
                        <div className="p-8 rounded-3xl glass-panel shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/20 dark:border-white/5 space-y-6">
                            <div>
                                <h3 className="text-xl font-extrabold text-emerald-900 dark:text-white">Assigned Faculty</h3>
                                <p className="text-xs text-emerald-800/60 dark:text-emerald-200/60 font-medium">Get in touch directly via LMS Chat</p>
                            </div>

                            <div className="space-y-4">
                                {/* Supervisor Info */}
                                <div className="p-4 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] text-emerald-800/50 dark:text-emerald-200/50 font-bold uppercase tracking-wider">LMS Supervisor</p>
                                            <p className="text-sm font-extrabold text-emerald-950 dark:text-white truncate">
                                                {student.supervisor?.name || "Not Assigned"}
                                            </p>
                                        </div>
                                    </div>
                                    <Link 
                                        href="/messages"
                                        className="w-full py-2 px-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-bold text-primary-hover dark:text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        Chat with Supervisor
                                    </Link>
                                </div>

                                {/* Teacher Info */}
                                {classes.length > 0 && (
                                    <div className="p-4 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary-hover flex items-center justify-center shrink-0">
                                                <GraduationCap className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] text-emerald-800/50 dark:text-emerald-200/50 font-bold uppercase tracking-wider">Assigned Teacher</p>
                                                <p className="text-sm font-extrabold text-emerald-950 dark:text-white truncate">
                                                    {classes[0]?.teacher?.name || "Academy Instructor"}
                                                </p>
                                            </div>
                                        </div>
                                        <Link 
                                            href="/messages"
                                            className="w-full py-2 px-3 rounded-xl bg-forest dark:bg-emerald-600 text-xs font-bold text-white hover:bg-forest/90 transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            Chat with Teacher
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Tips */}
                        <div className="p-6 rounded-3xl bg-forest dark:bg-emerald-950 text-emerald-100 border border-white/10 space-y-3 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Award className="h-24 w-24" />
                            </div>
                            <h4 className="text-sm font-black tracking-tight text-white uppercase tracking-wider">Islamic Values & Focus</h4>
                            <p className="text-xs leading-relaxed text-emerald-100/70 font-medium">
                                "The best among you are those who learn the Quran and teach it." Focus, consistency, and showing up every day are the keys to master your studies. Feel free to message your supervisor if you have questions!
                            </p>
                        </div>

                    </div>

                </div>

                {/* 5. Monthly Reports Section */}
                <div className="p-8 rounded-3xl glass-panel shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-white/20 dark:border-white/5 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-900/10 dark:border-white/10 pb-4">
                        <div className="flex items-center space-x-3">
                            <span className="material-symbols-outlined text-primary p-2 bg-primary/10 rounded-xl" data-icon="history_edu">history_edu</span>
                            <div>
                                <h3 className="text-xl font-extrabold text-emerald-900 dark:text-white">Academic Reports & Remarks</h3>
                                <p className="text-xs text-emerald-800/60 dark:text-emerald-200/60 font-medium">View detailed feedback, grades, and logs submitted by faculty</p>
                            </div>
                        </div>

                        {/* Report Selector Tabs */}
                        <div className="flex flex-wrap bg-emerald-950/5 dark:bg-black/20 p-1 rounded-xl gap-1 shrink-0">
                            {[
                                { id: 'daily', label: 'Daily Remarks' },
                                { id: 'attendance', label: 'Attendance Reports' },
                                { id: 'performance', label: 'Performance Progress' },
                                { id: 'monthly_class', label: 'Monthly Class' },
                                { id: 'leave_requests', label: 'Leave Requests' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                                        activeTab === tab.id
                                            ? "bg-white dark:bg-primary/20 text-emerald-950 dark:text-white shadow-sm"
                                            : "text-emerald-800/60 dark:text-emerald-200/40 hover:text-emerald-900 dark:hover:text-emerald-200"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Report Panels */}
                    <div className="space-y-4">
                        
                        {/* Daily Remarks Tab */}
                        {activeTab === 'daily' && (
                            dailyReports.length === 0 ? (
                                <EmptyReportState icon={FileText} title="No Daily Remarks Recorded" description="Your daily lesson remarks will show up here once submitted by your teacher." />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {dailyReports.map((report) => (
                                        <div key={report.id} className="p-5 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 space-y-3">
                                            <div className="flex justify-between items-start gap-2">
                                                <span className="text-xs font-black text-emerald-800/50 dark:text-emerald-200/40">
                                                    {report.date}
                                                </span>
                                                {report.metadata?.performanceGrade && (
                                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] uppercase">
                                                        Grade: {report.metadata.performanceGrade}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                                                {report.description}
                                            </p>
                                            
                                            {/* Micro fields */}
                                            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-emerald-800/60 dark:text-emerald-200/50 pt-2 border-t border-emerald-950/5 dark:border-white/5">
                                                {report.metadata?.surahOrBook && (
                                                    <p>Surah/Book: <span className="font-bold text-emerald-950 dark:text-white capitalize">{report.metadata.surahOrBook}</span></p>
                                                )}
                                                {report.metadata?.ayatOrPageFrom && (
                                                    <p>Ayat: <span className="font-mono text-emerald-950 dark:text-white">{report.metadata.ayatOrPageFrom} - {report.metadata.ayatOrPageTo}</span></p>
                                                )}
                                                {report.metadata?.namazCount !== undefined && (
                                                    <p>Namaz Count: <span className="font-bold text-emerald-950 dark:text-white">{report.metadata.namazCount}/5</span></p>
                                                )}
                                                {report.metadata?.durationMinutes && (
                                                    <p>Duration: <span className="font-bold text-emerald-950 dark:text-white">{report.metadata.durationMinutes} mins</span></p>
                                                )}
                                                {report.metadata?.behavior && (
                                                    <p className="col-span-2">Behavior: <span className="font-bold text-emerald-950 dark:text-white capitalize">{report.metadata.behavior}</span></p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* Attendance Reports Tab */}
                        {activeTab === 'attendance' && (
                            attendanceReports.length === 0 ? (
                                <EmptyReportState icon={Calendar} title="No Monthly Attendance Reports" description="Monthly aggregated attendance report cards from your instructor will be displayed here." />
                            ) : (
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {attendanceReports.map((report) => (
                                        <div key={report.id} className="p-6 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-base font-extrabold text-emerald-950 dark:text-white">
                                                        Attendance Aggregation
                                                    </h4>
                                                    <span className="text-xs font-bold text-emerald-800/60 dark:text-emerald-200/50">
                                                        for {report.date}
                                                    </span>
                                                </div>
                                                {report.description && (
                                                    <p className="text-sm font-medium text-emerald-800/70 dark:text-emerald-200/70">
                                                        Remarks: {report.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-3 font-semibold text-xs text-center">
                                                <div className="px-3 py-2 bg-emerald-500/10 rounded-xl">
                                                    <p className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{report.metadata?.presentDays || 0}</p>
                                                    <p className="text-[10px] text-emerald-800/60 dark:text-emerald-200/50">Presents</p>
                                                </div>
                                                <div className="px-3 py-2 bg-red-500/10 rounded-xl">
                                                    <p className="text-red-600 dark:text-red-400 font-extrabold text-sm">{report.metadata?.absentDays || 0}</p>
                                                    <p className="text-[10px] text-emerald-800/60 dark:text-emerald-200/50">Absents</p>
                                                </div>
                                                <div className="px-3 py-2 bg-primary/10 rounded-xl">
                                                    <p className="text-primary-hover dark:text-primary font-extrabold text-sm">{report.metadata?.attendancePercentage || 0}%</p>
                                                    <p className="text-[10px] text-emerald-800/60 dark:text-emerald-200/50">Ratio</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* Performance Tab */}
                        {activeTab === 'performance' && (
                            performanceReports.length === 0 ? (
                                <EmptyReportState icon={Award} title="No Performance Cards" description="Monthly grading notes, strengths, and weaknesses will appear here once analyzed." />
                            ) : (
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {performanceReports.map((report) => (
                                        <div key={report.id} className="p-6 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 space-y-4">
                                            <div className="flex justify-between items-center border-b border-emerald-950/5 dark:border-white/5 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-base font-extrabold text-emerald-950 dark:text-white">Monthly Grade Progress</h4>
                                                    <span className="text-xs font-semibold text-emerald-800/50 dark:text-emerald-200/40">({report.date})</span>
                                                </div>
                                                {report.metadata?.overallGrade && (
                                                    <span className="px-3 py-1 bg-primary text-primary-foreground font-black text-xs rounded-xl shadow-sm">
                                                        Grade: {report.metadata.overallGrade}
                                                    </span>
                                                )}
                                            </div>

                                            {report.description && (
                                                <p className="text-sm font-medium text-emerald-800/80 dark:text-emerald-200/80 leading-relaxed bg-white/30 dark:bg-black/10 p-3 rounded-xl">
                                                    {report.description}
                                                </p>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                                                {report.metadata?.memorizationProgress && (
                                                    <div className="space-y-1">
                                                        <p className="text-emerald-800/50 dark:text-emerald-200/50 text-[10px] uppercase tracking-wider">Quranic Memorization Progress</p>
                                                        <p className="text-emerald-950 dark:text-white font-bold">{report.metadata.memorizationProgress}</p>
                                                    </div>
                                                )}
                                                {report.metadata?.behaviorGrade && (
                                                    <div className="space-y-1">
                                                        <p className="text-emerald-800/50 dark:text-emerald-200/50 text-[10px] uppercase tracking-wider">Behavior & Ethics Rating</p>
                                                        <p className="text-emerald-950 dark:text-white font-bold">{report.metadata.behaviorGrade}</p>
                                                    </div>
                                                )}
                                                {report.metadata?.strengths && (
                                                    <div className="space-y-1">
                                                        <p className="text-emerald-800/50 dark:text-emerald-200/50 text-[10px] uppercase tracking-wider">Key Strengths</p>
                                                        <p className="text-emerald-950 dark:text-white font-bold">{report.metadata.strengths}</p>
                                                    </div>
                                                )}
                                                {report.metadata?.nextMonthGoals && (
                                                    <div className="space-y-1">
                                                        <p className="text-emerald-800/50 dark:text-emerald-200/50 text-[10px] uppercase tracking-wider">Suggested Targets & Goals</p>
                                                        <p className="text-emerald-950 dark:text-white font-bold">{report.metadata.nextMonthGoals}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* Monthly Class Reports Tab */}
                        {activeTab === 'monthly_class' && (
                            monthlyClassReports.length === 0 ? (
                                <EmptyReportState icon={FileText} title="No Class Reports Found" description="Overview reports covering classroom participation and recommendations will be populated here." />
                            ) : (
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {monthlyClassReports.map((report) => (
                                        <div key={report.id} className="p-6 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 space-y-4">
                                            <div className="flex justify-between items-center border-b border-emerald-950/5 dark:border-white/5 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-base font-extrabold text-emerald-950 dark:text-white">Classroom Participation Ledger</h4>
                                                    <span className="text-xs font-semibold text-emerald-800/50 dark:text-emerald-200/40">({report.date})</span>
                                                </div>
                                            </div>

                                            {report.description && (
                                                <p className="text-sm font-medium text-emerald-800/80 dark:text-emerald-200/80 leading-relaxed bg-white/30 dark:bg-black/10 p-3 rounded-xl">
                                                    {report.description}
                                                </p>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                                                {report.metadata?.participation && (
                                                    <div className="space-y-1">
                                                        <p className="text-emerald-800/50 dark:text-emerald-200/50 text-[10px] uppercase tracking-wider">Classroom Participation</p>
                                                        <p className="text-emerald-950 dark:text-white font-bold">{report.metadata.participation}</p>
                                                    </div>
                                                )}
                                                {report.metadata?.progressSummary && (
                                                    <div className="space-y-1">
                                                        <p className="text-emerald-800/50 dark:text-emerald-200/50 text-[10px] uppercase tracking-wider">Progress Summary</p>
                                                        <p className="text-emerald-950 dark:text-white font-bold">{report.metadata.progressSummary}</p>
                                                    </div>
                                                )}
                                                {report.metadata?.recommendations && (
                                                    <div className="space-y-1 col-span-1 md:col-span-2">
                                                        <p className="text-emerald-800/50 dark:text-emerald-200/50 text-[10px] uppercase tracking-wider">Instructor Recommendations</p>
                                                        <p className="text-emerald-950 dark:text-white font-bold leading-relaxed">{report.metadata.recommendations}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* Leave Requests Tab */}
                        {activeTab === 'leave_requests' && (
                            <div className="space-y-4">
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setIsLeaveOpen(true)}
                                        className="px-4 py-2.5 bg-forest hover:bg-forest/90 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm shrink-0 active:scale-95"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Request a Leave
                                    </button>
                                </div>
                                {complaints.filter(c => c.title && c.title.startsWith("Leave Request")).length === 0 ? (
                                    <EmptyReportState icon={Calendar} title="No Leave Requests Found" description="Submit your leave applications here to be approved directly by the administration." />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        {complaints.filter(c => c.title && c.title.startsWith("Leave Request")).map((req) => {
                                            const statusColors = {
                                                Pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                                                Resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", 
                                                Reviewed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" 
                                            };
                                            const statusLabel = {
                                                Pending: "Pending Approval",
                                                Resolved: "Approved",
                                                Reviewed: "Rejected"
                                            };
                                            
                                            // Parse dates and reason from description
                                            const dateRangeMatch = req.title.match(/Leave Request:\s*(.*)/);
                                            const dateRange = dateRangeMatch ? dateRangeMatch[1] : "Specified Dates";
                                            const reasonMatch = req.description.match(/Reason:\s*([\s\S]*)/);
                                            const cleanReason = reasonMatch ? reasonMatch[1].trim() : req.description;

                                            return (
                                                <div key={req.id} className="p-5 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 space-y-3 relative overflow-hidden text-left card-hover">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <span className="text-[10px] font-bold text-emerald-800/50 dark:text-emerald-200/40">
                                                            Requested {new Date(req.created_at).toLocaleDateString()}
                                                        </span>
                                                        <span className={cn("px-2.5 py-0.5 rounded border font-extrabold text-[10px] uppercase tracking-wider", statusColors[req.status as keyof typeof statusColors] || "bg-slate-100 text-slate-600 border-slate-200")}>
                                                            {statusLabel[req.status as keyof typeof statusLabel] || req.status}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-base font-extrabold text-emerald-950 dark:text-white flex items-center gap-1.5 leading-snug">
                                                        <Calendar className="h-4 w-4 text-primary shrink-0" />
                                                        {dateRange}
                                                    </h4>
                                                    <p className="text-xs font-semibold text-emerald-800/70 dark:text-emerald-200/70 bg-white/20 dark:bg-black/10 p-3 rounded-xl leading-relaxed whitespace-pre-line">
                                                        {cleanReason}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>

            </div>

            <RequestLeaveDialog 
                studentId={studentId}
                studentName={student.full_name}
                open={isLeaveOpen}
                onOpenChange={setIsLeaveOpen}
            />
        </div>
    );
}

// Subcomponents
function EmptyReportState({ 
    icon: Icon, 
    title, 
    description 
}: { 
    icon: any; 
    title: string; 
    description: string; 
}) {
    return (
        <div className="py-12 text-center bg-white/20 dark:bg-black/10 rounded-3xl border border-dashed border-emerald-950/10 dark:border-white/10 p-6">
            <Icon className="h-10 w-10 text-emerald-800/30 dark:text-emerald-200/30 mx-auto mb-3" />
            <p className="text-sm font-extrabold text-emerald-950 dark:text-white">{title}</p>
            <p className="text-xs text-emerald-800/50 dark:text-emerald-200/50 mt-1.5 max-w-sm mx-auto">{description}</p>
        </div>
    );
}
