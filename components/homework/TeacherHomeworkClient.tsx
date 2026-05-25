"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherById, getTeacherClasses } from "@/lib/api/classes";
import { 
    BookOpen, 
    Calendar, 
    Clock, 
    Plus, 
    FileText, 
    Award, 
    CheckCircle2, 
    Play, 
    Mic, 
    Loader2, 
    User,
    ChevronRight,
    Volume2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface TeacherHomeworkClientProps {
    teacherId: string;
}

export default function TeacherHomeworkClient({ teacherId }: TeacherHomeworkClientProps) {
    const queryClient = useQueryClient();
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [isGradeOpen, setIsGradeOpen] = useState(false);
    const [selectedHomework, setSelectedHomework] = useState<any | null>(null);

    // Form states for assigning homework
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [deadline, setDeadline] = useState("");
    const [selectedStudentId, setSelectedStudentId] = useState("all"); // "all" or specific ID
    const [courseName, setCourseName] = useState("");

    // Form states for grading
    const [grade, setGrade] = useState("A+");
    const [remarks, setRemarks] = useState("");

    const [activeTab, setActiveTab] = useState<"pending" | "active" | "graded">("pending");

    // Queries
    const { data: teacher, isLoading: teacherLoading } = useQuery({
        queryKey: ["teacher", teacherId],
        queryFn: () => getTeacherById(teacherId)
    });

    const { data: classes = [], isLoading: classesLoading } = useQuery({
        queryKey: ["teacherClasses", teacherId],
        queryFn: () => getTeacherClasses(teacherId)
    });

    const { data: homework = [], isLoading: homeworkLoading, refetch: refetchHomework } = useQuery({
        queryKey: ["homework-teacher", teacherId],
        queryFn: async () => {
            const res = await fetch(`/api/homework?teacherId=${teacherId}`);
            if (!res.ok) throw new Error("Failed to fetch homework assignments");
            return res.json();
        }
    });

    // Mutations
    const assignMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/homework", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to assign homework");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Homework successfully assigned!");
            queryClient.invalidateQueries({ queryKey: ["homework-teacher", teacherId] });
            setIsAssignOpen(false);
            resetAssignForm();
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to assign homework");
        }
    });

    const gradeMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await fetch("/api/homework", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to submit grade");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Homework successfully graded!");
            queryClient.invalidateQueries({ queryKey: ["homework-teacher", teacherId] });
            setIsGradeOpen(false);
            setRemarks("");
            setGrade("A+");
            setSelectedHomework(null);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to submit grade");
        }
    });

    // Helper data extraction
    const uniqueStudentsMap = new Map();
    classes.forEach(c => {
        if (c.student) {
            uniqueStudentsMap.set(c.student.id, {
                id: c.student.id,
                name: c.student.full_name,
                regNo: c.student.reg_no
            });
        }
    });
    const uniqueStudents = Array.from(uniqueStudentsMap.values());

    const uniqueCourses = Array.from(new Set(classes.map(c => c.course?.name).filter(Boolean)));

    const resetAssignForm = () => {
        setTitle("");
        setDescription("");
        setDeadline("");
        setSelectedStudentId("all");
        setCourseName(uniqueCourses[0] || "");
    };

    const handleAssignSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !deadline || !courseName) {
            toast.error("Please fill in all required fields.");
            return;
        }

        let studentsPayload: { id: string; name: string }[] = [];
        if (selectedStudentId === "all") {
            studentsPayload = uniqueStudents.map(s => ({ id: s.id, name: s.name }));
        } else {
            const studentObj = uniqueStudents.find(s => s.id === selectedStudentId);
            if (studentObj) {
                studentsPayload = [{ id: studentObj.id, name: studentObj.name }];
            }
        }

        if (studentsPayload.length === 0) {
            toast.error("No students are currently enrolled in your classes.");
            return;
        }

        assignMutation.mutate({
            action: "create",
            title,
            description,
            deadline: new Date(deadline).toISOString(),
            teacherId,
            teacherName: teacher?.name || "Teacher",
            courseName,
            students: studentsPayload
        });
    };

    const handleGradeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedHomework) return;

        gradeMutation.mutate({
            action: "grade",
            homeworkId: selectedHomework.id,
            grade,
            teacherRemarks: remarks
        });
    };

    const pendingGradeTasks = homework.filter((h: any) => h.status === "submitted");
    const activeTasks = homework.filter((h: any) => h.status === "assigned");
    const gradedTasks = homework.filter((h: any) => h.status === "graded");

    if (teacherLoading || classesLoading || homeworkLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-semibold text-emerald-800/60 dark:text-emerald-200/60">Loading homework platform...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 font-body w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground mb-1">Academic Tools</p>
                    <h1 className="text-3xl font-black tracking-tight text-foreground leading-none">
                        Homework Manager
                        <span className="text-primary ml-2 text-2xl">✦</span>
                    </h1>
                    <p className="text-muted-foreground mt-1.5 text-sm">Assign scripture memorization, text homework, and evaluate student audio recitations.</p>
                </div>
                <button
                    onClick={() => {
                        resetAssignForm();
                        setIsAssignOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-forest hover:bg-forest/90 text-white font-black rounded-full text-sm fab-glow transition-all shrink-0 self-start md:self-auto"
                >
                    <Plus className="h-4 w-4" />
                    Assign Homework
                </button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: "Awaiting Evaluation", count: pendingGradeTasks.length, sub: "Pending student recitations", color: "text-amber-600", bg: "rgba(245,158,11,0.06)", border: "border-amber-500/20", Icon: Mic },
                    { label: "Active Assignments", count: activeTasks.length, sub: "Currently assigned", color: "text-blue-600", bg: "rgba(59,130,246,0.06)", border: "border-blue-500/20", Icon: BookOpen },
                    { label: "Graded Portfolio", count: gradedTasks.length, sub: "Evaluations completed", color: "text-green-600", bg: "rgba(16,185,129,0.06)", border: "border-green-500/20", Icon: Award }
                ].map((card, i) => (
                    <div key={i} className={cn("p-6 rounded-3xl border glass-panel flex items-center justify-between shadow-sm", card.border)} style={{ background: card.bg }}>
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{card.label}</p>
                            <h3 className={cn("text-4xl font-black", card.color)}>{card.count}</h3>
                            <p className="text-[10px] text-muted-foreground font-medium">{card.sub}</p>
                        </div>
                        <div className={cn("p-3 rounded-2xl bg-white dark:bg-black/20", card.color)}>
                            <card.Icon className="h-6 w-6" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/20 dark:border-white/5 pb-2">
                    <div className="flex gap-2 bg-emerald-950/5 dark:bg-black/25 p-1 rounded-2xl border border-white/10">
                        {[
                            { id: "pending", label: "Awaiting Evaluation", count: pendingGradeTasks.length, color: "bg-amber-500" },
                            { id: "active", label: "Active Tasks", count: activeTasks.length, color: "bg-blue-500" },
                            { id: "graded", label: "Graded Archives", count: gradedTasks.length, color: "bg-green-500" }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id as any)}
                                className={cn(
                                    "px-4 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-2",
                                    activeTab === t.id
                                        ? "bg-white dark:bg-primary/20 text-emerald-950 dark:text-white shadow-sm"
                                        : "text-emerald-800/60 dark:text-emerald-200/40 hover:text-emerald-900"
                                )}
                            >
                                {t.label}
                                <span className={cn("h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-black text-white", t.color)}>
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Submissions List */}
                <div className="grid grid-cols-1 gap-6">
                    {activeTab === "pending" && (
                        pendingGradeTasks.length === 0 ? (
                            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-accent/5">
                                <Mic className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-foreground">All Cleared!</h3>
                                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">There are no pending submissions awaiting grading right now. Students will submit recitations soon.</p>
                            </div>
                        ) : (
                            pendingGradeTasks.map((hw: any) => (
                                <div key={hw.id} className="p-6 rounded-[32px] border border-white/20 dark:border-white/5 bg-card hover:border-amber-500/30 transition-all flex flex-col md:flex-row justify-between gap-6 card-hover shadow-[0px_4px_24px_rgba(0,0,0,0.02)]">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-md border border-amber-500/20">
                                                Awaiting Grade
                                            </span>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary-hover rounded-md">
                                                {hw.course_name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-mono">ID: {hw.id.substring(3, 11)}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-foreground capitalize">{hw.title}</h3>
                                            <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70 font-semibold mt-1">
                                                Assigned to student: <span className="text-emerald-950 dark:text-white font-extrabold">{hw.student_name}</span>
                                            </p>
                                        </div>
                                        
                                        {hw.submission_text && (
                                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/10 border border-slate-100 dark:border-white/5">
                                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1">Student Comments</p>
                                                <p className="text-sm font-semibold text-foreground/90 leading-relaxed italic">"{hw.submission_text}"</p>
                                            </div>
                                        )}

                                        {hw.submission_audio_url && (
                                            <div className="p-4 rounded-2xl border border-white/20 dark:border-white/5 bg-emerald-500/5 flex flex-col gap-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                                                    <Volume2 className="h-4 w-4" />
                                                    Play Audio Recitation
                                                </div>
                                                <audio src={hw.submission_audio_url} controls className="w-full mt-1 accent-primary" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col justify-between items-end gap-4 shrink-0">
                                        <div className="text-right text-xs font-semibold text-muted-foreground">
                                            <p>Submitted On</p>
                                            <p className="text-foreground font-black mt-0.5">{hw.submission_date ? format(new Date(hw.submission_date), "MMM d, yyyy • h:mm a") : "—"}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedHomework(hw);
                                                setIsGradeOpen(true);
                                            }}
                                            className="px-6 py-2.5 bg-primary text-primary-foreground font-black rounded-2xl text-xs hover:bg-primary/95 transition-all shadow-md self-stretch md:self-auto text-center"
                                        >
                                            Grade & Remarks
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    )}

                    {activeTab === "active" && (
                        activeTasks.length === 0 ? (
                            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-accent/5">
                                <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-foreground">No Active Assignments</h3>
                                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">Assignments assigned to students that haven't been completed will appear here.</p>
                            </div>
                        ) : (
                            activeTasks.map((hw: any) => (
                                <div key={hw.id} className="p-6 rounded-[32px] border border-white/20 dark:border-white/5 bg-card hover:border-blue-500/30 transition-all flex flex-col md:flex-row justify-between gap-6 card-hover shadow-[0px_4px_24px_rgba(0,0,0,0.02)]">
                                    <div className="space-y-3 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-md border border-blue-500/20">
                                                Assigned
                                            </span>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary-hover rounded-md">
                                                {hw.course_name}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-black text-foreground capitalize leading-tight">{hw.title}</h3>
                                        <p className="text-xs font-semibold text-emerald-800/60 dark:text-emerald-200/50">
                                            Instructions: {hw.description || "Memorize and recite."}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs font-semibold text-emerald-950 dark:text-white pt-2">
                                            <span className="flex items-center gap-1.5 bg-emerald-500/5 px-2.5 py-1 rounded-lg">
                                                <User className="h-3.5 w-3.5 text-primary" />
                                                Student: <span className="font-black">{hw.student_name}</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-center items-end text-right gap-1 shrink-0">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Due Deadline</p>
                                        <p className="text-xs text-red-600 font-extrabold flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5 shrink-0" />
                                            {format(new Date(hw.deadline), "MMM d, yyyy • h:mm a")}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )
                    )}

                    {activeTab === "graded" && (
                        gradedTasks.length === 0 ? (
                            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-accent/5">
                                <Award className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-foreground">Archive Empty</h3>
                                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">Completed evaluations will be stored in this archive tab.</p>
                            </div>
                        ) : (
                            gradedTasks.map((hw: any) => (
                                <div key={hw.id} className="p-6 rounded-[32px] border border-white/20 dark:border-white/5 bg-card hover:border-green-500/30 transition-all flex flex-col md:flex-row justify-between gap-6 card-hover shadow-[0px_4px_24px_rgba(0,0,0,0.02)]">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold px-2 py-0.5 bg-green-500/10 text-green-600 rounded-md border border-green-500/20">
                                                Graded
                                            </span>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary-hover rounded-md">
                                                {hw.course_name}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-foreground capitalize leading-tight">{hw.title}</h3>
                                            <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70 font-semibold mt-1">
                                                Assigned to student: <span className="text-emerald-950 dark:text-white font-extrabold">{hw.student_name}</span>
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {hw.submission_audio_url && (
                                                <div className="p-3.5 rounded-2xl border border-white/10 bg-slate-50 dark:bg-black/10 flex flex-col gap-2">
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Submitted Recitation</p>
                                                    <audio src={hw.submission_audio_url} controls className="w-full mt-1 scale-95" />
                                                </div>
                                            )}
                                            <div className="p-3.5 rounded-2xl border border-white/10 bg-emerald-500/5 flex flex-col justify-center">
                                                <p className="text-[10px] font-black uppercase text-primary tracking-wider">Evaluation & Remarks</p>
                                                <p className="text-sm font-black text-primary-hover mt-1">Score/Grade: <span className="text-base">{hw.grade}</span></p>
                                                {hw.teacher_remarks && (
                                                    <p className="text-xs text-emerald-800/70 dark:text-emerald-200/70 mt-1 font-semibold leading-relaxed">
                                                        Remarks: "{hw.teacher_remarks}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-between items-end gap-4 shrink-0 text-right">
                                        <div className="text-xs font-semibold text-muted-foreground">
                                            <p>Graded On</p>
                                            <p className="text-foreground font-black mt-0.5">{hw.graded_date ? format(new Date(hw.graded_date), "MMM d, yyyy • h:mm a") : "—"}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>

            {/* Assign Homework Dialog */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-[32px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Assign Homework</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground">Assign scripture recitation or memorization tasks to your students.</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAssignSubmit} className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Course Section *</label>
                            <select 
                                value={courseName}
                                onChange={(e) => setCourseName(e.target.value)}
                                className="w-full p-3 rounded-2xl bg-accent/20 border border-border outline-none text-sm font-medium"
                            >
                                <option value="" disabled>Select course</option>
                                {uniqueCourses.map((c: any) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                                <option value="Quranic Memorization">Quranic Memorization</option>
                                <option value="Tajweed Rules">Tajweed Rules</option>
                                <option value="Islamic Ethics">Islamic Ethics</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Homework Title *</label>
                            <input
                                className="w-full p-3 rounded-2xl bg-accent/20 border border-border outline-none text-sm font-medium focus:border-primary"
                                placeholder="e.g. Surah Al-Mulk Verses 1-5 Recitation"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Instructions / Description</label>
                            <textarea
                                className="w-full min-h-[90px] p-3 rounded-2xl bg-accent/20 border border-border outline-none resize-none text-sm font-medium focus:border-primary"
                                placeholder="Provide description, specific tajweed focus, or reference details..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Target Student *</label>
                                <select 
                                    value={selectedStudentId}
                                    onChange={(e) => setSelectedStudentId(e.target.value)}
                                    className="w-full p-3 rounded-2xl bg-accent/20 border border-border outline-none text-sm font-medium"
                                >
                                    <option value="all">All Enrolled Students (Bulk)</option>
                                    {uniqueStudents.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.regNo})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Deadline Date *</label>
                                <input
                                    type="datetime-local"
                                    className="w-full p-3 rounded-2xl bg-accent/20 border border-border outline-none text-sm font-medium focus:border-primary"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsAssignOpen(false)}
                                className="px-6 py-2.5 font-bold text-sm rounded-full hover:bg-accent transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={assignMutation.isPending}
                                className="px-8 py-2.5 bg-primary text-primary-foreground font-black rounded-full text-sm hover:bg-primary/95 transition-all shadow-md disabled:opacity-50"
                            >
                                {assignMutation.isPending ? "Assigning..." : "Assign Tasks"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Grading Dialog */}
            <Dialog open={isGradeOpen} onOpenChange={setIsGradeOpen}>
                <DialogContent className="sm:max-w-[450px] rounded-[32px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Evaluate Submission</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground">
                            Assess recitation of {selectedHomework?.student_name} and submit feedback.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleGradeSubmit} className="space-y-4 py-4">
                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-1">
                            <p className="text-[10px] uppercase font-bold text-primary tracking-widest">Homework Assignment</p>
                            <p className="text-sm font-black text-emerald-950 dark:text-white capitalize">{selectedHomework?.title}</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Grade Selection *</label>
                            <select 
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                className="w-full p-3 rounded-2xl bg-accent/20 border border-border outline-none text-sm font-medium"
                            >
                                <option value="Excellent (A+)">Excellent (A+)</option>
                                <option value="Very Good (A)">Very Good (A)</option>
                                <option value="Good (B)">Good (B)</option>
                                <option value="Satisfactory (C)">Satisfactory (C)</option>
                                <option value="Needs Practice (D)">Needs Practice (D)</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Teacher remarks & advice</label>
                            <textarea
                                className="w-full min-h-[100px] p-3 rounded-2xl bg-accent/20 border border-border outline-none resize-none text-sm font-medium focus:border-primary"
                                placeholder="Ma Sha Allah, beautiful recitation! Pay attention to the pronunciation of..."
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                required
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsGradeOpen(false)}
                                className="px-6 py-2.5 font-bold text-sm rounded-full hover:bg-accent transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={gradeMutation.isPending}
                                className="px-8 py-2.5 bg-forest hover:bg-forest/90 text-white font-black rounded-full text-sm transition-all shadow-md disabled:opacity-50"
                            >
                                {gradeMutation.isPending ? "Submitting..." : "Submit Score"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
