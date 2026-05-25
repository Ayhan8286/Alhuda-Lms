"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Complaint } from "@/types/complaint";
import { format } from "date-fns";
import { User, Clock, AlertCircle, FileText, CalendarClock, History, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComplaintDetailDialogProps {
    complaint: Complaint | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete?: (id: string) => void;
}

export function ComplaintDetailDialog({ complaint, open, onOpenChange, onDelete }: ComplaintDetailDialogProps) {
    if (!complaint) return null;

    const getPriorityColor = () => {
        if (complaint.status === "Pending") return "text-red-500 bg-red-500/10 border-red-500/20";
        if (complaint.status === "Reviewed") return "text-orange-500 bg-orange-500/10 border-orange-500/20";
        return "text-green-500 bg-green-500/10 border-green-500/20";
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] p-0 flex flex-col overflow-hidden bg-card border-border rounded-3xl">
                {/* Header Section */}
                <div className="bg-accent/30 p-6 border-b border-border shrink-0">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-3 items-center">
                            <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border", getPriorityColor())}>
                                {complaint.status}
                            </span>
                            <span className="text-muted-foreground text-xs font-bold font-mono">
                                #{complaint.id.split('-')[0]}
                            </span>
                        </div>
                        {onDelete && (
                            <button
                                onClick={() => {
                                    onDelete(complaint.id);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-destructive bg-destructive/10 hover:bg-destructive hover:text-white border border-destructive/20 rounded-full transition-colors"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete Ticket
                            </button>
                        )}
                    </div>
                    <DialogTitle className="text-2xl font-black text-foreground mb-2 leading-tight">
                        {complaint.title || `Issue regarding ${complaint.teacher?.name}`}
                    </DialogTitle>
                    <div className="flex items-center gap-4 text-sm font-semibold text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <CalendarClock className="h-4 w-4 text-primary" />
                            {format(new Date(complaint.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
                    {/* Description */}
                    <div className="space-y-3">
                        <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-muted-foreground flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5" /> Issue Details
                        </h4>
                        <div className="bg-background rounded-2xl p-5 border border-border/50 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words font-medium overflow-hidden">
                            {complaint.description}
                        </div>
                    </div>

                    {/* Parties Involved */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-muted-foreground flex items-center gap-2">
                                <User className="h-3.5 w-3.5" /> Reporter (Student)
                            </h4>
                            <div className="bg-accent/20 rounded-2xl p-4 border border-border/50 flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-black text-primary border border-primary/20 shrink-0">
                                        {complaint.student?.full_name?.charAt(0) || 'S'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">{complaint.student?.full_name}</p>
                                        <p className="text-xs text-muted-foreground font-mono truncate">{complaint.student?.reg_no}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40 text-[10px] font-semibold text-muted-foreground">
                                    <div className="min-w-0">
                                        <span className="text-[9px] uppercase tracking-wider block opacity-60">Supervisor</span>
                                        <span className="text-foreground font-bold block truncate" title={complaint.student?.supervisor?.name || "Not Assigned"}>
                                            {complaint.student?.supervisor?.name || "Not Assigned"}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[9px] uppercase tracking-wider block opacity-60">Teacher</span>
                                        <span className="text-foreground font-bold block truncate" title={complaint.student?.classes?.map(c => c.teacher?.name).filter(Boolean).filter((value, index, self) => self.indexOf(value) === index).join(", ") || "Not Assigned"}>
                                            {complaint.student?.classes?.map(c => c.teacher?.name).filter(Boolean).filter((value, index, self) => self.indexOf(value) === index).join(", ") || "Not Assigned"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-[11px] uppercase tracking-[0.2em] font-black text-muted-foreground flex items-center gap-2">
                                <AlertCircle className="h-3.5 w-3.5" /> Regarding (Teacher)
                            </h4>
                            <div className="bg-accent/20 rounded-2xl p-4 border border-border/50 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-sm font-black text-destructive border border-destructive/20 shrink-0">
                                    {complaint.teacher?.name?.charAt(0) || 'T'}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">{complaint.teacher?.name}</p>
                                    <p className="text-xs text-muted-foreground font-mono truncate">{complaint.teacher?.staff_id}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline / Resolution Status */}
                    {complaint.status === "Resolved" && complaint.resolved_at && (
                        <div className="pt-4 border-t border-border">
                            <div className="flex items-center gap-3 bg-green-500/5 text-green-500 p-4 rounded-2xl border border-green-500/10">
                                <History className="h-5 w-5" />
                                <div>
                                    <p className="text-sm font-bold">Ticket Resolved</p>
                                    <p className="text-xs opacity-80 mt-0.5">
                                        Closed on {format(new Date(complaint.resolved_at), "MMM d, yyyy 'at' h:mm a")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
