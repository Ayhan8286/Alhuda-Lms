import { unstable_cache } from "next/cache";
import { getDashboardStats } from "@/lib/api/dashboard";
import DashboardClient from "@/components/DashboardClient";
import StudentDashboard from "@/components/StudentDashboard";
import { cookies } from "next/headers";

// Cache the dashboard stats at the server level for 5 minutes.
// This is only used for Admins (global stats).
const getCachedDashboardStats = unstable_cache(
  async () => getDashboardStats(),
  ["dashboard-stats"],
  { revalidate: 300 } // 5 minutes
);

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("auth_role")?.value || "admin";
  const supervisorId = cookieStore.get("supervisor_id")?.value;
  const teacherId = cookieStore.get("teacher_id")?.value;
  const studentId = cookieStore.get("student_id")?.value;

  // Render specialised dashboard for student role
  if (role === "student" && studentId) {
    return <StudentDashboard studentId={studentId} />;
  }

  // If it's a supervisor or teacher, we fetch fresh stats for their specific view.
  // For admins, we use the cached global stats.
  const initialStats = (role === "supervisor" && supervisorId)
    ? await getDashboardStats(supervisorId)
    : (role === "teacher" && teacherId)
      ? await getDashboardStats(undefined, teacherId)
      : await getCachedDashboardStats();

  return (
    <DashboardClient 
      initialStats={initialStats} 
      role={role} 
      supervisorId={supervisorId} 
      teacherId={teacherId}
    />
  );
}
