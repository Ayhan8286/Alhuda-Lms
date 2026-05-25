export interface Complaint {
    id: string;
    student_id: string;
    teacher_id: string;
    title: string; // Required
    description: string;
    status: "Pending" | "Reviewed" | "Resolved";
    priority?: "Low" | "Medium" | "High";
    created_at: string;
    resolved_at?: string;
    student?: {
        full_name: string;
        reg_no: string;
        supervisor?: { name: string } | null;
        classes?: {
            teacher: { name: string } | null;
        }[];
    };
    teacher?: {
        name: string;
        staff_id: string;
    };
}
