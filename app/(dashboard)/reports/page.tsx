"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
    Search, 
    User, 
    Clock, 
    Calendar as CalendarIcon,
    Loader2,
    CheckCircle2,
    Plus,
    Users,
    MessageSquareQuote,
    Filter,
    Shield,
    BookOpen,
    History
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStudentsForReporting, getDailyReports, DailyReport } from "@/lib/api/reports";
import { submitDailyReportAction } from "@/lib/actions/reports";
import { getSupervisors } from "@/lib/api/supervisors";
import { getTeachers } from "@/lib/api/classes";
import { LoadingShimmer } from "@/components/ui/LoadingShimmer";
import { toast } from "sonner";
import { generateMonthlyReportPDF } from "@/lib/utils/pdf-generator";
import { FileDown } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function DailyReportsPage() {
    const queryClient = useQueryClient();
    const [isMounted, setIsMounted] = useState(false);
    const [authRole, setAuthRole] = useState<string | null>(null);
    const [authSupervisorId, setAuthSupervisorId] = useState<string | undefined>(undefined);
    const [authTeacherId, setAuthTeacherId] = useState<string | undefined>(undefined);

    // Supervisor Interaction State
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [selectedStudentForReport, setSelectedStudentForReport] = useState<any>(null);
    const [supervisorTeacherFilter, setSupervisorTeacherFilter] = useState<string>("All");
    const [studentSearch, setStudentSearch] = useState("");

    // Form State - Report Type
    const [reportType, setReportType] = useState<'daily' | 'attendance' | 'performance' | 'monthly_class'>('daily');

    // Form State (Inside Dialog - Daily)
    const [reportDate, setReportDate] = useState<Date>(new Date());
    const [reportTime, setReportTime] = useState(format(new Date(), "hh:mm a"));
    const [description, setDescription] = useState("");
    const [lessonType, setLessonType] = useState<string>("Nazra");
    const [surahOrBook, setSurahOrBook] = useState<string>("");
    const [ayatOrPageFrom, setAyatOrPageFrom] = useState<string>("");
    const [ayatOrPageTo, setAyatOrPageTo] = useState<string>("");
    const [performanceGrade, setPerformanceGrade] = useState<string>("Good");
    const [namazCount, setNamazCount] = useState<string>("5");
    const [durationMinutes, setDurationMinutes] = useState<string>("30");
    const [lessonPractice, setLessonPractice] = useState<string>("Yes");
    const [behavior, setBehavior] = useState<string>("Very Good");
    const [attendanceStatus, setAttendanceStatus] = useState<string>("Present");
    const [sittingArrangement, setSittingArrangement] = useState<string>("Acceptable");
    const [memorizationLesson, setMemorizationLesson] = useState<string>("");

    // Form State (Inside Dialog - Attendance)
    const [totalClasses, setTotalClasses] = useState("20");
    const [presentDays, setPresentDays] = useState("20");
    const [absentDays, setAbsentDays] = useState("0");
    const [lateDays, setLateDays] = useState("0");

    // Form State (Inside Dialog - Performance)
    const [overallGrade, setOverallGrade] = useState("Good");
    const [memorizationProgress, setMemorizationProgress] = useState("Good");
    const [behaviorGrade, setBehaviorGrade] = useState("Good");
    const [strengths, setStrengths] = useState("");
    const [weaknesses, setWeaknesses] = useState("");
    const [nextMonthGoals, setNextMonthGoals] = useState("");

    // Form State (Inside Dialog - Monthly Class)
    const [classGrade, setClassGrade] = useState("Good");
    const [participation, setParticipation] = useState("Active");
    const [progressSummary, setProgressSummary] = useState("");
    const [recommendations, setRecommendations] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    // Admin Filter State & View State
    const [filterSupervisorId, setFilterSupervisorId] = useState<string>("All");
    const [filterTeacherId, setFilterTeacherId] = useState<string>("All");
    const [filterStudentId, setFilterStudentId] = useState<string>("All");
    const [filterDate, setFilterDate] = useState<Date>(new Date());
    const [adminActiveTab, setAdminActiveTab] = useState<'feed' | 'tracker'>('tracker');

    // View Modal State
    const [viewingReport, setViewingReport] = useState<DailyReport | null>(null);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

    useEffect(() => {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const role = cookies.find(c => c.startsWith("auth_role="))?.split("=")[1] || "admin";
        const supId = cookies.find(c => c.startsWith("supervisor_id="))?.split("=")[1];
        const tId = cookies.find(c => c.startsWith("teacher_id="))?.split("=")[1];
        setAuthRole(role);
        setAuthSupervisorId(supId);
        setAuthTeacherId(tId);
        setIsMounted(true);
    }, []);

    const isAdmin = authRole === "admin";
    const isSupervisor = authRole === "supervisor";

    // Queries
    const { data: students = [], isLoading: isLoadingStudents } = useQuery({
        queryKey: ["studentsForReporting", authSupervisorId, authTeacherId],
        queryFn: () => getStudentsForReporting(
            isSupervisor ? authSupervisorId : undefined,
            authRole === "teacher" ? authTeacherId : undefined
        ),
        enabled: isMounted && !!authRole
    });

    const { data: supervisors = [] } = useQuery({
        queryKey: ["supervisors"],
        queryFn: () => getSupervisors(),
        enabled: isMounted && isAdmin
    });

    const { data: teachers = [] } = useQuery({
        queryKey: ["teachers"],
        queryFn: getTeachers,
        enabled: isMounted && !!authRole
    });

    // Helper date bounds for reports query
    const startOfFilterMonth = format(new Date(filterDate.getFullYear(), filterDate.getMonth(), 1), "yyyy-MM-dd");
    const endOfFilterMonth = format(new Date(filterDate.getFullYear(), filterDate.getMonth() + 1, 0), "yyyy-MM-dd");

    // Monthly query for supervisor/teacher context
    const startOfMonthStr = format(new Date(filterDate.getFullYear(), filterDate.getMonth(), 1), "yyyy-MM-dd");
    const endOfMonthStr = format(new Date(filterDate.getFullYear(), filterDate.getMonth() + 1, 0), "yyyy-MM-dd");

    const { data: monthlyReports = [], isLoading: isLoadingMonthlyReports } = useQuery({
        queryKey: ["monthlyReports", authSupervisorId, authTeacherId, startOfMonthStr, endOfMonthStr],
        queryFn: () => getDailyReports({
            startDate: startOfMonthStr,
            endDate: endOfMonthStr,
            supervisorId: isSupervisor ? authSupervisorId : undefined,
            teacherId: authRole === "teacher" ? authTeacherId : undefined,
        }),
        enabled: isMounted && !!authRole && !isAdmin
    });

    // Fetch reports for admin/feed
    const { data: reports = [], isLoading: isLoadingReports } = useQuery({
        queryKey: ["dailyReports", isAdmin ? filterSupervisorId : authSupervisorId, authRole === "teacher" ? authTeacherId : filterTeacherId, filterStudentId, startOfFilterMonth, endOfFilterMonth],
        queryFn: () => getDailyReports({
            startDate: startOfFilterMonth,
            endDate: endOfFilterMonth,
            supervisorId: isAdmin ? (filterSupervisorId === "All" ? undefined : filterSupervisorId) : authSupervisorId,
            teacherId: authRole === "teacher" ? authTeacherId : (filterTeacherId === "All" ? undefined : filterTeacherId),
            studentId: filterStudentId === "All" ? undefined : filterStudentId
        }),
        enabled: isMounted && !!authRole
    });

    const handleDownloadPDF = async () => {
        if (filterStudentId === "All") {
            toast.error("Please select a specific student to generate a monthly report.");
            return;
        }
        
        const student = students.find(s => s.id === filterStudentId);
        const loadingToast = toast.loading("Fetching monthly records and generating PDF...");
        
        try {
            const startOfMonth = format(new Date(filterDate.getFullYear(), filterDate.getMonth(), 1), "yyyy-MM-dd");
            const endOfMonth = format(new Date(filterDate.getFullYear(), filterDate.getMonth() + 1, 0), "yyyy-MM-dd");
            
            const monthlyReports = await getDailyReports({
                startDate: startOfMonth,
                endDate: endOfMonth,
                studentId: filterStudentId
            });
            
            if (monthlyReports.length === 0) {
                toast.dismiss(loadingToast);
                toast.error("No reports found for this student in the selected month.");
                return;
            }
            
            const monthName = format(filterDate, "MMMM yyyy");
            await generateMonthlyReportPDF(monthlyReports, student?.full_name || "Student", student?.reg_no || "N/A", monthName);
            toast.dismiss(loadingToast);
            toast.success("Monthly report generated successfully!");
        } catch (error) {
            toast.dismiss(loadingToast);
            console.error(error);
            toast.error("Failed to generate report.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudentForReport) return;

        setIsSubmitting(true);
        try {
            const teacherId = selectedStudentForReport.teacher?.id;
            const supervisorId = selectedStudentForReport.supervisor_id || authSupervisorId;

            if (!teacherId || !supervisorId) {
                toast.error("This student is missing a teacher or supervisor assignment. Please contact admin.");
                setIsSubmitting(false);
                return;
            }

            // Normalization of date for monthly reports
            let finalDate = format(reportDate, "yyyy-MM-dd");
            if (reportType !== 'daily') {
                const d = new Date(reportDate.getFullYear(), reportDate.getMonth(), 1);
                finalDate = format(d, "yyyy-MM-dd");
            }

            // Prepare metadata and description based on reportType
            let reportMetadata: any = {};
            let reportDescription = description;

            if (reportType === 'daily') {
                reportMetadata = {
                    lessonType,
                    surahOrBook,
                    ayatOrPageFrom,
                    ayatOrPageTo,
                    performanceGrade,
                    namazCount: parseInt(namazCount),
                    durationMinutes: parseInt(durationMinutes),
                    lessonPractice,
                    behavior,
                    attendanceStatus,
                    sittingArrangement,
                    memorizationLesson
                };
            } else if (reportType === 'attendance') {
                const total = parseInt(totalClasses) || 0;
                const present = parseInt(presentDays) || 0;
                const absent = parseInt(absentDays) || 0;
                const late = parseInt(lateDays) || 0;
                const pct = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 100;
                
                reportMetadata = {
                    totalClasses: total,
                    presentDays: present,
                    absentDays: absent,
                    lateDays: late,
                    attendancePercentage: pct
                };
                if (!reportDescription) {
                    reportDescription = `Monthly Attendance: ${present}/${total} Days Present (${pct}%).`;
                }
            } else if (reportType === 'performance') {
                reportMetadata = {
                    overallGrade,
                    memorizationProgress,
                    behaviorGrade,
                    strengths,
                    weaknesses,
                    nextMonthGoals
                };
                if (!reportDescription) {
                    reportDescription = `Monthly Performance: Grade ${overallGrade}. Memorization: ${memorizationProgress}. Behavior: ${behaviorGrade}.`;
                }
            } else if (reportType === 'monthly_class') {
                reportMetadata = {
                    classGrade,
                    participation,
                    progressSummary,
                    recommendations
                };
                if (!reportDescription) {
                    reportDescription = `Monthly Class Report: Grade ${classGrade}. Participation: ${participation}.`;
                }
            }

            await submitDailyReportAction({
                student_id: selectedStudentForReport.id,
                teacher_id: teacherId,
                supervisor_id: supervisorId,
                date: finalDate,
                time: reportTime,
                description: reportDescription,
                report_type: reportType,
                metadata: reportMetadata
            });

            setSubmitSuccess(true);
            toast.success(`${reportType === 'daily' ? 'Daily' : 'Monthly'} report submitted successfully!`);
            
            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ["dailyReports"] });
            queryClient.invalidateQueries({ queryKey: ["monthlyReports"] });
            
            setTimeout(() => {
                setSubmitSuccess(false);
                setIsReportDialogOpen(false);
            }, 1000);
        } catch (error) {
            console.error("Failed to submit report:", error);
            toast.error("Failed to submit report. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenReport = (student: any) => {
        setSelectedStudentForReport(student);
        setReportType('daily');
        setReportDate(new Date());
        setReportTime(format(new Date(), "hh:mm a"));
        setIsReportDialogOpen(true);
    };

    // Effect to sync form fields when student, date, or report type changes
    useEffect(() => {
        if (!selectedStudentForReport) return;
        
        let targetDate = format(reportDate, "yyyy-MM-dd");
        if (reportType !== 'daily') {
            const d = new Date(reportDate.getFullYear(), reportDate.getMonth(), 1);
            targetDate = format(d, "yyyy-MM-dd");
        }

        const sourceList = isAdmin ? reports : monthlyReports;
        const existingReport = sourceList.find(r => 
            r.student_id === selectedStudentForReport.id && 
            r.date === targetDate && 
            (r.report_type || 'daily') === reportType
        );

        if (existingReport) {
            setDescription(existingReport.description || "");
            setReportTime(existingReport.time || format(new Date(), "hh:mm a"));
            
            if (reportType === 'daily') {
                setLessonType(existingReport.metadata?.lessonType || "Nazra");
                setSurahOrBook(existingReport.metadata?.surahOrBook || "");
                setAyatOrPageFrom(existingReport.metadata?.ayatOrPageFrom || "");
                setAyatOrPageTo(existingReport.metadata?.ayatOrPageTo || "");
                setPerformanceGrade(existingReport.metadata?.performanceGrade || "Good");
                setNamazCount(existingReport.metadata?.namazCount?.toString() || "5");
                setDurationMinutes(existingReport.metadata?.durationMinutes?.toString() || "30");
                setLessonPractice(existingReport.metadata?.lessonPractice || "Yes");
                setBehavior(existingReport.metadata?.behavior || "Very Good");
                setAttendanceStatus(existingReport.metadata?.attendanceStatus || "Present");
                setSittingArrangement(existingReport.metadata?.sittingArrangement || "Acceptable");
                setMemorizationLesson(existingReport.metadata?.memorizationLesson || "");
            } else if (reportType === 'attendance') {
                setTotalClasses(existingReport.metadata?.totalClasses?.toString() || "20");
                setPresentDays(existingReport.metadata?.presentDays?.toString() || "20");
                setAbsentDays(existingReport.metadata?.absentDays?.toString() || "0");
                setLateDays(existingReport.metadata?.lateDays?.toString() || "0");
            } else if (reportType === 'performance') {
                setOverallGrade(existingReport.metadata?.overallGrade || "Good");
                setMemorizationProgress(existingReport.metadata?.memorizationProgress || "Good");
                setBehaviorGrade(existingReport.metadata?.behaviorGrade || "Good");
                setStrengths(existingReport.metadata?.strengths || "");
                setWeaknesses(existingReport.metadata?.weaknesses || "");
                setNextMonthGoals(existingReport.metadata?.nextMonthGoals || "");
            } else if (reportType === 'monthly_class') {
                setClassGrade(existingReport.metadata?.classGrade || "Good");
                setParticipation(existingReport.metadata?.participation || "Active");
                setProgressSummary(existingReport.metadata?.progressSummary || "");
                setRecommendations(existingReport.metadata?.recommendations || "");
            }
        } else {
            // Reset to defaults
            setDescription("");
            setReportTime(format(new Date(), "hh:mm a"));
            
            setLessonType("Nazra");
            setSurahOrBook("");
            setAyatOrPageFrom("");
            setAyatOrPageTo("");
            setPerformanceGrade("Good");
            setNamazCount("5");
            setDurationMinutes("30");
            setLessonPractice("Yes");
            setBehavior("Very Good");
            setAttendanceStatus("Present");
            setSittingArrangement("Acceptable");
            setMemorizationLesson("");

            setTotalClasses("20");
            setPresentDays("20");
            setAbsentDays("0");
            setLateDays("0");

            setOverallGrade("Good");
            setMemorizationProgress("Good");
            setBehaviorGrade("Good");
            setStrengths("");
            setWeaknesses("");
            setNextMonthGoals("");

            setClassGrade("Good");
            setParticipation("Active");
            setProgressSummary("");
            setRecommendations("");
        }
    }, [selectedStudentForReport, reportDate, reportType, monthlyReports, reports, isAdmin]);

    const targetMonthDate = reportType === 'daily'
        ? format(reportDate, "yyyy-MM-dd")
        : format(new Date(reportDate.getFullYear(), reportDate.getMonth(), 1), "yyyy-MM-dd");

    const sourceList = isAdmin ? reports : monthlyReports;
    const hasExistingMonthly = reportType !== 'daily' && selectedStudentForReport && sourceList.some(r => 
        r.student_id === selectedStudentForReport.id && 
        r.date === targetMonthDate && 
        r.report_type === reportType
    );

    if (!isMounted || !authRole) {
        return (
            <div className="w-full h-[60vh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
            </div>
        );
    }

    // Filter students for supervisor view
    const filteredStudents = students.filter(s => {
        const matchesTeacher = supervisorTeacherFilter === "All" || s.teacher?.id === supervisorTeacherFilter;
        const matchesSearch = s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) || s.reg_no.includes(studentSearch);
        return matchesTeacher && matchesSearch;
    });

    return (
        <div className="w-full mx-auto p-4 sm:p-6 lg:p-10 flex flex-col gap-8 font-display">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-foreground leading-none">
                        Student <span className="text-primary italic">Reports</span>
                    </h1>
                    <p className="text-muted-foreground mt-3 text-sm max-w-md font-medium">
                        {(isSupervisor || authRole === "teacher") 
                            ? "Select a student to log daily or monthly reports."
                            : "Overview of student progress and report tracking."}
                    </p>
                </div>

                {(isSupervisor || authRole === "teacher") && (
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input 
                                type="text"
                                placeholder="Search students..."
                                className="w-full h-12 rounded-2xl border border-border bg-card pl-11 pr-4 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                            />
                        </div>
                        {authRole !== "teacher" && (
                            <div className="w-full sm:w-56">
                                <Select value={supervisorTeacherFilter} onValueChange={setSupervisorTeacherFilter}>
                                    <SelectTrigger className="h-12 rounded-2xl border-border bg-card px-4 font-bold text-sm shadow-sm">
                                        <User className="h-4 w-4 mr-2 text-primary" />
                                        <SelectValue placeholder="All Teachers" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-border shadow-2xl">
                                        <SelectItem value="All">All Teachers</SelectItem>
                                        {teachers
                                            .filter(t => t.supervisor_id === authSupervisorId)
                                            .map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Supervisor View: ONLY Student List and Popup */}
            {(isSupervisor || authRole === "teacher") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {isLoadingStudents || isLoadingMonthlyReports ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-40 rounded-[32px] bg-accent/20 animate-pulse" />
                        ))
                    ) : filteredStudents.length === 0 ? (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-card/50 rounded-[32px] border-2 border-dashed border-border">
                            <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                            <p className="text-lg font-black text-foreground">No students assigned</p>
                        </div>
                    ) : (
                        filteredStudents.map((student) => {
                            const isReportedToday = monthlyReports.some(r => r.student_id === student.id && r.date === format(new Date(), "yyyy-MM-dd") && (r.report_type === 'daily' || !r.report_type));
                            const hasAttendance = monthlyReports.some(r => r.student_id === student.id && r.report_type === 'attendance');
                            const hasPerformance = monthlyReports.some(r => r.student_id === student.id && r.report_type === 'performance');
                            const hasClassReport = monthlyReports.some(r => r.student_id === student.id && r.report_type === 'monthly_class');
                            
                            const allSubmitted = isReportedToday && hasAttendance && hasPerformance && hasClassReport;

                            return (
                                <button
                                    key={student.id}
                                    onClick={() => handleOpenReport(student)}
                                    className={cn(
                                        "group relative bg-card rounded-[32px] border p-8 shadow-sm transition-all duration-300 text-left overflow-hidden border-border hover:shadow-xl hover:scale-[1.02] active:scale-95",
                                        allSubmitted && "border-green-500/30 bg-green-500/[0.01]"
                                    )}
                                >
                                    <div className="flex flex-col h-full gap-5">
                                        <div className="flex justify-between items-start">
                                            <div className={cn(
                                                "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border transition-colors",
                                                isReportedToday
                                                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                                                    : "bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-white"
                                            )}>
                                                {student.full_name.substring(0, 1).toUpperCase()}
                                            </div>
                                            
                                            {/* Mini checklist dots in top-right */}
                                            <div className="flex gap-1.5 bg-accent/20 px-3 py-1.5 rounded-full border border-border/40">
                                                <span className={cn("w-2 h-2 rounded-full", isReportedToday ? "bg-green-500" : "bg-muted-foreground/30")} title="Daily Report today" />
                                                <span className={cn("w-2 h-2 rounded-full", hasAttendance ? "bg-indigo-500" : "bg-muted-foreground/30")} title="Attendance Report this month" />
                                                <span className={cn("w-2 h-2 rounded-full", hasPerformance ? "bg-amber-500" : "bg-muted-foreground/30")} title="Student Performance Report this month" />
                                                <span className={cn("w-2 h-2 rounded-full", hasClassReport ? "bg-cyan-500" : "bg-muted-foreground/30")} title="Monthly Class Report this month" />
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-xl font-black text-foreground transition-colors leading-tight group-hover:text-primary">
                                                {student.full_name}
                                            </h3>
                                            <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-wider">
                                                ID: #{student.reg_no}
                                            </p>
                                        </div>

                                        {/* Submission Checklist Display */}
                                        <div className="mt-1 border-t border-border/40 pt-4 space-y-2.5">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Report Status Checklist</p>
                                            <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-[10px] font-bold">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", isReportedToday ? "bg-green-500" : "bg-red-500")} />
                                                    <span className={isReportedToday ? "text-foreground/75" : "text-muted-foreground"}>Daily Report</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", hasAttendance ? "bg-green-500" : "bg-red-500")} />
                                                    <span className={hasAttendance ? "text-foreground/75" : "text-muted-foreground"}>Attendance</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", hasPerformance ? "bg-green-500" : "bg-red-500")} />
                                                    <span className={hasPerformance ? "text-foreground/75" : "text-muted-foreground"}>Performance</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", hasClassReport ? "bg-green-500" : "bg-red-500")} />
                                                    <span className={hasClassReport ? "text-foreground/75" : "text-muted-foreground"}>Class Report</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            )}

            {/* Admin View: Full Analytics and Records */}
            {isAdmin && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    <div className="xl:col-span-4">
                        <div className="bg-card rounded-[32px] border border-border p-8 shadow-sm card-hover sticky top-8">
                            <h3 className="text-xl font-black mb-6 flex items-center gap-2 text-foreground">
                                <Filter className="h-5 w-5 text-primary" />
                                Filter Reports
                            </h3>
                            
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Date / Month</label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button className="w-full h-12 rounded-2xl border border-border bg-accent/20 px-4 font-bold text-sm shadow-sm flex items-center gap-3">
                                                <CalendarIcon className="h-4 w-4 text-primary" />
                                                {format(filterDate, "MMMM d, yyyy")}
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 rounded-2xl border-border shadow-2xl">
                                            <Calendar
                                                mode="single"
                                                selected={filterDate}
                                                onSelect={(date) => date && setFilterDate(date)}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Supervisor</label>
                                    <Select value={filterSupervisorId} onValueChange={(val) => { setFilterSupervisorId(val); setFilterTeacherId("All"); }}>
                                        <SelectTrigger className="h-12 rounded-2xl border-border bg-accent/20 px-4 font-bold text-sm">
                                            <Shield className="h-4 w-4 mr-2 text-primary" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-border shadow-2xl">
                                            <SelectItem value="All">All Supervisors</SelectItem>
                                            {supervisors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Teacher</label>
                                    <Select value={filterTeacherId} onValueChange={setFilterTeacherId}>
                                        <SelectTrigger className="h-12 rounded-2xl border-border bg-accent/20 px-4 font-bold text-sm">
                                            <User className="h-4 w-4 mr-2 text-primary" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-border shadow-2xl">
                                            <SelectItem value="All">All Teachers</SelectItem>
                                            {teachers
                                                .filter(t => filterSupervisorId === "All" || t.supervisor_id === filterSupervisorId)
                                                .map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-8 space-y-6">
                        {/* Tab Toggle */}
                        <div className="flex gap-2 p-1 bg-accent/20 rounded-2xl border border-border/40 w-fit mb-4">
                            <button
                                onClick={() => setAdminActiveTab('tracker')}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                    adminActiveTab === 'tracker'
                                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Submission Tracker
                            </button>
                            <button
                                onClick={() => setAdminActiveTab('feed')}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                    adminActiveTab === 'feed'
                                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Global Feed
                            </button>
                        </div>

                        {adminActiveTab === 'feed' ? (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                                        <BookOpen className="h-5 w-5 text-primary" />
                                        Global Records
                                        <span className="text-sm font-bold text-muted-foreground ml-2">
                                            ({reports.filter(r => (r.report_type === 'daily' || !r.report_type) ? r.date === format(filterDate, "yyyy-MM-dd") : true).length})
                                        </span>
                                    </h3>
                                </div>

                                {isLoadingReports ? (
                                    <LoadingShimmer rows={3} rowHeight="h-40" />
                                ) : reports.filter(r => (r.report_type === 'daily' || !r.report_type) ? r.date === format(filterDate, "yyyy-MM-dd") : true).length === 0 ? (
                                    <div className="bg-card rounded-[32px] border-2 border-dashed border-border p-20 flex flex-col items-center justify-center text-center">
                                        <p className="text-lg font-black text-foreground">No reports found for this selection.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-6">
                                        {reports
                                            .filter(r => (r.report_type === 'daily' || !r.report_type) ? r.date === format(filterDate, "yyyy-MM-dd") : true)
                                            .map((report) => (
                                                <ReportCard key={report.id} report={report} />
                                            ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Statistics Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {(() => {
                                        const activeStudentsForAdmin = students.filter(s => {
                                            const matchesSupervisor = filterSupervisorId === "All" || s.supervisor?.id === filterSupervisorId || s.supervisor_id === filterSupervisorId;
                                            const matchesTeacher = filterTeacherId === "All" || s.teacher?.id === filterTeacherId;
                                            return matchesSupervisor && matchesTeacher;
                                        });

                                        const total = activeStudentsForAdmin.length;
                                        const daily = activeStudentsForAdmin.filter(s => 
                                            reports.some(r => r.student_id === s.id && r.date === format(filterDate, "yyyy-MM-dd") && (r.report_type === 'daily' || !r.report_type))
                                        ).length;
                                        const att = activeStudentsForAdmin.filter(s => 
                                            reports.some(r => r.student_id === s.id && r.report_type === 'attendance')
                                        ).length;
                                        const perf = activeStudentsForAdmin.filter(s => 
                                            reports.some(r => r.student_id === s.id && r.report_type === 'performance')
                                        ).length;
                                        const cls = activeStudentsForAdmin.filter(s => 
                                            reports.some(r => r.student_id === s.id && r.report_type === 'monthly_class')
                                        ).length;

                                        return (
                                            <>
                                                <div className="bg-card rounded-2xl border p-4 shadow-sm">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Daily Reports</p>
                                                    <h4 className="text-xl font-black text-foreground mt-1">{daily} / {total}</h4>
                                                    <div className="w-full bg-accent/30 h-1.5 rounded-full mt-2 overflow-hidden">
                                                        <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: `${total > 0 ? (daily / total) * 100 : 0}%` }} />
                                                    </div>
                                                </div>
                                                <div className="bg-card rounded-2xl border p-4 shadow-sm">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Attendance Report</p>
                                                    <h4 className="text-xl font-black text-foreground mt-1">{att} / {total}</h4>
                                                    <div className="w-full bg-accent/30 h-1.5 rounded-full mt-2 overflow-hidden">
                                                        <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${total > 0 ? (att / total) * 100 : 0}%` }} />
                                                    </div>
                                                </div>
                                                <div className="bg-card rounded-2xl border p-4 shadow-sm">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Performance Report</p>
                                                    <h4 className="text-xl font-black text-foreground mt-1">{perf} / {total}</h4>
                                                    <div className="w-full bg-accent/30 h-1.5 rounded-full mt-2 overflow-hidden">
                                                        <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${total > 0 ? (perf / total) * 100 : 0}%` }} />
                                                    </div>
                                                </div>
                                                <div className="bg-card rounded-2xl border p-4 shadow-sm">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Class Reports</p>
                                                    <h4 className="text-xl font-black text-foreground mt-1">{cls} / {total}</h4>
                                                    <div className="w-full bg-accent/30 h-1.5 rounded-full mt-2 overflow-hidden">
                                                        <div className="bg-cyan-500 h-full rounded-full transition-all" style={{ width: `${total > 0 ? (cls / total) * 100 : 0}%` }} />
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>



                                {/* Checklist Matrix Table */}
                                <div className="bg-card rounded-[32px] border border-border overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-border bg-accent/10 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                                    <th className="p-5 pl-8">Student</th>
                                                    <th className="p-5">Teacher & Supervisor</th>
                                                    <th className="p-5 text-center">Daily</th>
                                                    <th className="p-5 text-center">Attendance Report</th>
                                                    <th className="p-5 text-center">Performance Report</th>
                                                    <th className="p-5 text-center">Class Report</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/60">
                                                {(() => {
                                                    const activeStudentsForAdmin = students.filter(s => {
                                                        const matchesSupervisor = filterSupervisorId === "All" || s.supervisor?.id === filterSupervisorId || s.supervisor_id === filterSupervisorId;
                                                        const matchesTeacher = filterTeacherId === "All" || s.teacher?.id === filterTeacherId;
                                                        return matchesSupervisor && matchesTeacher;
                                                    });

                                                    if (activeStudentsForAdmin.length === 0) {
                                                        return (
                                                            <tr>
                                                                <td colSpan={6} className="p-10 text-center text-sm font-bold text-muted-foreground">No students matched filters.</td>
                                                            </tr>
                                                        );
                                                    }

                                                    return activeStudentsForAdmin.map(s => {
                                                        const dailyRep = reports.find(r => r.student_id === s.id && r.date === format(filterDate, "yyyy-MM-dd") && (r.report_type === 'daily' || !r.report_type));
                                                        const attRep = reports.find(r => r.student_id === s.id && r.report_type === 'attendance');
                                                        const perfRep = reports.find(r => r.student_id === s.id && r.report_type === 'performance');
                                                        const classRep = reports.find(r => r.student_id === s.id && r.report_type === 'monthly_class');
                                                        
                                                        return (
                                                            <tr key={s.id} className="hover:bg-accent/5 transition-colors">
                                                                <td className="p-5 pl-8">
                                                                    <div className="font-black text-sm text-foreground">{s.full_name}</div>
                                                                    <div className="text-[10px] font-bold text-muted-foreground mt-0.5">#{s.reg_no}</div>
                                                                </td>
                                                                <td className="p-5">
                                                                    <div className="text-xs font-black text-foreground">{s.teacher?.name || 'Unassigned'}</div>
                                                                    <div className="text-[10px] font-bold text-muted-foreground mt-0.5">{s.supervisor?.name || 'No Supervisor'}</div>
                                                                </td>
                                                                <td className="p-5 text-center">
                                                                    <StatusBadge report={dailyRep} onOpen={() => { if (dailyRep) { setViewingReport(dailyRep); setIsViewDialogOpen(true); } }} />
                                                                </td>
                                                                <td className="p-5 text-center">
                                                                    <StatusBadge report={attRep} onOpen={() => { if (attRep) { setViewingReport(attRep); setIsViewDialogOpen(true); } }} />
                                                                </td>
                                                                <td className="p-5 text-center">
                                                                    <StatusBadge report={perfRep} onOpen={() => { if (perfRep) { setViewingReport(perfRep); setIsViewDialogOpen(true); } }} />
                                                                </td>
                                                                <td className="p-5 text-center">
                                                                    <StatusBadge report={classRep} onOpen={() => { if (classRep) { setViewingReport(classRep); setIsViewDialogOpen(true); } }} />
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Submission Dialog (Universal) */}
            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] rounded-[32px] border-border bg-card p-0 overflow-hidden shadow-2xl flex flex-col">
                    <div className="bg-primary/10 p-6 border-b border-primary/10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                <User className="h-7 w-7" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black text-foreground leading-tight">
                                    {selectedStudentForReport?.full_name}
                                </DialogTitle>
                                <p className="text-xs font-bold text-primary/70 uppercase tracking-[0.1em]">
                                    #{selectedStudentForReport?.reg_no} · {selectedStudentForReport?.status}
                                </p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-card/50 p-2.5 rounded-xl border border-primary/5">
                                <p className="text-[8px] font-black text-muted-foreground uppercase mb-0.5">Shift</p>
                                <p className="text-xs font-bold text-foreground">{selectedStudentForReport?.shift || "N/A"}</p>
                            </div>
                            <div className="bg-card/50 p-2.5 rounded-xl border border-primary/5">
                                <p className="text-[8px] font-black text-muted-foreground uppercase mb-0.5">Teacher</p>
                                <p className="text-xs font-bold text-foreground truncate">{selectedStudentForReport?.teacher?.name || "N/A"}</p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        
                        {/* Report Type Selector */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Report Type</label>
                            <div className="flex gap-1.5 p-1 bg-accent/20 rounded-xl border border-border/40 text-[10px] font-black uppercase">
                                <button
                                    type="button"
                                    onClick={() => setReportType('daily')}
                                    className={cn("flex-1 py-2 rounded-lg text-center transition-all", reportType === 'daily' ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}
                                >
                                    Daily
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setReportType('attendance')}
                                    className={cn("flex-1 py-2 rounded-lg text-center transition-all", reportType === 'attendance' ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}
                                >
                                    Attendance
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setReportType('performance')}
                                    className={cn("flex-1 py-2 rounded-lg text-center transition-all", reportType === 'performance' ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}
                                >
                                    Performance
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setReportType('monthly_class')}
                                    className={cn("flex-1 py-2 rounded-lg text-center transition-all", reportType === 'monthly_class' ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}
                                >
                                    Class
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Date</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button type="button" className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm flex items-center gap-2">
                                            <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                                            {format(reportDate, "MMM d, yyyy")}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-2xl border-border shadow-2xl">
                                        <Calendar
                                            mode="single"
                                            selected={reportDate}
                                            onSelect={(date) => date && setReportDate(date)}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Time</label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary" />
                                    <input 
                                        type="text"
                                        value={reportTime}
                                        onChange={(e) => setReportTime(e.target.value)}
                                        className="w-full h-11 rounded-xl border border-border bg-accent/20 pl-10 pr-4 font-bold text-xs shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* CONDITIONAL FORM INPUTS BASED ON TYPE */}
                        {reportType === 'daily' && (
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Attendance</label>
                                        <Select value={attendanceStatus} onValueChange={setAttendanceStatus}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                                <SelectValue placeholder="Status" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border shadow-2xl">
                                                <SelectItem value="Present">Present</SelectItem>
                                                <SelectItem value="Absent">Absent</SelectItem>
                                                <SelectItem value="Late">Late</SelectItem>
                                                <SelectItem value="Leave">Leave</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Behavior</label>
                                        <Select value={behavior} onValueChange={setBehavior}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                                <SelectValue placeholder="Behavior" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border shadow-2xl">
                                                <SelectItem value="Excellent">Excellent</SelectItem>
                                                <SelectItem value="Very Good">Very Good</SelectItem>
                                                <SelectItem value="Good">Good</SelectItem>
                                                <SelectItem value="Average">Average</SelectItem>
                                                <SelectItem value="Bad">Bad</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Sitting Arrangement</label>
                                        <Select value={sittingArrangement} onValueChange={setSittingArrangement}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                                <SelectValue placeholder="Arrangement" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border shadow-2xl">
                                                <SelectItem value="Excellent">Excellent</SelectItem>
                                                <SelectItem value="Very Good">Very Good</SelectItem>
                                                <SelectItem value="Acceptable">Acceptable</SelectItem>
                                                <SelectItem value="Needs Work">Needs Work</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Memorization Lesson</label>
                                        <input 
                                            type="text"
                                            placeholder="e.g. Surah Fatiha"
                                            value={memorizationLesson}
                                            onChange={(e) => setMemorizationLesson(e.target.value)}
                                            className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Namaz (0-5)</label>
                                        <Select value={namazCount} onValueChange={setNamazCount}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                                <SelectValue placeholder="Namaz" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border shadow-2xl">
                                                {["0", "1", "2", "3", "4", "5"].map(n => (
                                                    <SelectItem key={n} value={n}>{n}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Duration (Min)</label>
                                        <input 
                                            type="number"
                                            value={durationMinutes}
                                            onChange={(e) => setDurationMinutes(e.target.value)}
                                            className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Practice</label>
                                        <Select value={lessonPractice} onValueChange={setLessonPractice}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                                <SelectValue placeholder="Practice" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border shadow-2xl">
                                                <SelectItem value="Yes">Yes</SelectItem>
                                                <SelectItem value="No">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-t border-border pt-5">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Lesson Type</label>
                                        <Select value={lessonType} onValueChange={setLessonType}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border shadow-2xl">
                                                <SelectItem value="Nazra">Nazra (Recitation)</SelectItem>
                                                <SelectItem value="Hifz">Hifz (Memorization)</SelectItem>
                                                <SelectItem value="Tajweed">Tajweed</SelectItem>
                                                <SelectItem value="Translation">Translation</SelectItem>
                                                <SelectItem value="Tafseer">Tafseer</SelectItem>
                                                <SelectItem value="Revision">Revision (Dour)</SelectItem>
                                                <SelectItem value="Qaida">Noorani Qaida</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Grade</label>
                                        <Select value={performanceGrade} onValueChange={setPerformanceGrade}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                                <SelectValue placeholder="Select grade" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-border shadow-2xl">
                                                <SelectItem value="Excellent">Excellent (A+)</SelectItem>
                                                <SelectItem value="Good">Good (A)</SelectItem>
                                                <SelectItem value="Average">Average (B)</SelectItem>
                                                <SelectItem value="Needs Improvement">Needs Improvement (C)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Surah / Book Name</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Al-Baqarah, Yaseen"
                                        value={surahOrBook}
                                        onChange={(e) => setSurahOrBook(e.target.value)}
                                        className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Start (Ayat / Page)</label>
                                        <input 
                                            type="text"
                                            placeholder="Ayat 1"
                                            value={ayatOrPageFrom}
                                            onChange={(e) => setAyatOrPageFrom(e.target.value)}
                                            className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">End (Ayat / Page)</label>
                                        <input 
                                            type="text"
                                            placeholder="Ayat 5"
                                            value={ayatOrPageTo}
                                            onChange={(e) => setAyatOrPageTo(e.target.value)}
                                            className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {reportType === 'attendance' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Total Classes</label>
                                        <input 
                                            type="number"
                                            value={totalClasses}
                                            onChange={(e) => setTotalClasses(e.target.value)}
                                            className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Present Days</label>
                                        <input 
                                            type="number"
                                            value={presentDays}
                                            onChange={(e) => setPresentDays(e.target.value)}
                                            className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Absent Days</label>
                                        <input 
                                            type="number"
                                            value={absentDays}
                                            onChange={(e) => setAbsentDays(e.target.value)}
                                            className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Late Days</label>
                                        <input 
                                            type="number"
                                            value={lateDays}
                                            onChange={(e) => setLateDays(e.target.value)}
                                            className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="bg-accent/10 p-3.5 rounded-xl border border-border/40 text-center">
                                    <span className="text-[9px] font-black uppercase text-muted-foreground">Attendance Percentage (Calculated)</span>
                                    <div className="text-lg font-black text-primary mt-0.5">
                                        {totalClasses && presentDays ? ((parseInt(presentDays) / parseInt(totalClasses)) * 100).toFixed(1) : "100.0"}%
                                    </div>
                                </div>
                            </div>
                        )}

                        {reportType === 'performance' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Overall Grade</label>
                                        <Select value={overallGrade} onValueChange={setOverallGrade}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-3 font-bold text-xs shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border border-border shadow-2xl">
                                                <SelectItem value="Excellent">Excellent</SelectItem>
                                                <SelectItem value="Good">Good</SelectItem>
                                                <SelectItem value="Average">Average</SelectItem>
                                                <SelectItem value="Needs Improvement">Improve</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Memorization</label>
                                        <Select value={memorizationProgress} onValueChange={setMemorizationProgress}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-3 font-bold text-xs shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border border-border shadow-2xl">
                                                <SelectItem value="Excellent">Excellent</SelectItem>
                                                <SelectItem value="Good">Good</SelectItem>
                                                <SelectItem value="Average">Average</SelectItem>
                                                <SelectItem value="Needs Improvement">Improve</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Behavior</label>
                                        <Select value={behaviorGrade} onValueChange={setBehaviorGrade}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-3 font-bold text-xs shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border border-border shadow-2xl">
                                                <SelectItem value="Excellent">Excellent</SelectItem>
                                                <SelectItem value="Good">Good</SelectItem>
                                                <SelectItem value="Average">Average</SelectItem>
                                                <SelectItem value="Needs Improvement">Improve</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Strengths</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Pronunciation, quick memorization"
                                        value={strengths}
                                        onChange={(e) => setStrengths(e.target.value)}
                                        className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Weaknesses</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Focus during revision"
                                        value={weaknesses}
                                        onChange={(e) => setWeaknesses(e.target.value)}
                                        className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Next Month's Goals</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Complete Juz 3"
                                        value={nextMonthGoals}
                                        onChange={(e) => setNextMonthGoals(e.target.value)}
                                        className="w-full h-11 rounded-xl border border-border bg-accent/20 px-4 font-bold text-xs shadow-sm outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        {reportType === 'monthly_class' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Overall Class Grade</label>
                                        <Select value={classGrade} onValueChange={setClassGrade}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border border-border shadow-2xl">
                                                <SelectItem value="Excellent">Excellent</SelectItem>
                                                <SelectItem value="Good">Good</SelectItem>
                                                <SelectItem value="Average">Average</SelectItem>
                                                <SelectItem value="Needs Improvement">Needs Improvement</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Student Participation</label>
                                        <Select value={participation} onValueChange={setParticipation}>
                                            <SelectTrigger className="w-full h-11 rounded-xl border-border bg-accent/20 px-4 font-bold text-xs shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border border-border shadow-2xl">
                                                <SelectItem value="Active">Active</SelectItem>
                                                <SelectItem value="Average">Average</SelectItem>
                                                <SelectItem value="Passive">Passive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Class Progress Summary</label>
                                    <textarea 
                                        placeholder="Write class progress details..."
                                        className="w-full min-h-[60px] rounded-xl border border-border bg-accent/10 p-3 font-medium text-xs resize-none outline-none"
                                        value={progressSummary}
                                        onChange={(e) => setProgressSummary(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Monthly Recommendations</label>
                                    <textarea 
                                        placeholder="Write recommendation details..."
                                        className="w-full min-h-[60px] rounded-xl border border-border bg-accent/10 p-3 font-medium text-xs resize-none outline-none"
                                        value={recommendations}
                                        onChange={(e) => setRecommendations(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Remarks / Description</label>
                            <textarea 
                                placeholder={reportType === 'daily' ? "Any specific feedback..." : "Optional: Add additional comments..."}
                                className="w-full min-h-[80px] rounded-xl border border-border bg-accent/10 p-4 font-medium text-xs outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {hasExistingMonthly && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl p-3 text-center text-xs font-black uppercase tracking-wider mb-2 animate-pulse">
                                ⚠️ Monthly report already submitted for this month
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setIsReportDialogOpen(false)} className="flex-1 h-12 rounded-xl font-black text-xs uppercase bg-accent/50 text-foreground">Cancel</button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting || hasExistingMonthly || (reportType === 'daily' && !description)}
                                className={cn(
                                    "flex-[2] h-12 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center gap-3 shadow-xl",
                                    submitSuccess ? "bg-green-500 text-white" : 
                                    hasExistingMonthly ? "bg-red-500/20 text-red-600/40 cursor-not-allowed border border-red-500/10 shadow-none" :
                                    "bg-primary text-white hover:bg-primary/90"
                                )}
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitSuccess ? <CheckCircle2 className="h-4 w-4" /> : "Submit Report"}
                            </button>
                        </div>
                    </form>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Detailed Report Dialog */}
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-[32px] border-border bg-card p-0 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                    <div className="bg-primary/10 p-6 border-b border-primary/10">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                <BookOpen className="h-7 w-7" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black text-foreground leading-none">
                                    Report Details
                                </DialogTitle>
                                <p className="text-xs font-bold text-primary/70 uppercase tracking-widest mt-1.5">
                                    {viewingReport?.report_type || 'daily'} Report
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-6 space-y-6 custom-scrollbar text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-accent/10 p-3.5 rounded-2xl">
                                <p className="text-[9px] font-black text-muted-foreground uppercase">Student</p>
                                <p className="font-bold text-foreground mt-0.5">{viewingReport?.student?.full_name}</p>
                                <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">#{viewingReport?.student?.reg_no}</p>
                            </div>
                            <div className="bg-accent/10 p-3.5 rounded-2xl">
                                <p className="text-[9px] font-black text-muted-foreground uppercase">Submitted On</p>
                                <p className="font-bold text-foreground mt-0.5">{viewingReport && format(new Date(viewingReport.date), "MMM d, yyyy")}</p>
                                <p className="text-[10px] font-semibold text-primary mt-0.5">{viewingReport?.time}</p>
                            </div>
                        </div>

                        {/* Metadata Details */}
                        {(viewingReport?.report_type === 'daily' || !viewingReport?.report_type) ? (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-border pb-1">Daily Log Parameters</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div><span className="font-bold text-muted-foreground">Lesson Type:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.lessonType}</span></div>
                                    <div><span className="font-bold text-muted-foreground">Surah/Book:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.surahOrBook || "N/A"}</span></div>
                                    <div><span className="font-bold text-muted-foreground">Range:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.ayatOrPageFrom} - {viewingReport?.metadata?.ayatOrPageTo}</span></div>
                                    <div><span className="font-bold text-muted-foreground">Attendance:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.attendanceStatus}</span></div>
                                    <div><span className="font-bold text-muted-foreground">Behavior:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.behavior}</span></div>
                                    <div><span className="font-bold text-muted-foreground">Namaz:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.namazCount}/5</span></div>
                                    <div><span className="font-bold text-muted-foreground">Practice:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.lessonPractice}</span></div>
                                    <div><span className="font-bold text-muted-foreground">Grade:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.performanceGrade}</span></div>
                                </div>
                            </div>
                        ) : viewingReport?.report_type === 'attendance' ? (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-border pb-1">Attendance Details</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div><span className="font-bold text-muted-foreground">Total Classes:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.totalClasses}</span></div>
                                    <div><span className="font-bold text-muted-foreground">Present Days:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.presentDays}</span></div>
                                    <div><span className="font-bold text-muted-foreground">Absent Days:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.absentDays}</span></div>
                                    <div><span className="font-bold text-muted-foreground">Late Days:</span> <span className="font-black text-foreground">{viewingReport?.metadata?.lateDays}</span></div>
                                    <div className="col-span-2 bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10 text-center">
                                        <span className="text-[9px] font-black uppercase text-indigo-600 block">Attendance Percentage</span>
                                        <span className="text-lg font-black text-indigo-700">{viewingReport?.metadata?.attendancePercentage}%</span>
                                    </div>
                                </div>
                            </div>
                        ) : viewingReport?.report_type === 'performance' ? (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-border pb-1">Performance Details</h4>
                                <div className="space-y-3.5 text-xs">
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-accent/10 p-2.5 rounded-xl">
                                            <span className="text-[8px] font-black uppercase text-muted-foreground block">Overall Grade</span>
                                            <span className="font-black text-foreground">{viewingReport?.metadata?.overallGrade}</span>
                                        </div>
                                        <div className="bg-accent/10 p-2.5 rounded-xl">
                                            <span className="text-[8px] font-black uppercase text-muted-foreground block">Memorization</span>
                                            <span className="font-black text-foreground">{viewingReport?.metadata?.memorizationProgress}</span>
                                        </div>
                                        <div className="bg-accent/10 p-2.5 rounded-xl">
                                            <span className="text-[8px] font-black uppercase text-muted-foreground block">Behavior</span>
                                            <span className="font-black text-foreground">{viewingReport?.metadata?.behaviorGrade}</span>
                                        </div>
                                    </div>
                                    <div className="bg-green-500/[0.02] border p-3 rounded-xl"><span className="font-bold text-green-600">Strengths:</span> <span className="font-semibold text-foreground/90 block mt-0.5">{viewingReport?.metadata?.strengths || "N/A"}</span></div>
                                    <div className="bg-red-500/[0.02] border p-3 rounded-xl"><span className="font-bold text-red-600">Weaknesses:</span> <span className="font-semibold text-foreground/90 block mt-0.5">{viewingReport?.metadata?.weaknesses || "N/A"}</span></div>
                                    <div className="bg-primary/[0.02] border p-3 rounded-xl"><span className="font-bold text-primary">Next Month's Goals:</span> <span className="font-semibold text-foreground/90 block mt-0.5">{viewingReport?.metadata?.nextMonthGoals || "N/A"}</span></div>
                                </div>
                            </div>
                        ) : viewingReport?.report_type === 'monthly_class' ? (
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest border-b border-border pb-1">Class Metrics</h4>
                                <div className="space-y-3.5 text-xs">
                                    <div className="grid grid-cols-2 gap-3 text-center">
                                        <div className="bg-accent/10 p-2.5 rounded-xl">
                                            <span className="text-[8px] font-black uppercase text-muted-foreground block">Overall Class Grade</span>
                                            <span className="font-black text-foreground">{viewingReport?.metadata?.classGrade}</span>
                                        </div>
                                        <div className="bg-accent/10 p-2.5 rounded-xl">
                                            <span className="text-[8px] font-black uppercase text-muted-foreground block">Participation</span>
                                            <span className="font-black text-foreground">{viewingReport?.metadata?.participation}</span>
                                        </div>
                                    </div>
                                    <div className="bg-accent/10 p-3 rounded-xl"><span className="font-bold text-muted-foreground">Class Progress Summary:</span> <span className="font-semibold text-foreground block mt-1 leading-relaxed">{viewingReport?.metadata?.progressSummary || "N/A"}</span></div>
                                    <div className="bg-primary/5 p-3 rounded-xl border border-primary/10"><span className="font-bold text-primary">Recommendations:</span> <span className="font-semibold text-foreground block mt-1 leading-relaxed">{viewingReport?.metadata?.recommendations || "N/A"}</span></div>
                                </div>
                            </div>
                        ) : null}

                        <div className="border-t border-border pt-4">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block mb-1.5">Remarks / Feedback</span>
                            <div className="p-4 rounded-2xl bg-accent/20 text-xs font-semibold leading-relaxed text-foreground/80 italic">
                                "{viewingReport?.description}"
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground pt-2 border-t border-border/50">
                            <div>Teacher: <span className="font-black text-primary">{viewingReport?.teacher?.name}</span></div>
                            <div>Supervisor: <span className="font-black text-foreground">{viewingReport?.supervisor?.name}</span></div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-border bg-accent/10 flex justify-end">
                        <button
                            onClick={() => setIsViewDialogOpen(false)}
                            className="h-10 rounded-xl px-6 font-black text-xs uppercase bg-primary text-white hover:bg-primary/95 transition-all"
                        >
                            Close
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StatusBadge({ report, onOpen }: { report?: DailyReport, onOpen: () => void }) {
    if (report) {
        return (
            <button
                onClick={onOpen}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/20 text-[10px] font-black uppercase tracking-wider hover:bg-green-500/20 transition-all cursor-pointer shadow-sm active:scale-95"
            >
                <CheckCircle2 className="h-3 w-3" />
                Submitted
            </button>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 text-[10px] font-black uppercase tracking-wider shadow-sm opacity-60">
            <Plus className="h-3 w-3 rotate-45" />
            Missing
        </span>
    );
}

function ReportCard({ report }: { report: DailyReport }) {
    return (
        <div className="bg-card rounded-[32px] border border-border p-6 shadow-sm hover:shadow-xl transition-all duration-300">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary border border-primary/20">
                                {(report.student?.full_name || "S").substring(0, 1).toUpperCase()}
                            </div>
                            <div>
                                <h4 className="text-[17px] font-black text-foreground">{report.student?.full_name}</h4>
                                <p className="text-xs font-bold text-muted-foreground">
                                    ID: #{report.student?.reg_no} 
                                    <span className="ml-2 font-black text-primary text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10">
                                        {report.report_type || 'daily'}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 text-[10px] font-black uppercase text-muted-foreground">
                            <span>{format(new Date(report.date), "MMM d, yyyy")}</span>
                            <span className="text-primary">{report.time}</span>
                        </div>
                    </div>

                    {report.metadata && Object.keys(report.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {report.metadata.lessonType && (
                                <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest">
                                    {report.metadata.lessonType}
                                </span>
                            )}
                            {report.metadata.surahOrBook && (
                                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
                                    Surah/Book: {report.metadata.surahOrBook}
                                </span>
                            )}
                            {(report.metadata.ayatOrPageFrom || report.metadata.ayatOrPageTo) && (
                                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest">
                                    Range: {report.metadata.ayatOrPageFrom} - {report.metadata.ayatOrPageTo}
                                </span>
                            )}
                            {report.metadata.attendanceStatus && (
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                    report.metadata.attendanceStatus === "Present" ? "bg-green-500/10 text-green-600 border-green-500/20" : 
                                    report.metadata.attendanceStatus === "Absent" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                                    "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                )}>
                                    {report.metadata.attendanceStatus}
                                </span>
                            )}
                            {report.metadata.behavior && (
                                <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20 text-[10px] font-black uppercase tracking-widest">
                                    Behavior: {report.metadata.behavior}
                                </span>
                            )}
                            {report.metadata.namazCount !== undefined && (
                                <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 text-[10px] font-black uppercase tracking-widest">
                                    Namaz: {report.metadata.namazCount}/5
                                </span>
                            )}
                            {report.metadata.durationMinutes !== undefined && (
                                <span className="px-3 py-1 rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20 text-[10px] font-black uppercase tracking-widest">
                                    {report.metadata.durationMinutes} Min
                                </span>
                            )}
                            {report.metadata.sittingArrangement && (
                                <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest">
                                    Arrangement: {report.metadata.sittingArrangement}
                                </span>
                            )}
                            {report.metadata.performanceGrade && (
                                <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[10px] font-black uppercase tracking-widest">
                                    Grade: {report.metadata.performanceGrade}
                                </span>
                            )}
                            {report.metadata.totalClasses !== undefined && (
                                <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest">
                                    Classes: {report.metadata.presentDays}/{report.metadata.totalClasses} ({report.metadata.attendancePercentage}%)
                                </span>
                            )}
                            {report.metadata.overallGrade && (
                                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest">
                                    Performance: Grade {report.metadata.overallGrade}
                                </span>
                            )}
                            {report.metadata.classGrade && (
                                <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 text-[10px] font-black uppercase tracking-widest">
                                    Class: Grade {report.metadata.classGrade} ({report.metadata.participation})
                                </span>
                            )}
                        </div>
                    )}
                    {report.metadata?.memorizationLesson && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/5 border border-primary/10">
                            <span className="text-[9px] font-black uppercase text-primary/60">Memorization:</span>
                            <span className="text-xs font-bold text-primary">{report.metadata.memorizationLesson}</span>
                        </div>
                    )}
                    {report.description && (
                        <div className="p-4 rounded-2xl bg-accent/20 text-sm font-medium leading-relaxed text-foreground/80 italic">
                            "{report.description}"
                        </div>
                    )}
                    <div className="flex items-center gap-4 pt-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                            <User className="h-3 w-3 text-orange-500" />
                            {report.teacher?.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                            <Shield className="h-3 w-3 text-blue-500" />
                            {report.supervisor?.name}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
