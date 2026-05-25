"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { DailyReport } from "@/lib/api/reports";

export async function submitDailyReportAction(report: Omit<DailyReport, "id" | "created_at">) {
    console.log("Server Action: Submitting report", report);
    
    const supabaseAdmin = getSupabaseAdmin();
    
    // Using upsert on the server with the service role
    const { error, data } = await supabaseAdmin
        .from("daily_reports")
        .upsert([report], { onConflict: 'student_id, date, report_type' });

    if (error) {
        console.error("Server Action Error:", error);
        throw new Error(error.message);
    }

    return { success: true, data };
}
