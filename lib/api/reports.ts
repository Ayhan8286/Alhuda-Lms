import { supabase } from "@/lib/supabase";

export interface DailyReport {
    id?: string;
    student_id: string;
    teacher_id: string;
    supervisor_id: string;
    date: string;
    time: string;
    description: string;
    report_type?: 'daily' | 'attendance' | 'performance' | 'monthly_class';
    metadata?: {
        // Daily Report fields
        lessonType?: string;
        surahOrBook?: string;
        ayatOrPageFrom?: string;
        ayatOrPageTo?: string;
        performanceGrade?: string;
        namazCount?: number;
        durationMinutes?: number;
        lessonPractice?: string;
        behavior?: string;
        attendanceStatus?: string;
        sittingArrangement?: string;
        memorizationLesson?: string;

        // Attendance Report (Monthly)
        totalClasses?: number;
        presentDays?: number;
        absentDays?: number;
        lateDays?: number;
        attendancePercentage?: number;

        // Student Performance Report (Monthly)
        overallGrade?: string;
        memorizationProgress?: string;
        behaviorGrade?: string;
        strengths?: string;
        weaknesses?: string;
        nextMonthGoals?: string;

        // Monthly Class Report
        classGrade?: string;
        participation?: string;
        progressSummary?: string;
        recommendations?: string;
    };
    created_at?: string;
    student?: {
        full_name: string;
        reg_no: string;
    };
    teacher?: {
        name: string;
    };
    supervisor?: {
        name: string;
    };
}

export async function submitDailyReport(report: Omit<DailyReport, "id" | "created_at">): Promise<void> {
    console.log("Submitting daily report:", report);
    
    const { error, status, statusText } = await supabase
        .from("daily_reports")
        .insert([report]);

    if (error) {
        console.error("Daily report submission failure:", {
            error,
            status,
            statusText,
            payload: report
        });
        throw error;
    }
}

export async function getDailyReports(filters: {
    date?: string;
    startDate?: string;
    endDate?: string;
    supervisorId?: string;
    teacherId?: string;
    studentId?: string;
    reportType?: string;
}): Promise<DailyReport[]> {
    let query = supabase
        .from("daily_reports")
        .select(`
            *,
            student:students(full_name, reg_no),
            teacher:teachers(name),
            supervisor:supervisors(name)
        `);

    if (filters.date) query = query.eq("date", filters.date);
    if (filters.startDate) query = query.gte("date", filters.startDate);
    if (filters.endDate) query = query.lte("date", filters.endDate);
    if (filters.supervisorId) query = query.eq("supervisor_id", filters.supervisorId);
    if (filters.teacherId) query = query.eq("teacher_id", filters.teacherId);
    if (filters.studentId) query = query.eq("student_id", filters.studentId);
    if (filters.reportType && filters.reportType !== "All") query = query.eq("report_type", filters.reportType);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching daily reports:", error);
        throw error;
    }

    return (data || []).map(report => ({
        ...report,
        student: Array.isArray(report.student) ? report.student[0] : report.student,
        teacher: Array.isArray(report.teacher) ? report.teacher[0] : report.teacher,
        supervisor: Array.isArray(report.supervisor) ? report.supervisor[0] : report.supervisor,
    }));
}

export async function getStudentsForReporting(supervisorId?: string, teacherId?: string): Promise<any[]> {
    let query = supabase
        .from("students")
        .select(`
            id, full_name, reg_no, status, shift, guardian_name, supervisor_id,
            supervisor:supervisors(id, name),
            classes(
                teacher:teachers(
                    id, 
                    name,
                    supervisor:supervisors(id, name)
                )
            )
        `)
        .ilike("status", "active");

    if (teacherId) {
        const { data: classStudents } = await supabase.from("classes").select("student_id").eq("teacher_id", teacherId);
        const linkedStudentIds = (classStudents || []).map(cs => cs.student_id);
        query = query.in("id", linkedStudentIds.length > 0 ? linkedStudentIds : ['00000000-0000-0000-0000-000000000000']);
    } else if (supervisorId) {
        // Resolve linked students via teachers first
        const { data: teachers } = await supabase.from("teachers").select("id").eq("supervisor_id", supervisorId);
        const teacherIds = (teachers || []).map(t => t.id);
        const { data: classStudents } = await supabase.from("classes").select("student_id").in("teacher_id", teacherIds);
        const linkedStudentIds = (classStudents || []).map(cs => cs.student_id);
        
        // Filter by direct supervisor_id OR linked via teacher classes
        query = query.or(`supervisor_id.eq.${supervisorId},id.in.(${linkedStudentIds.length > 0 ? linkedStudentIds.join(',') : 'null'})`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(s => {
        let supervisor = Array.isArray(s.supervisor) ? s.supervisor[0] : s.supervisor;
        const teacherInfo = s.classes?.[0]?.teacher;
        const teacher = Array.isArray(teacherInfo) ? teacherInfo[0] : teacherInfo;

        // Fallback to teacher's supervisor if student's direct supervisor is missing
        if (!supervisor && teacher?.supervisor) {
            supervisor = Array.isArray(teacher.supervisor) ? teacher.supervisor[0] : teacher.supervisor;
        }

        return {
            ...s,
            supervisor,
            teacher: teacher || null
        };
    });
}
