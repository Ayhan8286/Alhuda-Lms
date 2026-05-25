"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Calendar, FileText } from "lucide-react";

interface RequestLeaveDialogProps {
    studentId: string;
    studentName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RequestLeaveDialog({ studentId, studentName, open, onOpenChange }: RequestLeaveDialogProps) {
    const queryClient = useQueryClient();
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reason, setReason] = useState("");

    const mutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase
                .from("complaints")
                .insert([{
                    student_id: studentId,
                    teacher_id: null,
                    title: `Leave Request: ${startDate} to ${endDate}`,
                    description: `Start Date: ${startDate}\nEnd Date: ${endDate}\nReason: ${reason}`,
                    status: "Pending",
                    priority: "Medium"
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success("Leave Request Submitted!", {
                description: "Your leave application has been sent to the Admin for approval."
            });
            queryClient.invalidateQueries({ queryKey: ["studentComplaints", studentId] });
            onOpenChange(false);
            setStartDate("");
            setEndDate("");
            setReason("");
        },
        onError: (err: any) => {
            toast.error("Failed to submit leave request", {
                description: err.message || "Something went wrong."
            });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!startDate || !endDate || !reason) {
            toast.error("Please fill in all fields.");
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            toast.error("Start date cannot be after end date.");
            return;
        }

        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-emerald-900/10 dark:border-white/10 rounded-[2rem] p-6 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black text-emerald-950 dark:text-white flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary shrink-0" />
                        Request Leave
                    </DialogTitle>
                    <DialogDescription className="text-sm text-emerald-800/60 dark:text-emerald-200/50">
                        Submit a new leave application. Your assigned supervisor or admin will review and approve it.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="start-date" className="text-xs font-bold uppercase tracking-wider text-emerald-800/80 dark:text-emerald-200/80">Start Date</Label>
                            <Input
                                id="start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl focus:ring-primary/50 text-sm focus:outline-none"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="end-date" className="text-xs font-bold uppercase tracking-wider text-emerald-800/80 dark:text-emerald-200/80">End Date</Label>
                            <Input
                                id="end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl focus:ring-primary/50 text-sm focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason" className="text-xs font-bold uppercase tracking-wider text-emerald-800/80 dark:text-emerald-200/80 flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            Reason for Leave
                        </Label>
                        <Textarea
                            id="reason"
                            placeholder="Please explain the reason for your leave request..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl focus:ring-primary/50 text-sm focus:outline-none min-h-[100px] resize-none"
                            required
                        />
                    </div>

                    <DialogFooter className="pt-4 flex gap-2">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)}
                            className="rounded-xl font-bold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-200 shrink-0"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={mutation.isPending}
                            className="rounded-xl font-black text-xs uppercase tracking-wider bg-forest hover:bg-forest/90 text-white shrink-0 shadow-md"
                        >
                            {mutation.isPending ? "Submitting..." : "Submit Application"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
