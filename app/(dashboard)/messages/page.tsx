import MessagesClient from "@/components/messages/MessagesClient";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export default async function MessagesPage() {
    const cookieStore = await cookies();
    const role = cookieStore.get("auth_role")?.value || "admin";
    const department = cookieStore.get("dept_role")?.value || "Supervisor";
    let userName = role === "admin" ? "Admin" : "User";
    let userId = "unknown";
    let supervisorId: string | undefined = undefined;

    if (role === "admin") {
        userId = cookieStore.get("admin_id")?.value || "unknown";
        const token = cookieStore.get("supabase_access_token")?.value;
        if (token && userId === "unknown") {
            try {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                userId = payload.sub || "unknown";
            } catch (e) {
                console.error("Failed to decode admin token in messages page");
            }
        }
    } else if (role === "supervisor") {
        userId = cookieStore.get("supervisor_id")?.value || "unknown";
        supervisorId = userId; // For supervisors, they are their own supervisor
        try {
            const { data } = await supabase.from("supervisors").select("name").eq("id", userId).single();
            if (data?.name) userName = data.name;
        } catch (e) {}
    } else if (role === "teacher") {
        userId = cookieStore.get("teacher_id")?.value || "unknown";
        try {
            const { data } = await supabase.from("teachers").select("name, supervisor_id").eq("id", userId).single();
            if (data?.name) userName = data.name;
            if (data?.supervisor_id) supervisorId = data.supervisor_id;
        } catch (e) {}
    } else if (role === "student") {
        userId = cookieStore.get("student_id")?.value || "unknown";
        try {
            const { data } = await supabase.from("students").select("full_name, supervisor_id").eq("id", userId).single();
            if (data?.full_name) userName = data.full_name;
            if (data?.supervisor_id) supervisorId = data.supervisor_id;
        } catch (e) {}
    }

    const currentUser = {
        id: userId,
        name: userName,
        role,
        department,
        supervisorId
    };

    return <MessagesClient currentUser={currentUser} />;
}
