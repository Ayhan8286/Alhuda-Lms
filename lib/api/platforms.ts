import { supabase } from "@/lib/supabase";
import { Platform, AppAccount, StudentByPlatform } from "@/types/student";

export async function getPlatforms(): Promise<Platform[]> {
    const { data, error } = await supabase
        .from("platforms")
        .select("*")
        .order("name");

    if (error) {
        console.error("Error fetching platforms:", error);
        throw error;
    }

    return data || [];
}

export async function getStudentsByPlatform(platformId: string): Promise<StudentByPlatform[]> {
    // Get app_accounts for this platform
    const { data: accounts, error: accountsError } = await supabase
        .from("app_accounts")
        .select("id, account_identifier, meeting_link")
        .eq("platform_id", platformId);

    if (accountsError || !accounts?.length) {
        return [];
    }

    const accountIds = accounts.map(a => a.id);
    const accountMap = new Map(accounts.map(a => [a.id, { identifier: a.account_identifier, link: a.meeting_link }]));

    // Get classes that use these accounts
    const { data: classes, error: classesError } = await supabase
        .from("classes")
        .select(`
            student_id,
            app_account_id,
            pak_start_time,
            pak_end_time,
            student:students(id, full_name, reg_no),
            teacher:teachers(name)
        `)
        .in("app_account_id", accountIds);

    if (classesError || !classes?.length) {
        return [];
    }

    // Transform to StudentByPlatform format, removing duplicates
    const studentMap = new Map<string, StudentByPlatform>();

    classes.forEach((cls) => {
        // Supabase returns nested relations as arrays for some queries
        const studentData = cls.student;
        const teacherData = cls.teacher;

        // Handle both array and object returns from Supabase
        const student = Array.isArray(studentData) ? studentData[0] : studentData;
        const teacher = Array.isArray(teacherData) ? teacherData[0] : teacherData;

        if (student && !studentMap.has(student.id)) {
            studentMap.set(student.id, {
                student_id: student.id,
                app_account_id: cls.app_account_id,
                student_name: student.full_name,
                student_reg_no: student.reg_no,
                account_identifier: accountMap.get(cls.app_account_id)?.identifier || "Unknown",
                meeting_link: accountMap.get(cls.app_account_id)?.link || null,
                teacher_name: teacher?.name || "Unknown",
                pak_time: `${cls.pak_start_time} - ${cls.pak_end_time}`,
            });
        }
    });

    return Array.from(studentMap.values());
}

export async function getPlatformStats(): Promise<Record<string, number>> {
    const { data: platforms } = await supabase.from("platforms").select("id, name");

    if (!platforms?.length) return {};

    const stats: Record<string, number> = {};

    for (const platform of platforms) {
        const { data: accounts } = await supabase
            .from("app_accounts")
            .select("id")
            .eq("platform_id", platform.id);

        if (accounts?.length) {
            const accountIds = accounts.map(a => a.id);
            const { count } = await supabase
                .from("classes")
                .select("*", { count: "exact", head: true })
                .in("app_account_id", accountIds);

            stats[platform.name] = count || 0;
        } else {
            stats[platform.name] = 0;
        }
    }

    return stats;
}

export async function getAppAccounts(): Promise<AppAccount[]> {
    const { data, error } = await supabase
        .from("app_accounts")
        .select("*")
        .order("platform");

    if (error) {
        console.error("Error fetching app accounts:", error);
        throw error;
    }

    return data || [];
}

export async function updateAppAccount(id: string, updates: Partial<AppAccount>): Promise<AppAccount> {
    const { data, error } = await supabase
        .from("app_accounts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Error updating app account:", error);
        throw error;
    }

    return data;
}
