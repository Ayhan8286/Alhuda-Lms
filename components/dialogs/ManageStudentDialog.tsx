"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getStudentById, updateStudent } from "@/lib/api/students";
import { getStudentClasses, updateClass, addClass, deleteClass, getTeachers, getCourses } from "@/lib/api/classes";
import { getSupervisors } from "@/lib/api/supervisors";
import { getAppAccounts } from "@/lib/api/platforms";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
    Loader2, 
    Save, 
    User, 
    Calendar, 
    Plus,
    Trash2, 
    X,
    Check,
    Globe,
} from "lucide-react";
import { ClassSchedule, Teacher, AppAccount, Course } from "@/types/student";
import { Supervisor } from "@/types/supervisor";
import { FormInput } from "@/components/ui/form-input";
import { Badge } from "@/components/ui/badge";
import { TimeSelect } from "@/components/ui/time-select";
import { convertPkToUk } from "@/lib/utils/time";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ManageStudentDialogProps {
    studentId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function ManageStudentDialog({ studentId, open, onOpenChange, onSuccess }: ManageStudentDialogProps) {
    const queryClient = useQueryClient();
    
    // ─── Queries ─────────────────────────────────────────────────
    const { data: student, isLoading: studentLoading } = useQuery({
        queryKey: ["student", studentId],
        queryFn: () => studentId ? getStudentById(studentId) : Promise.resolve(null),
        enabled: !!studentId && open,
    });

    const { data: studentClasses = [], isLoading: classesLoading } = useQuery({
        queryKey: ["studentClasses", studentId],
        queryFn: () => studentId ? getStudentClasses(studentId) : Promise.resolve([]),
        enabled: !!studentId && open,
    });

    const { data: supervisors = [] } = useQuery({
        queryKey: ["supervisors"],
        queryFn: () => getSupervisors(),
        enabled: open,
    });

    const { data: teachers = [] } = useQuery({
        queryKey: ["activeTeachers"],
        queryFn: getTeachers,
        enabled: open,
    });

    const { data: appAccounts = [] } = useQuery({
        queryKey: ["appAccounts"],
        queryFn: getAppAccounts,
        enabled: open,
    });

    const { data: courses = [] } = useQuery({
        queryKey: ["courses"],
        queryFn: getCourses,
        enabled: open,
    });

    const [showAddCourse, setShowAddCourse] = useState(false);

    // ─── Profile Form State ──────────────────────────────────────
    const [profileForm, setProfileForm] = useState({
        full_name: "",
        reg_no: "",
        guardian_name: "",
        status: "Active",
        shift: "",
        supervisor_id: "",
        email: "",
        password: "student123",
    });

    useEffect(() => {
        if (student) {
            const getEmail = (notes?: string | null) => {
                if (!notes) return "";
                const match = notes.match(/\[EMAIL:(.*?)\]/);
                return match ? match[1] : "";
            };
            const getPassword = (notes?: string | null) => {
                if (!notes) return "student123";
                const match = notes.match(/\[PASSWORD:(.*?)\]/);
                return match ? match[1] : "student123";
            };

            setProfileForm({
                full_name: student.full_name || "",
                reg_no: student.reg_no || "",
                guardian_name: student.guardian_name || "",
                status: student.status || "Active",
                shift: student.shift || "",
                supervisor_id: student.supervisor_id || "",
                email: getEmail(student.performance_notes),
                password: getPassword(student.performance_notes),
            });
        }
    }, [student]);

    useEffect(() => {
        if (studentClasses.length > 0 && teachers.length > 0) {
            const firstClass = studentClasses[0];
            const teacher = teachers.find(t => t.id === firstClass.teacher_id);
            if (teacher && teacher.supervisor_id) {
                setProfileForm(f => ({ ...f, supervisor_id: teacher.supervisor_id || "" }));
            }
        }
    }, [studentClasses, teachers]);

    // ─── Mutations ───────────────────────────────────────────────
    const updateProfileMutation = useMutation({
        mutationFn: async () => {
            if (!studentId) return;

            // Extract existing notes, strip old credentials, and inject updated tags
            let cleanNotes = student?.performance_notes || "";
            cleanNotes = cleanNotes.replace(/\[EMAIL:.*?\]/g, "").trim();
            cleanNotes = cleanNotes.replace(/\[PASSWORD:.*?\]/g, "").trim();
            const updatedNotes = `${cleanNotes} [EMAIL:${profileForm.email}] [PASSWORD:${profileForm.password}]`.trim();

            const updatePayload = {
                full_name: profileForm.full_name,
                reg_no: profileForm.reg_no,
                guardian_name: profileForm.guardian_name,
                status: profileForm.status,
                shift: profileForm.shift,
                supervisor_id: profileForm.supervisor_id || null,
                performance_notes: updatedNotes,
            };

            return await updateStudent(studentId, updatePayload as any);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["student", studentId] });
            queryClient.invalidateQueries({ queryKey: ["students"] });
            toast.success("Profile updated");
            onSuccess?.();
        },
    });

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] h-[95vh] sm:h-[85vh] overflow-hidden flex flex-col p-0 rounded-[32px] border-border bg-card shadow-2xl">
                {/* Compact Header */}
                <div className="px-8 py-6 border-b border-border bg-accent/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-lg">
                            {student?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??"}
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black text-foreground tracking-tight leading-none">
                                {studentLoading ? "Syncing..." : student?.full_name}
                            </DialogTitle>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                {student?.reg_no || "Registration Pending"} • {student?.status}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => updateProfileMutation.mutate()} className="p-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 mr-8">
                        {updateProfileMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20">
                    <div className="p-6 space-y-12 pb-24">
                        
                        {/* ── SECTION 1: IDENTITY ─────────────────────────── */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <User className="size-3.5 text-primary" />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Identity & Hierarchy</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-accent/5 p-5 rounded-[24px] border border-border/50">
                                <FormInput
                                    label="Legal Name"
                                    value={profileForm.full_name}
                                    onChange={(e) => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                                    className="h-10 text-xs font-bold"
                                />
                                <FormInput
                                    label="Guardian"
                                    value={profileForm.guardian_name}
                                    onChange={(e) => setProfileForm(f => ({ ...f, guardian_name: e.target.value }))}
                                    className="h-10 text-xs font-bold"
                                />
                                <FormInput
                                    label="Roll Number"
                                    value={profileForm.reg_no}
                                    onChange={(e) => setProfileForm(f => ({ ...f, reg_no: e.target.value }))}
                                    className="h-10 text-xs font-bold"
                                />
                                <FormInput
                                    label="Student Email"
                                    value={profileForm.email}
                                    onChange={(e) => setProfileForm(f => ({ ...f, email: e.target.value }))}
                                    className="h-10 text-xs font-bold"
                                    placeholder="student@email.com"
                                />
                                <FormInput
                                    label="Student Password"
                                    value={profileForm.password}
                                    onChange={(e) => setProfileForm(f => ({ ...f, password: e.target.value }))}
                                    className="h-10 text-xs font-bold"
                                    placeholder="student123"
                                />
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground ml-1">Shift</label>
                                    <Select value={profileForm.shift} onValueChange={(val) => setProfileForm(f => ({ ...f, shift: val }))}>
                                        <SelectTrigger className="h-10 rounded-xl border-border bg-card text-xs font-bold px-4">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="Morning">Morning</SelectItem>
                                            <SelectItem value="Night">Night</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground ml-1">Lifecycle Status</label>
                                    <Select value={profileForm.status} onValueChange={(val) => setProfileForm(f => ({ ...f, status: val }))}>
                                        <SelectTrigger className="h-10 rounded-xl border-border bg-card text-xs font-bold px-4">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="Inactive">Inactive</SelectItem>
                                            <SelectItem value="Trial">Trial</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground ml-1">Assigned Supervisor</label>
                                    <Select value={profileForm.supervisor_id || "none"} onValueChange={(val) => setProfileForm(f => ({ ...f, supervisor_id: val === "none" ? "" : val }))}>
                                        <SelectTrigger className="h-10 rounded-xl border-border bg-card text-xs font-bold px-4">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="none">Level Admin</SelectItem>
                                            {supervisors.map((s: Supervisor) => (
                                                <SelectItem key={s.id} value={s.id} className="text-xs font-bold">{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </section>

                        {/* ── SECTION 2: SCHEDULE ─────────────────────────── */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <Calendar className="size-3.5 text-emerald-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Class Schedule matrix</h3>
                            </div>

                            <div className="space-y-6">
                                {classesLoading ? (
                                    <div className="py-12 flex flex-col items-center justify-center opacity-40">
                                        <Loader2 className="size-6 animate-spin text-primary" />
                                    </div>
                                ) : (
                                    <>
                                        {studentClasses.map((cls: ClassSchedule) => (
                                            <ClassEditor
                                                key={cls.id}
                                                initialData={cls}
                                                teachers={teachers}
                                                appAccounts={appAccounts}
                                                courses={courses}
                                                studentId={studentId!}
                                            />
                                        ))}
                                        <div className="mt-4">
                                            {!showAddCourse ? (
                                                <Button 
                                                    onClick={() => setShowAddCourse(true)} 
                                                    variant="outline" 
                                                    className="w-full h-11 rounded-2xl border-dashed border-border hover:border-primary/50 text-sm font-bold text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Plus className="size-4" /> Add Course
                                                </Button>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Add New Course</h4>
                                                        <Button 
                                                            onClick={() => setShowAddCourse(false)} 
                                                            variant="ghost" 
                                                            size="sm"
                                                            className="text-xs font-bold text-muted-foreground hover:text-foreground h-7 rounded-lg"
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                    <ClassEditor
                                                        isNew={true}
                                                        teachers={teachers}
                                                        appAccounts={appAccounts}
                                                        courses={courses}
                                                        studentId={studentId!}
                                                    />
                                                </>
                                            )}
                                        </div>


                                    </>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * ── SUB-COMPONENT: FULL INLINE CLASS EDITOR ───────────────────────
 */
function ClassEditor({ 
    initialData, 
    teachers, 
    appAccounts, 
    courses,
    studentId,
    isNew = false,
    onSuccess
}: { 
    initialData?: ClassSchedule;
    teachers: Teacher[];
    appAccounts: AppAccount[];
    courses: Course[];
    studentId: string;
    isNew?: boolean;
    onSuccess?: () => void;
}) {
    const queryClient = useQueryClient();
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const [form, setForm] = useState<Partial<ClassSchedule>>({
        teacher_id: initialData?.teacher_id || "",
        app_account_id: initialData?.app_account_id || "",
        course_id: initialData?.course_id || "",
        pak_start_time: initialData?.pak_start_time || "10:00 AM",
        pak_end_time: initialData?.pak_end_time || "11:00 AM",
        uk_start_time: initialData?.uk_start_time || convertPkToUk("10:00 AM"),
        uk_end_time: initialData?.uk_end_time || convertPkToUk("11:00 AM"),
        schedule_days: initialData?.schedule_days || {},
    });

    const updateMutation = useMutation({
        mutationFn: (updates: Partial<ClassSchedule>) => updateClass(initialData!.id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["studentClasses", studentId] });
            toast.success("Saved");
        },
    });

    const addMutation = useMutation({
        mutationFn: (data: any) => addClass({ ...data, student_id: studentId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["studentClasses", studentId] });
            toast.success("Created");
            setForm({
                teacher_id: "",
                app_account_id: "",
                pak_start_time: "10:00 AM",
                pak_end_time: "11:00 AM",
                uk_start_time: convertPkToUk("10:00 AM"),
                uk_end_time: convertPkToUk("11:00 AM"),
                schedule_days: {},
            });
            onSuccess?.();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteClass(initialData!.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["studentClasses", studentId] });
            toast.success("Removed");
        },
    });

    const toggleDay = (dayFull: string) => {
        const day = dayFull === "Mon" ? "Monday" : dayFull === "Tue" ? "Tuesday" : dayFull === "Wed" ? "Wednesday" : dayFull === "Thu" ? "Thursday" : dayFull === "Fri" ? "Friday" : dayFull === "Sat" ? "Saturday" : "Sunday";
        const days = { ...(form.schedule_days as Record<string, string>) };
        if (days[day]) delete days[day];
        else days[day] = "Class";
        setForm(f => ({ ...f, schedule_days: days }));
    };

    return (
        <div className={cn(
            "p-5 rounded-[24px] border transition-all duration-300",
            isNew 
                ? "border-emerald-500/10 bg-emerald-500/[0.01] border-dashed" 
                : "border-border bg-card hover:border-primary/20 shadow-sm"
        )}>
            <div className="space-y-4">
                {/* Compact Grid */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Course</label>
                        <Select value={form.course_id || "none"} onValueChange={(val) => setForm(f => ({ ...f, course_id: val === "none" ? "" : val }))}>
                            <SelectTrigger className="h-9 rounded-xl border-border bg-background text-[11px] font-bold px-3">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="none">None</SelectItem>
                                {courses.map((c: Course) => <SelectItem key={c.id} value={c.id} className="text-xs font-bold">{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Teacher</label>
                        <Select value={form.teacher_id} onValueChange={(val) => setForm(f => ({ ...f, teacher_id: val }))}>
                            <SelectTrigger className="h-9 rounded-xl border-border bg-background text-[11px] font-bold px-3">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {teachers.map((t: Teacher) => <SelectItem key={t.id} value={t.id} className="text-xs font-bold">{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Platform</label>
                        <Select value={form.app_account_id || "none"} onValueChange={(val) => setForm(f => ({ ...f, app_account_id: val === "none" ? "" : val }))}>
                            <SelectTrigger className="h-9 rounded-xl border-border bg-background text-[11px] font-bold px-3">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="none">Direct</SelectItem>
                                {appAccounts.map((a: AppAccount) => <SelectItem key={a.id} value={a.id} className="text-xs font-bold">{a.platform} — {a.account_identifier}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground ml-1">Class Time (PK)</label>
                        <div className="flex items-center gap-2">
                            <TimeSelect
                                value={form.pak_start_time || ""}
                                onChange={(val) => setForm(f => ({ ...f, pak_start_time: val, uk_start_time: convertPkToUk(val) }))}
                                className="h-9 text-[11px] font-bold"
                            />
                            <div className="text-muted-foreground opacity-30">—</div>
                            <TimeSelect
                                value={form.pak_end_time || ""}
                                onChange={(val) => setForm(f => ({ ...f, pak_end_time: val, uk_end_time: convertPkToUk(val) }))}
                                className="h-9 text-[11px] font-bold"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        {!isNew && (
                            <button onClick={() => { if(confirm("Archive?")) deleteMutation.mutate(); }} className="size-9 rounded-xl flex items-center justify-center bg-accent/50 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                                <Trash2 className="size-4" />
                            </button>
                        )}
                        <button
                            onClick={() => isNew ? addMutation.mutate(form) : updateMutation.mutate(form)}
                            disabled={updateMutation.isPending || addMutation.isPending}
                            className={cn(
                                "h-9 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm",
                                isNew ? "bg-emerald-500 text-white" : "bg-primary text-white"
                            )}
                        >
                             {isNew ? "Deploy" : "Update"}
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                    {DAYS.map(day => {
                        const dayFull = day === "Mon" ? "Monday" : day === "Tue" ? "Tuesday" : day === "Wed" ? "Wednesday" : day === "Thu" ? "Thursday" : day === "Fri" ? "Friday" : day === "Sat" ? "Saturday" : "Sunday";
                        const active = !!(form.schedule_days as any)?.[dayFull];
                        return (
                            <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(day)}
                                className={cn(
                                    "size-8 rounded-lg text-[10px] font-black border transition-all active:scale-95",
                                    active
                                        ? "bg-primary text-white border-primary shadow-sm"
                                        : "bg-background border-border text-muted-foreground hover:border-primary/20"
                                )}
                            >
                                {day[0]}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
