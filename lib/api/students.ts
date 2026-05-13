import { supabase } from "@/lib/supabase";
import { Student } from "@/types/student";
import { createNotification } from "./notifications";

export interface GetStudentsParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    shift?: string;
    supervisorId?: string;
    teacherId?: string;
}

export async function getStudents(params: GetStudentsParams = {}): Promise<{ data: Student[], count: number }> {
    const { page = 1, limit = 20, search, status, shift, supervisorId, teacherId } = params;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from("students")
        .select(`
            *,
            supervisor:supervisors(name),
            classes(id, course:courses(name))
        `, { count: 'exact' });

    // Apply Filters
    if (search) {
        query = query.or(`full_name.ilike.%${search}%,reg_no.ilike.%${search}%`);
    }
    if (status && status !== "All Status") {
        query = query.ilike("status", status);
    }
    if (shift && shift !== "All Shifts") {
        query = query.ilike("shift", shift);
    }
    
    // Role based filtering
    if (supervisorId) {
        // Since we can't easily join deep relations with 'or' in a single filter-heavy query,
        // we might need to stick to the specific supervisor/teacher logic or use a view/rpc.
        // For now, I'll keep the direct supervisor_id filter for the paginated list.
        query = query.eq("supervisor_id", supervisorId);
    } else if (teacherId) {
        // For teachers, we fetch linked student IDs first (similar to existing logic but integrated)
        const { data: teacherClasses } = await supabase.from("classes").select("student_id").eq("teacher_id", teacherId);
        const ids = (teacherClasses || []).map(tc => tc.student_id);
        if (ids.length === 0) return { data: [], count: 0 };
        query = query.in("id", ids);
    }

    const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        console.error("Error fetching students:", error);
        throw error;
    }

    const mappedData = (data || []).map((student: any) => ({
        ...student,
        classes: student.classes?.map((cls: any) => ({
            ...cls,
            course: Array.isArray(cls.course) ? cls.course[0] : cls.course
        })),
        supervisor: Array.isArray(student.supervisor) ? student.supervisor[0] : student.supervisor
    }));

    return { data: mappedData, count: count || 0 };
}

export async function getStudentsBySupervisor(supervisorId: string): Promise<Student[]> {
    // 1. Get all teachers assigned to this supervisor
    const { data: teachers, error: teachersError } = await supabase
        .from("teachers")
        .select("id")
        .eq("supervisor_id", supervisorId);

    if (teachersError) {
        console.error("Error fetching supervisor teachers:", teachersError);
        throw teachersError;
    }

    const teacherIds = (teachers || []).map(t => t.id);

    // 2. Get students linked via these teachers' classes
    const { data: classStudents, error: classesError } = await supabase
        .from("classes")
        .select("student_id")
        .in("teacher_id", teacherIds);

    if (classesError) {
        console.error("Error fetching students via classes:", classesError);
        throw classesError;
    }

    const linkedStudentIds = (classStudents || []).map(cs => cs.student_id);

    // 3. Fetch students who match either the teacher-link OR a direct supervisor_id
    const { data: students, error: studentsError } = await supabase
        .from("students")
        .select(`
            id, full_name, reg_no, guardian_name, status, shift, guardian_id, shift_id, supervisor_id,
            supervisor:supervisors(name),
            classes(
                course:courses(name)
            )
        `)
        .or(`supervisor_id.eq.${supervisorId},id.in.(${linkedStudentIds.length > 0 ? linkedStudentIds.join(',') : 'null'})`);

    if (studentsError) {
        console.error("Error fetching students by supervisor domain:", studentsError);
        throw studentsError;
    }

    return (students || []).map((student: any) => ({
        ...student,
        classes: student.classes?.map((cls: any) => ({
            ...cls,
            course: Array.isArray(cls.course) ? cls.course[0] : cls.course
        })),
        supervisor: Array.isArray(student.supervisor) ? student.supervisor[0] : student.supervisor
    }));
}

export async function getStudentsCount(): Promise<number> {
    const { count, error } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true });

    if (error) {
        console.error("Error fetching students count:", error);
        throw error;
    }

    return count || 0;
}

export async function getStudentById(id: string): Promise<Student | null> {
    const { data, error } = await supabase
        .from("students")
        .select(`
            *,
            supervisor:supervisors(name)
        `)
        .eq("id", id)
        .single();

    if (error) {
        console.error("Error fetching student:", error);
        return null;
    }

    return data;
}

export async function getSiblings(student: Student): Promise<Student[]> {
    if (!student.guardian_id && !student.guardian_name) {
        return [];
    }

    let query = supabase
        .from("students")
        .select("*")
        .neq("id", student.id);

    if (student.guardian_id) {
        query = query.eq("guardian_id", student.guardian_id);
    } else if (student.guardian_name) {
        query = query.eq("guardian_name", student.guardian_name);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching siblings:", error);
        return [];
    }

    return data || [];
}

export async function updateStudent(
    id: string,
    updates: Partial<Pick<Student, "full_name" | "status" | "shift" | "reg_no" | "supervisor_id" | "guardian_name" | "performance_notes">>
): Promise<Student | null> {
    const { data, error } = await supabase
        .from("students")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Error updating student:", error);
        throw error;
    }

    return data;
}

export async function addStudent(
    student: Omit<Student, "id">
): Promise<Student> {
    const newStudent = { ...student, id: crypto.randomUUID() };
    const { data, error } = await supabase
        .from("students")
        .insert([newStudent])
        .select()
        .single();

    if (error) {
        console.error("Error adding student:", error);
        throw error;
    }

    // Trigger System Notification
    try {
        await createNotification({
            type: 'SUCCESS',
            title: 'New Student Registered',
            message: `${data.full_name} has been enrolled in the system.`,
            sender_id: data.supervisor_id || undefined,
            link: `/students/${data.id}`,
            metadata: { student_id: data.id }
        });
    } catch (notifErr) {
        console.error("Failed to create notification:", notifErr);
    }

    return data;
}

export async function deleteStudent(id: string): Promise<void> {
    // 1. Delete associated attendance
    const { error: attendanceError } = await supabase
        .from("attendance")
        .delete()
        .eq("student_id", id);

    if (attendanceError) {
        console.error("Error deleting student attendance:", attendanceError);
        throw attendanceError;
    }

    // 2. Delete associated complaints
    const { error: complaintsError } = await supabase
        .from("complaints")
        .delete()
        .eq("student_id", id);

    if (complaintsError) {
        console.error("Error deleting student complaints:", complaintsError);
        throw complaintsError;
    }

    // 3. Delete associated classes
    const { error: classesError } = await supabase
        .from("classes")
        .delete()
        .eq("student_id", id);

    if (classesError) {
        console.error("Error deleting student classes:", classesError);
        throw classesError;
    }

    // 5. Finally, delete the student
    const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting student:", error);
        throw error;
    }

    // Trigger System Notification
    try {
        await createNotification({
            type: 'WARNING',
            title: 'Student Removed',
            message: `A student record (ID: ${id}) has been permanently deleted.`,
            link: '/students'
        });
    } catch (notifErr) {
        console.error("Failed to create notification:", notifErr);
    }
}

export async function getStudentsByTeacher(teacherId: string): Promise<Student[]> {
    // 1. Get all student IDs linked to this teacher via classes
    const { data: teacherClasses, error: classesError } = await supabase
        .from("classes")
        .select("student_id")
        .eq("teacher_id", teacherId);

    if (classesError) {
        console.error("Error fetching students via classes:", classesError);
        throw classesError;
    }

    const studentIds = (teacherClasses || []).map(tc => tc.student_id);

    if (studentIds.length === 0) return [];

    // 2. Fetch student details for these IDs
    const { data, error } = await supabase
        .from("students")
        .select(`
            id, full_name, reg_no, guardian_name, status, shift, guardian_id, shift_id, supervisor_id,
            supervisor:supervisors(name),
            classes(
                course:courses(name)
            )
        `)
        .in("id", studentIds);

    if (error) {
        console.error("Error fetching students by teacher:", error);
        throw error;
    }

    return (data || []).map((student: any) => ({
        ...student,
        classes: student.classes?.map((cls: any) => ({
            ...cls,
            course: Array.isArray(cls.course) ? cls.course[0] : cls.course
        })),
        supervisor: Array.isArray(student.supervisor) ? student.supervisor[0] : student.supervisor
    }));
}
