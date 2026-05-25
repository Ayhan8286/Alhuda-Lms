import { supabase } from "@/lib/supabase";
import { createNotification } from "./notifications";
import { Complaint } from "@/types/complaint";

export async function getComplaints(): Promise<Complaint[]> {
    const { data, error } = await supabase
        .from("complaints")
        .select(`
            *,
            student:students(
                full_name, 
                reg_no,
                supervisor:supervisors(name),
                classes(
                    teacher:teachers(name)
                )
            ),
            teacher:teachers(name, staff_id)
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching complaints:", error);
        throw error;
    }

    return (data || []).map((item) => ({
        ...item,
        student: Array.isArray(item.student) ? item.student[0] : item.student,
        teacher: Array.isArray(item.teacher) ? item.teacher[0] : item.teacher,
    }));
}

export async function addComplaint(complaint: Partial<Complaint>): Promise<Complaint> {
    const { data, error } = await supabase
        .from("complaints")
        .insert(complaint)
        .select()
        .single();

    if (error) {
        console.error("Error adding complaint:", JSON.stringify(error, null, 2));
        throw error;
    }

    // Trigger System Notification
    try {
        await createNotification({
            type: 'WARNING',
            title: 'New Complaint Filed',
            message: `A new complaint has been registered: ${data.category}`,
            sender_id: data.supervisor_id || undefined,
            link: '/complaints',
            metadata: { student_id: data.student_id }
        });
    } catch (notifErr) {
        console.error("Failed to create notification:", notifErr);
    }

    return data;
}

export async function updateComplaintStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
        .from("complaints")
        .update({ status })
        .eq("id", id);

    if (error) {
        console.error("Error updating complaint status:", error);
        throw error;
    }
}

export async function deleteComplaint(id: string): Promise<void> {
    const { error } = await supabase
        .from("complaints")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting complaint:", error);
        throw error;
    }
}
