"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStudents } from "@/lib/api/students";
import { getTeachers, getStudentClasses } from "@/lib/api/classes"; // Assuming getTeachers is exported from here
import { addComplaint } from "@/lib/api/complaints";
import { Student } from "@/types/student";
import { Teacher } from "@/types/student"; // Teacher type is likely in student.ts or similar

interface AddComplaintDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddComplaintDialog({ open, onOpenChange }: AddComplaintDialogProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        student_id: "",
        teacher_id: "",
        title: "",
        description: "",
        created_at: "",
        status: "Pending",
    });

    const { data: students = [] } = useQuery({ queryKey: ["students"], queryFn: async () => (await getStudents()).data });
    const { data: teachers = [] } = useQuery({ queryKey: ["teachers"], queryFn: getTeachers });

    const { data: studentClasses = [] } = useQuery({
        queryKey: ["student-classes", formData.student_id],
        queryFn: () => getStudentClasses(formData.student_id),
        enabled: !!formData.student_id,
    });

    // Auto-select teacher when student is selected
    useEffect(() => {
        if (studentClasses.length > 0 && !formData.teacher_id) {
            // Prefer the first class's teacher, or if multiple, just pick the first one available
            const firstClass = studentClasses[0];
            if (firstClass && firstClass.teacher_id) {
                setFormData(prev => ({ ...prev, teacher_id: firstClass.teacher_id }));
            }
        }
    }, [studentClasses, formData.teacher_id]);

    const selectedStudent = students.find((s: Student) => s.id === formData.student_id);
    const selectedTeacher = teachers.find((t: Teacher) => t.id === formData.teacher_id);

    // Set default date-time to now when dialog opens
    useEffect(() => {
        if (open) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            setFormData(prev => ({ ...prev, created_at: now.toISOString().slice(0, 16) }));
        }
    }, [open]);

    const mutation = useMutation({
        mutationFn: addComplaint,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["complaints"] });
            onOpenChange(false);
            setFormData({
                student_id: "",
                teacher_id: "",
                title: "",
                description: "",
                created_at: "",
                status: "Pending",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.student_id || !formData.teacher_id) {
            alert("Please select both a student and a teacher.");
            return;
        }

        mutation.mutate({
            student_id: formData.student_id,
            teacher_id: formData.teacher_id,
            title: formData.title,
            description: formData.description,
            created_at: new Date(formData.created_at).toISOString(),
            status: "Pending",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add New Complaint</DialogTitle>
                    <DialogDescription>
                        Log a new complaint for a student regarding a teacher.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Select Student</Label>
                            <Select
                                value={formData.student_id}
                                onValueChange={(val) => setFormData({ ...formData, student_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Student" />
                                </SelectTrigger>
                                <SelectContent>
                                    {students.map((student: Student) => (
                                        <SelectItem key={student.id} value={student.id}>
                                            {student.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedStudent && (
                                <p className="text-xs text-muted-foreground">
                                    Roll No: <span className="font-mono">{selectedStudent.reg_no}</span>
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Select Teacher</Label>
                            <Select
                                value={formData.teacher_id}
                                onValueChange={(val) => setFormData({ ...formData, teacher_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Teacher" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teachers.map((teacher: Teacher) => (
                                        <SelectItem key={teacher.id} value={teacher.id}>
                                            {teacher.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedTeacher && (
                                <p className="text-xs text-muted-foreground">
                                    Staff ID: <span className="font-mono">{selectedTeacher.staff_id}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Complaint Title</Label>
                        <Input
                            placeholder="Brief title of the issue"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Date & Time</Label>
                        <Input
                            type="datetime-local"
                            value={formData.created_at}
                            onChange={(e) => setFormData({ ...formData, created_at: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Complaint Details</Label>
                        <Textarea
                            placeholder="Describe the issue in detail..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            required
                            className="h-32"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending ? "Submitting..." : "Submit Complaint"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
