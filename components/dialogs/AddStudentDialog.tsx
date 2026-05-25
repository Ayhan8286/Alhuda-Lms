"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addStudent } from "@/lib/api/students";
import { getTeachers, addClass } from "@/lib/api/classes";
import { getAppAccounts } from "@/lib/api/platforms";
import { getSupervisors } from "@/lib/api/supervisors";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { FormInput } from "@/components/ui/form-input";
import { Teacher, AppAccount } from "@/types/student";
import { Supervisor } from "@/types/supervisor";
import { toTimeInput, fromTimeInput, convertPkToUk } from "@/lib/utils/time";
import { TimeSelect } from "@/components/ui/time-select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";



interface AddStudentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    defaultTeacherId?: string;
}

export function AddStudentDialog({ open, onOpenChange, onSuccess, defaultTeacherId }: AddStudentDialogProps) {
    const queryClient = useQueryClient();

    // Queries
    const { data: teachers = [] } = useQuery({
        queryKey: ["activeTeachers"],
        queryFn: getTeachers,
    });

    const { data: appAccounts = [] } = useQuery({
        queryKey: ["appAccounts"],
        queryFn: getAppAccounts,
    });

    const { data: supervisors = [] } = useQuery({
        queryKey: ["supervisors"],
        queryFn: () => getSupervisors(),
    });

    // Form States
    const [formData, setFormData] = useState({
        full_name: "",
        reg_no: "",
        guardian_name: "",
        status: "Active",
        shift: "",
        supervisor_id: "",
        email: "",
        password: "student123",
    });

    const [classFormData, setClassFormData] = useState({
        teacher_id: defaultTeacherId || "",
        app_account_id: "",
        pak_start_time: "",
        pak_end_time: "",
        uk_start_time: "",
        uk_end_time: "",
        schedule_days: {} as Record<string, string>,
    });

    // Effect to update defaultTeacherId if it changes
    useEffect(() => {
        if (defaultTeacherId) {
            setClassFormData(prev => ({ ...prev, teacher_id: defaultTeacherId }));
            
            // Also try to find the supervisor if teachers are loaded
            if (teachers.length > 0) {
                const selectedTeacher = teachers.find(t => t.id === defaultTeacherId);
                if (selectedTeacher?.supervisor_id) {
                    setFormData(prev => ({ ...prev, supervisor_id: selectedTeacher.supervisor_id || "" }));
                }
            }
        }
    }, [defaultTeacherId, teachers]);

    // Mutation
    const addMutation = useMutation({
        mutationFn: async () => {
            // Bundle email and password tags inside performance_notes column
            const credentialsNotes = `[EMAIL:${formData.email}] [PASSWORD:${formData.password}]`.trim();
            
            // 1. Create Student
            const studentPayload = {
                full_name: formData.full_name,
                reg_no: formData.reg_no,
                guardian_name: formData.guardian_name,
                status: formData.status,
                shift: formData.shift,
                supervisor_id: formData.supervisor_id || null, // Fix UUID error
                performance_notes: credentialsNotes,
                guardian_id: null,
                shift_id: null,
            };
            const newStudent = await addStudent(studentPayload);

            // 2. Create Class (if enough info provided)
            if (newStudent && newStudent.id && classFormData.teacher_id) {
                await addClass({
                    student_id: newStudent.id,
                    teacher_id: classFormData.teacher_id,
                    app_account_id: classFormData.app_account_id || null,
                    pak_start_time: classFormData.pak_start_time,
                    pak_end_time: classFormData.pak_end_time,
                    uk_start_time: classFormData.uk_start_time,
                    uk_end_time: classFormData.uk_end_time,
                    schedule_days: classFormData.schedule_days,
                    course_id: null,
                });
            }
            return newStudent;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["students"] });
            queryClient.invalidateQueries({ queryKey: ["studentsCount"] });
            if (onSuccess) onSuccess();
            onOpenChange(false);
            resetForms();
        },
    });

    const resetForms = () => {
        setFormData({
            full_name: "",
            reg_no: "",
            guardian_name: "",
            status: "Active",
            shift: "",
            supervisor_id: "",
            email: "",
            password: "student123",
        });
        setClassFormData({
            teacher_id: defaultTeacherId || "",
            app_account_id: "",
            pak_start_time: "",
            pak_end_time: "",
            uk_start_time: "",
            uk_end_time: "",
            schedule_days: {},
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addMutation.mutate();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const toggleDay = (day: string) => {
        setClassFormData(prev => {
            const days = { ...prev.schedule_days };
            if (days[day]) {
                delete days[day];
            } else {
                days[day] = "Class";
            }
            return { ...prev, schedule_days: days };
        });
    };

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-[32px] border-border bg-card shadow-2xl">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-xl font-black">Add New Student</DialogTitle>
                    <p className="text-xs text-muted-foreground font-medium">Enter student details and assign an initial class.</p>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 pt-2">

                    {/* Student Info */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Student Info</p>
                        <div className="grid grid-cols-2 gap-3">
                            <FormInput
                                label="Full Name *"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleInputChange}
                                required
                                placeholder="e.g. Ahmed Ali"
                            />
                            <FormInput
                                label="Registration No *"
                                name="reg_no"
                                value={formData.reg_no}
                                onChange={handleInputChange}
                                required
                                placeholder="e.g. REG-001"
                            />
                        </div>
                        <FormInput
                            label="Guardian Name *"
                            name="guardian_name"
                            value={formData.guardian_name}
                            onChange={handleInputChange}
                            required
                            placeholder="e.g. Ali Khan"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <FormInput
                                label="Student Email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="e.g. student@email.com"
                            />
                            <FormInput
                                label="Student Password"
                                name="password"
                                type="text"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder="e.g. student123"
                            />
                        </div>
                    </div>

                    {/* Assignment */}
                    <div className="space-y-3 border-t border-border pt-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assignment</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">Status *</label>
                                <Select value={formData.status} onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}>
                                    <SelectTrigger className="h-12 rounded-3xl border-border bg-accent/30 text-sm font-medium px-5 transition-all hover:bg-accent/50">
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                        <SelectItem value="Trial">Trial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">Shift / Timing</label>
                                <Select value={formData.shift} onValueChange={(val) => {
                                    setFormData(prev => ({ ...prev, shift: val }));
                                    if (val === "Morning") {
                                        setClassFormData(prev => ({ ...prev, pak_start_time: "10:00 AM", pak_end_time: "07:00 PM" }));
                                    } else if (val === "Night") {
                                        setClassFormData(prev => ({ ...prev, pak_start_time: "07:00 PM", pak_end_time: "05:00 AM" }));
                                    }
                                }}>
                                    <SelectTrigger className="h-11 rounded-2xl border-border bg-accent/30 text-sm font-medium">
                                        <SelectValue placeholder="Select Shift" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="Morning">Morning</SelectItem>
                                        <SelectItem value="Night">Night</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground">Supervisor</label>
                            <Select value={formData.supervisor_id || "none"} onValueChange={(val) => setFormData(prev => ({ ...prev, supervisor_id: val === "none" ? "" : val }))}>
                                <SelectTrigger className="h-11 rounded-2xl border-border bg-accent/30 text-sm font-medium">
                                    <SelectValue placeholder="Select Supervisor" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl">
                                    <SelectItem value="none">None</SelectItem>
                                    {supervisors.map((s: Supervisor) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Initial Class */}
                    <div className="space-y-3 border-t border-border pt-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Initial Class <span className="normal-case tracking-normal font-medium text-muted-foreground/60">(optional)</span></p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">Teacher</label>
                                <Select 
                                    value={classFormData.teacher_id || "none"} 
                                    onValueChange={(val) => {
                                        const teacherId = val === "none" ? "" : val;
                                        setClassFormData(prev => ({ ...prev, teacher_id: teacherId }));
                                        
                                        // Auto-detect supervisor from teacher
                                        if (teacherId) {
                                            const selectedTeacher = teachers.find(t => t.id === teacherId);
                                            if (selectedTeacher?.supervisor_id) {
                                                setFormData(prev => ({ ...prev, supervisor_id: selectedTeacher.supervisor_id || "" }));
                                            }
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-11 rounded-2xl border-border bg-accent/30 text-sm font-medium">
                                        <SelectValue placeholder="Select Teacher" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="none">None</SelectItem>
                                        {teachers.map((t: Teacher) => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">Platform</label>
                                <Select value={classFormData.app_account_id || "none"} onValueChange={(val) => setClassFormData(prev => ({ ...prev, app_account_id: val === "none" ? "" : val }))}>
                                    <SelectTrigger className="h-11 rounded-2xl border-border bg-accent/30 text-sm font-medium">
                                        <SelectValue placeholder="Select Platform" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="none">None</SelectItem>
                                        {appAccounts.map((a: AppAccount) => (
                                            <SelectItem key={a.id} value={a.id}>{a.platform} — {a.account_identifier}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <TimeSelect
                                    label="🇵🇰 PK Start Time"
                                    value={classFormData.pak_start_time || "10:00 AM"}
                                    onChange={(val) => {
                                        setClassFormData(prev => ({ 
                                            ...prev, 
                                            pak_start_time: val,
                                            uk_start_time: convertPkToUk(val)
                                        }));
                                    }}
                                />
                                {classFormData.pak_start_time && (
                                    <p className="text-[10px] text-muted-foreground/60 font-medium px-1">
                                        🇬🇧 UK: {convertPkToUk(classFormData.pak_start_time)}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <TimeSelect
                                    label="🇵🇰 PK End Time"
                                    value={classFormData.pak_end_time || "07:00 PM"}
                                    onChange={(val) => {
                                        setClassFormData(prev => ({ 
                                            ...prev, 
                                            pak_end_time: val,
                                            uk_end_time: convertPkToUk(val)
                                        }));
                                    }}
                                />
                                {classFormData.pak_end_time && (
                                    <p className="text-[10px] text-muted-foreground/60 font-medium px-1">
                                        🇬🇧 UK: {convertPkToUk(classFormData.pak_end_time)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Schedule Days */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-foreground uppercase tracking-widest opacity-60">Schedule Days</label>
                                <Badge variant="outline" className="text-[9px] font-mono">
                                    {Object.keys(classFormData.schedule_days).length} Days Selected
                                </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {DAYS.map(day => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleDay(day)}
                                        className={cn(
                                            "px-4 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95",
                                            classFormData.schedule_days[day]
                                                ? "bg-primary/20 border-primary/30 text-primary shadow-sm"
                                                : "bg-card border-border text-muted-foreground hover:border-primary/20"
                                        )}
                                    >
                                        {day.slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={addMutation.isPending}
                            className="flex items-center gap-2 px-7 py-3 bg-primary text-primary-foreground font-black rounded-full text-sm hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-primary/20"
                        >
                            {addMutation.isPending ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                            ) : (
                                <><Save className="h-4 w-4" /> Save Student</>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
