export interface Student {
    id: string;
    reg_no: string;
    full_name: string;
    guardian_name: string;
    status: string;
    shift: string;
    guardian_id: string | null;
    shift_id: string | null;
    supervisor_id: string | null;
    classes?: { 
        course: { name: string } | null;
        app_account?: { platform: string } | null;
    }[];
    supervisor?: { name: string } | null;
    performance_notes?: string | null;
}

export interface Course {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
}

export interface Teacher {
    id: string;
    staff_id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    timing?: string | null;
    password?: string | null;
    department?: string | null;
    is_active: boolean;
    supervisor_id: string | null;
    meet_link?: string | null;
}

export interface OnlineSession {
    id: string;
    teacher_id: string;
    student_id: string;
    class_id?: string | null;
    title: string;
    meet_link: string;
    scheduled_date: string;
    scheduled_time: string;
    duration_mins: number;
    status: 'scheduled' | 'live' | 'completed' | 'cancelled';
    notes?: string | null;
    created_at: string;
    // Joined fields
    teacher?: { id: string; name: string } | null;
    student?: { id: string; full_name: string; reg_no: string } | null;
}

export interface TeacherAvailability {
    id: string;
    teacher_id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    is_booked: boolean;
}

export interface ClassSchedule {
    id: string;
    teacher_id: string;
    student_id: string;
    app_account_id: string | null;
    pak_start_time: string;
    pak_end_time: string;
    uk_start_time: string;
    uk_end_time: string;
    schedule_days: Record<string, string>;
    teacher?: Teacher;
    app_account?: AppAccount;
    course_id: string | null;
    course?: Course;
    student?: { id: string; full_name: string; reg_no: string };
}

export interface AttendanceRecord {
    id?: string;
    student_id: string;
    class_id?: string | null;
    date: string;
    status: "Present" | "Absent" | "Late" | "Leave";
    remarks?: string | null;
    marked_by?: string | null;
}

export interface Platform {
    id: string;
    name: string;
    created_at: string;
}

export interface AppAccount {
    id: string;
    platform: string;
    account_identifier: string;
    platform_id: string;
    meeting_link?: string | null;
}

export interface StudentByPlatform {
    student_id: string;
    app_account_id: string; // Added for platform management
    student_name: string;
    student_reg_no: string;
    account_identifier: string;
    teacher_name: string;
    pak_time: string;
    meeting_link?: string | null;
}
