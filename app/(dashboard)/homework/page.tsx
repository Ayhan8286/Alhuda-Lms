import { cookies } from "next/headers";
import TeacherHomeworkClient from "@/components/homework/TeacherHomeworkClient";
import StudentHomeworkClient from "@/components/homework/StudentHomeworkClient";
import { BookOpen } from "lucide-react";

export default async function HomeworkPage() {
    const cookieStore = await cookies();
    const role = cookieStore.get("auth_role")?.value || "admin";
    const teacherId = cookieStore.get("teacher_id")?.value || "";
    const studentId = cookieStore.get("student_id")?.value || "";

    if (role === "student" && studentId) {
        return (
            <div className="flex-1 overflow-y-auto flex flex-col relative w-full mx-auto">
                <div className="organic-blob bg-primary-container/20 w-[600px] h-[600px] -top-48 -left-24 fixed blur-[120px]" />
                <div className="organic-blob bg-tertiary-container/20 w-[500px] h-[500px] bottom-0 right-0 fixed blur-[100px]" />
                <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-8 flex-1 relative z-10 pt-20 md:pt-8">
                    <StudentHomeworkClient studentId={studentId} />
                </div>
            </div>
        );
    }

    if (role === "teacher" && teacherId) {
        return (
            <div className="flex-1 overflow-y-auto flex flex-col relative w-full mx-auto">
                <div className="organic-blob bg-primary-container/20 w-[600px] h-[600px] -top-48 -left-24 fixed blur-[120px]" />
                <div className="organic-blob bg-tertiary-container/20 w-[500px] h-[500px] bottom-0 right-0 fixed blur-[100px]" />
                <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-8 flex-1 relative z-10 pt-20 md:pt-8">
                    <TeacherHomeworkClient teacherId={teacherId} />
                </div>
            </div>
        );
    }

    // Admins / Supervisors fallback
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[70vh] max-w-lg mx-auto">
            {/* Organic blobs */}
            <div className="organic-blob bg-primary-container/20 w-[300px] h-[300px] -top-12 -left-12 fixed" />
            <div className="organic-blob bg-secondary-container/10 w-[250px] h-[250px] bottom-12 right-12 fixed" />

            <div className="relative z-10 space-y-6">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <BookOpen className="h-8 w-8" />
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary mb-1">Al Huda Academic Hub</p>
                    <h1 className="text-3xl font-black text-emerald-950 dark:text-white leading-tight">
                        Homework & Recitations
                    </h1>
                    <p className="text-emerald-800/60 dark:text-emerald-200/50 mt-2 text-sm font-medium leading-relaxed">
                        A premium platform enabling teachers to assign lessons, and students to submit written answers or record browser-native audio recitations.
                    </p>
                </div>
                
                <div className="w-full p-6 rounded-3xl glass-panel border border-white/20 dark:border-white/5 bg-white/40 dark:bg-black/20 text-left space-y-4 shadow-sm">
                    <p className="text-[11px] font-bold text-emerald-800/40 dark:text-emerald-200/40 uppercase tracking-widest text-center">Dashboard Details</p>
                    <div className="flex justify-between items-center text-sm font-semibold border-b border-emerald-950/5 dark:border-white/5 pb-2">
                        <span className="text-muted-foreground">Current Role:</span>
                        <span className="capitalize text-foreground font-black bg-emerald-100 dark:bg-emerald-800/40 px-2.5 py-0.5 rounded-full text-xs text-primary-hover dark:text-primary">{role}</span>
                    </div>
                    <p className="text-xs text-center text-muted-foreground leading-normal">
                        To experience the interactive workflows, please sign in with either a **Student** or **Teacher** profile.
                    </p>
                </div>
            </div>
        </div>
    );
}
