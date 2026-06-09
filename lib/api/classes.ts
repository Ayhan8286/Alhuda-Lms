import { supabase } from "@/lib/supabase";
import { createNotification } from "./notifications";
import { ClassSchedule, Teacher, TeacherAvailability, Course } from "@/types/student";

export async function getTeachers(): Promise<Teacher[]> {
    const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("is_active", true)
        .order("name");

    if (error) {
        console.error("Error fetching teachers:", error);
        throw error;
    }

    return data || [];
}

export async function getCourses(): Promise<Course[]> {
    const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("name");

    if (error) {
        console.error("Error fetching courses:", error);
        throw error;
    }

    return data || [];
}

export async function addTeacher(teacher: Omit<Teacher, "id" | "is_active">): Promise<Teacher> {
    const newTeacher = {
        ...teacher,
        id: crypto.randomUUID(),
        is_active: true
    };

    const { data, error } = await supabase
        .from("teachers")
        .insert([newTeacher])
        .select()
        .single();

    if (error) {
        console.error("Error adding teacher:", error);
        throw error;
    }

    // Trigger System Notification
    try {
        await createNotification({
            type: 'SUCCESS',
            title: 'New Teacher Assigned',
            message: `${data.name} has been added as a teacher and assigned to a supervisor.`,
            sender_id: data.supervisor_id || undefined,
            link: '/departments/teacher'
        });
    } catch (notifErr) {
        console.error("Failed to create notification:", notifErr);
    }

    return data;
}

export async function getTeacherById(id: string): Promise<Teacher | null> {
    const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error("Error fetching teacher:", error);
        return null;
    }

    return data;
}

export async function deleteTeacher(id: string): Promise<void> {
    // 1. Delete associated classes
    const { error: classesError } = await supabase
        .from("classes")
        .delete()
        .eq("teacher_id", id);

    if (classesError) {
        console.error("Error deleting teacher classes:", classesError);
    } // Ignoring if no classes, just logging

    // 2. Delete the availability 
    const { error: availabilityError } = await supabase
        .from("teacher_availability")
        .delete()
        .eq("teacher_id", id);

    if (availabilityError) {
        console.error("Error deleting teacher availability:", availabilityError);
    }

    // 3. Delete associated complaints
    const { error: complaintsError } = await supabase
        .from("complaints")
        .delete()
        .eq("teacher_id", id);

    if (complaintsError) {
        console.error("Error deleting teacher complaints:", complaintsError);
    }

    // 4. Finally delete the teacher
    const { error } = await supabase
        .from("teachers")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting teacher:", error);
        throw error;
    }
}

export async function getTeacherClasses(teacherId: string): Promise<(ClassSchedule & { student: { id: string; full_name: string; reg_no: string } })[]> {
    const { data, error } = await supabase
        .from("classes")
        .select(`
      *,
      student:students(id, full_name, reg_no),
      course:courses(id, name)
    `)
        .eq("teacher_id", teacherId);

    if (error) {
        console.error("Error fetching teacher classes:", error);
        throw error;
    }

    return data || [];
}

export async function getStudentClasses(studentId: string): Promise<ClassSchedule[]> {
    const { data, error } = await supabase
        .from("classes")
        .select(`
      *,
      teacher:teachers(id, name, staff_id, meet_link),
      app_account:app_accounts(id, platform, account_identifier),
      course:courses(id, name)
    `)
        .eq("student_id", studentId);

    if (error) {
        console.error("Error fetching student classes:", error);
        throw error;
    }

    return data || [];
}

export async function getStudentsByTeacher(teacherId: string): Promise<{ student_id: string; student: { id: string; full_name: string; reg_no: string } }[]> {
    const { data, error } = await supabase
        .from("classes")
        .select(`
      student_id,
      student:students(id, full_name, reg_no)
    `)
        .eq("teacher_id", teacherId);

    if (error) {
        console.error("Error fetching students by teacher:", error);
        throw error;
    }

    // Filter out duplicates (same student in multiple classes)
    const uniqueStudents = new Map();
    data?.forEach(item => {
        if (item.student && !uniqueStudents.has(item.student_id)) {
            uniqueStudents.set(item.student_id, item);
        }
    });

    return Array.from(uniqueStudents.values());
}

export async function updateClass(id: string, updates: Partial<ClassSchedule>): Promise<void> {
    const { error } = await supabase
        .from("classes")
        .update(updates)
        .eq("id", id);

    if (error) {
        console.error("Error updating class:", error);
        throw error;
    }
}

export async function addClass(classData: Omit<ClassSchedule, "id" | "teacher" | "app_account" | "course">): Promise<ClassSchedule> {
    const { data, error } = await supabase
        .from("classes")
        .insert([classData])
        .select()
        .single();

    if (error) {
        console.error("Error adding class:", error);
        throw error;
    }

    return data;
}

export async function getAllClasses(): Promise<(ClassSchedule & { teacher: Teacher })[]> {
    const { data, error } = await supabase
        .from("classes")
        .select(`
      *,
      teacher:teachers(*),
      student:students(id, full_name, reg_no),
      course:courses(id, name)
    `);

    if (error) {
        console.error("Error fetching all classes:", error);
        throw error;
    }

    return data || [];
}

export async function getAllTeacherAvailability(): Promise<TeacherAvailability[]> {
    const { data, error } = await supabase
        .from("teacher_availability")
        .select("*");

    if (error) {
        console.error("Error fetching teacher availability:", error);
        throw error;
    }

    return data || [];
}

export async function deleteClass(id: string): Promise<void> {
    const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting class:", error);
        throw error;
    }
}

export async function getTeachersBySupervisor(supervisorId: string): Promise<Teacher[]> {
    const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("supervisor_id", supervisorId)
        .eq("is_active", true)
        .order("name");

    if (error) {
        console.error("Error fetching teachers by supervisor:", error);
        throw error;
    }

    return data || [];
}

export async function updateTeacherSupervisor(
    teacherId: string,
    supervisorId: string | null
): Promise<void> {
    const { error } = await supabase
        .from("teachers")
        .update({ supervisor_id: supervisorId })
        .eq("id", teacherId);

    if (error) {
        console.error("Error updating teacher supervisor:", error);
        throw error;
    }
}

export async function updateTeacher(
    id: string,
    updates: Partial<Omit<Teacher, "id">>
): Promise<void> {
    const { error } = await supabase
        .from("teachers")
        .update(updates)
        .eq("id", id);

    if (error) {
        console.error("Error updating teacher:", error);
        throw error;
    }
}

/**
 * Returns a map of supervisorId -> { teacherCount, studentCount }
 * by fetching all teachers with their classes in a single joined query.
 */
export async function getSupervisorStats(): Promise<Record<string, { teachers: number; students: number }>> {
    // Try to use the optimized view if it exists
    const { data, error } = await supabase
        .from("supervisor_stats_summary")
        .select("*");

    if (error) {
        console.warn("Supervisor stats view not found, falling back to manual fetch. Run migration_optimization.sql for better performance.");
        // Fallback to manual (keeping old logic but slightly optimized)
        const { data: fallbackData } = await supabase.from("teachers").select("supervisor_id, classes:classes(student_id)").eq("is_active", true);
        const stats: Record<string, { teachers: number; students: Set<string> }> = {};
        (fallbackData || []).forEach((t: any) => {
            if (!t.supervisor_id) return;
            if (!stats[t.supervisor_id]) stats[t.supervisor_id] = { teachers: 0, students: new Set() };
            stats[t.supervisor_id].teachers++;
            t.classes?.forEach((c: any) => c.student_id && stats[t.supervisor_id].students.add(c.student_id));
        });
        const res: Record<string, { teachers: number; students: number }> = {};
        Object.entries(stats).forEach(([id, s]) => res[id] = { teachers: s.teachers, students: s.students.size });
        return res;
    }

    const result: Record<string, { teachers: number; students: number }> = {};
    data.forEach((row: any) => {
        if (row.supervisor_id) {
            result[row.supervisor_id] = { 
                teachers: parseInt(row.teacher_count), 
                students: parseInt(row.student_count) 
            };
        }
    });
    return result;
}

export async function getTeacherStats(): Promise<Record<string, { students: number }>> {
    const { data, error } = await supabase
        .from("teacher_student_counts")
        .select("*");

    if (error) {
        console.warn("Teacher stats view not found, falling back. Run migration_optimization.sql.");
        const { data: fallbackData } = await supabase.from("classes").select("teacher_id, student_id");
        const stats: Record<string, Set<string>> = {};
        (fallbackData || []).forEach((c: any) => {
            if (!c.teacher_id) return;
            if (!stats[c.teacher_id]) stats[c.teacher_id] = new Set();
            stats[c.teacher_id].add(c.student_id);
        });
        const res: Record<string, { students: number }> = {};
        Object.entries(stats).forEach(([id, s]) => res[id] = { students: s.size });
        return res;
    }

    const result: Record<string, { students: number }> = {};
    data.forEach((row: any) => {
        if (row.teacher_id) {
            result[row.teacher_id] = { students: parseInt(row.student_count) };
        }
    });
    return result;
}
