import { supabase } from "@/lib/supabase";
import { OnlineSession } from "@/types/student";

// ─── Meet Link Management ───────────────────────────────────────

export async function getTeacherMeetLink(teacherId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from("teachers")
        .select("meet_link")
        .eq("id", teacherId)
        .single();

    if (error) {
        console.error("Error fetching meet link:", error);
        return null;
    }

    return data?.meet_link || null;
}

export async function updateTeacherMeetLink(teacherId: string, meetLink: string): Promise<void> {
    const { error } = await supabase
        .from("teachers")
        .update({ meet_link: meetLink })
        .eq("id", teacherId);

    if (error) {
        console.error("Error updating meet link:", error);
        throw error;
    }
}

// ─── Online Sessions CRUD ───────────────────────────────────────

export async function getSessionsByTeacher(
    teacherId: string,
    date?: string
): Promise<OnlineSession[]> {
    let query = supabase
        .from("online_sessions")
        .select(`
            *,
            student:students(id, full_name, reg_no)
        `)
        .eq("teacher_id", teacherId)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

    if (date) {
        query = query.eq("scheduled_date", date);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching teacher sessions:", error);
        throw error;
    }

    return data || [];
}

export async function getSessionsByStudent(studentId: string): Promise<OnlineSession[]> {
    const { data, error } = await supabase
        .from("online_sessions")
        .select(`
            *,
            teacher:teachers(id, name)
        `)
        .eq("student_id", studentId)
        .in("status", ["scheduled", "live"])
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

    if (error) {
        console.error("Error fetching student sessions:", error);
        throw error;
    }

    return data || [];
}

export async function getStudentSessionHistory(studentId: string): Promise<OnlineSession[]> {
    const { data, error } = await supabase
        .from("online_sessions")
        .select(`
            *,
            teacher:teachers(id, name)
        `)
        .eq("student_id", studentId)
        .in("status", ["completed", "cancelled"])
        .order("scheduled_date", { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error fetching student session history:", error);
        throw error;
    }

    return data || [];
}

export async function createSession(session: {
    teacher_id: string;
    student_id: string;
    class_id?: string | null;
    title: string;
    meet_link: string;
    scheduled_date: string;
    scheduled_time: string;
    duration_mins?: number;
    notes?: string | null;
}): Promise<OnlineSession> {
    const { data, error } = await supabase
        .from("online_sessions")
        .insert([{
            ...session,
            duration_mins: session.duration_mins || 30,
            status: "scheduled",
        }])
        .select(`
            *,
            student:students(id, full_name, reg_no)
        `)
        .single();

    if (error) {
        console.error("Error creating session:", error);
        throw error;
    }

    return data;
}

export async function updateSessionStatus(
    id: string,
    status: "scheduled" | "live" | "completed" | "cancelled"
): Promise<void> {
    const { error } = await supabase
        .from("online_sessions")
        .update({ status })
        .eq("id", id);

    if (error) {
        console.error("Error updating session status:", error);
        throw error;
    }
}

export async function updateSession(
    id: string,
    updates: Partial<Pick<OnlineSession, "title" | "scheduled_date" | "scheduled_time" | "duration_mins" | "meet_link" | "notes">>
): Promise<void> {
    const { error } = await supabase
        .from("online_sessions")
        .update(updates)
        .eq("id", id);

    if (error) {
        console.error("Error updating session:", error);
        throw error;
    }
}

export async function deleteSession(id: string): Promise<void> {
    const { error } = await supabase
        .from("online_sessions")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting session:", error);
        throw error;
    }
}
