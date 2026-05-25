import { supabase } from "@/lib/supabase";

export interface DashboardStats {
    totalStudents: number;
    activeTeachers: number;
    totalTeachers: number;
    totalClasses: number;
    activeStudents: number;
    inactiveStudents: number;
    studentsByShift: Record<string, number>;
    classesPerDay: Record<string, number>;
    hoursPerDay: Record<string, number>;
    accountsByPlatform: Record<string, number>;
    totalAccounts: number;
    todayAttendancePercentage: number;
    attendanceStats: {
        present: number;
        absent: number;
        late: number;
        leave: number;
    };
    missingAttendanceCount: number;
}

export async function getDashboardStats(supervisorId?: string, teacherId?: string): Promise<DashboardStats> {
    // If supervisorId is provided, we need to fetch their specific context first
    let teacherIds: string[] = [];
    let studentIds: string[] = [];
    let classIds: string[] = [];
    let accountsData: { platform: string | null }[] = [];

    if (supervisorId) {
        // 1. Get teachers for this supervisor
        const { data: supervisorTeachers } = await supabase
            .from("teachers")
            .select("id")
            .eq("supervisor_id", supervisorId);
        
        teacherIds = supervisorTeachers?.map(t => t.id) || [];

        if (teacherIds.length > 0) {
            // 2. Get classes for these teachers
            const { data: supervisorClasses } = await supabase
                .from("classes")
                .select("id, student_id, app_account_id, schedule_days, app_account:app_accounts(platform)")
                .in("teacher_id", teacherIds);
            
            if (supervisorClasses) {
                classIds = supervisorClasses.map(c => c.id);
                studentIds = Array.from(new Set(supervisorClasses.map(c => c.student_id).filter(id => !!id) as string[]));
                
                // Extract unique account platforms
                const accountsMap = new Map<string, string>();
                supervisorClasses.forEach(c => {
                    if (c.app_account_id && c.app_account) {
                        const platform = (c.app_account as any).platform || "Unknown";
                        accountsMap.set(c.app_account_id, platform);
                    }
                });
                accountsData = Array.from(accountsMap.values()).map(platform => ({ platform }));
            }
        }
    } else if (teacherId) {
        // 1. Get classes for this teacher
        const { data: teacherClasses } = await supabase
            .from("classes")
            .select("id, student_id, app_account_id, schedule_days, app_account:app_accounts(platform)")
            .eq("teacher_id", teacherId);
        
        if (teacherClasses) {
            teacherIds = [teacherId];
            classIds = teacherClasses.map(c => c.id);
            studentIds = Array.from(new Set(teacherClasses.map(c => c.student_id).filter(id => !!id) as string[]));
            
            // Extract unique account platforms
            const accountsMap = new Map<string, string>();
            teacherClasses.forEach(c => {
                if (c.app_account_id && c.app_account) {
                    const platform = (c.app_account as any).platform || "Unknown";
                    accountsMap.set(c.app_account_id, platform);
                }
            });
            accountsData = Array.from(accountsMap.values()).map(platform => ({ platform }));
        }
    }

    // Now perform the main dashboard queries, applying filters if needed
    let studentsResult: any;
    let activeTeachersResult: any;
    let allTeachersResult: any;
    let classesResult: any;
    let activeStudentsResult: any;
    let shiftResult: any;
    let classScheduleResult: any;
    let appAccountsResult: any;

    if (supervisorId || teacherId) {
        // Run consolidated parallel queries
        const [studentsData, teachersData, classesData] = await Promise.all([
            supabase.from("students").select("id, status, shift").in("id", studentIds),
            supabase.from("teachers").select("id, is_active").in("id", teacherIds),
            supabase.from("classes").select("id, schedule_days").in("id", classIds)
        ]);

        const studentsList = studentsData.data || [];
        const teachersList = teachersData.data || [];
        const classesList = classesData.data || [];

        studentsResult = { count: studentsList.length };
        activeTeachersResult = { count: teachersList.filter(t => t.is_active).length };
        allTeachersResult = { count: teachersList.length };
        classesResult = { count: classesList.length };
        activeStudentsResult = { count: studentsList.filter(s => s.status?.toLowerCase() === 'active').length };
        shiftResult = { data: studentsList.map(s => ({ shift: s.shift })) };
        classScheduleResult = { data: classesList };
        appAccountsResult = { data: accountsData };
    } else {
        const queries = [];
        // Global counts using optimized view if available
        const { data: summary } = await supabase.from("dashboard_summary").select("*").single();
        if (summary) {
            queries.push(Promise.resolve({ count: parseInt(summary.total_students) }));
            queries.push(Promise.resolve({ count: parseInt(summary.active_teachers) }));
            queries.push(Promise.resolve({ count: parseInt(summary.total_teachers) }));
            queries.push(Promise.resolve({ count: parseInt(summary.total_classes) }));
            queries.push(Promise.resolve({ count: parseInt(summary.active_students) }));
        } else {
            // Fallback if view not ready
            queries.push(supabase.from("students").select("id", { count: "exact", head: true }));
            queries.push(supabase.from("teachers").select("id", { count: "exact", head: true }).eq("is_active", true));
            queries.push(supabase.from("teachers").select("id", { count: "exact", head: true }));
            queries.push(supabase.from("classes").select("id", { count: "exact", head: true }));
            queries.push(supabase.from("students").select("id", { count: "exact", head: true }).ilike("status", "active"));
        }
        
        // Grouped shift counts (using RPC function from migration)
        const shiftCounts = supabase.rpc('get_student_shift_counts');
        queries.push(shiftCounts);
        
        queries.push(supabase.from("classes").select("schedule_days"));
        queries.push(supabase.from("app_accounts").select("platform"));

        const results = await Promise.all(queries);
        studentsResult = results[0];
        activeTeachersResult = results[1];
        allTeachersResult = results[2];
        classesResult = results[3];
        activeStudentsResult = results[4];
        shiftResult = results[5];
        classScheduleResult = results[6];
        appAccountsResult = results[7];
    }

    // Calculate students by shift
    const studentsByShift: Record<string, number> = {};
    if (shiftResult.data) {
        shiftResult.data.forEach((item: any) => {
            // Handle both array of objects with shift field AND RPC result [shift, count]
            const shift = item.shift || "Unassigned";
            const count = item.count ? parseInt(item.count) : 1;
            studentsByShift[shift] = (studentsByShift[shift] || 0) + count;
        });
    }

    // Calculate classes per day and hours per day (each class = 30 mins)
    const classesPerDay: Record<string, number> = {
        Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0
    };

    if (classScheduleResult.data) {
        classScheduleResult.data.forEach((cls: any) => {
            if (cls.schedule_days) {
                Object.keys(cls.schedule_days).forEach((day) => {
                    if (classesPerDay[day] !== undefined) {
                        classesPerDay[day]++;
                    }
                });
            }
        });
    }

    const hoursPerDay: Record<string, number> = {};
    Object.keys(classesPerDay).forEach((day) => {
        hoursPerDay[day] = classesPerDay[day] * 0.5;
    });

    const totalStudents = studentsResult.count || 0;
    const activeStudents = activeStudentsResult.count || 0;

    // Calculate accounts by platform
    const accountsByPlatform: Record<string, number> = {};
    if (appAccountsResult.data) {
        appAccountsResult.data.forEach((account: any) => {
            const platform = account.platform || "Unknown";
            accountsByPlatform[platform] = (accountsByPlatform[platform] || 0) + 1;
        });
    }
    const totalAccounts = appAccountsResult.data?.length || 0;

    // Calculate today's attendance stats
    const today = new Date().toISOString().split('T')[0];
    let attendanceQuery = supabase.from("attendance").select("status").eq("date", today);
    
    if (supervisorId || teacherId) {
        attendanceQuery = attendanceQuery.in("student_id", studentIds);
    }
    
    const { data: attendanceData } = await attendanceQuery;

    let todayAttendancePercentage = 0;
    const attendanceStats = { present: 0, absent: 0, late: 0, leave: 0 };

    if (activeStudents > 0) {
        if (attendanceData) {
            const counts = attendanceData.reduce((acc, curr) => {
                const status = curr.status?.toLowerCase();
                if (status === 'present') acc.present++;
                else if (status === 'absent') acc.absent++;
                else if (status === 'late') acc.late++;
                else if (status === 'leave') acc.leave++;
                return acc;
            }, { present: 0, absent: 0, late: 0, leave: 0 });

            attendanceStats.present = Math.round((counts.present / activeStudents) * 100);
            attendanceStats.absent = Math.round((counts.absent / activeStudents) * 100);
            attendanceStats.late = Math.round((counts.late / activeStudents) * 100);
            attendanceStats.leave = Math.round((counts.leave / activeStudents) * 100);
            
            todayAttendancePercentage = Math.round(((counts.present + counts.late) / activeStudents) * 100);
        }
    }

    return {
        totalStudents,
        activeTeachers: activeTeachersResult.count || 0,
        totalTeachers: allTeachersResult.count || 0,
        totalClasses: classesResult.count || 0,
        activeStudents,
        inactiveStudents: totalStudents - activeStudents,
        studentsByShift,
        classesPerDay,
        hoursPerDay,
        accountsByPlatform,
        totalAccounts,
        todayAttendancePercentage,
        attendanceStats,
        missingAttendanceCount: Math.max(0, activeStudents - (attendanceData?.length || 0))
    };
}


