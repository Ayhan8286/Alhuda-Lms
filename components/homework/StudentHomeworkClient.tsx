"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStudentById } from "@/lib/api/students";
import { 
    BookOpen, 
    Calendar, 
    Clock, 
    FileText, 
    Award, 
    CheckCircle2, 
    Loader2, 
    User,
    Mic,
    MicOff,
    Square,
    Play,
    Pause,
    Trash2,
    Upload,
    Volume2,
    HelpCircle
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

interface StudentHomeworkClientProps {
    studentId: string;
}

export default function StudentHomeworkClient({ studentId }: StudentHomeworkClientProps) {
    const queryClient = useQueryClient();
    const [isSubmitOpen, setIsSubmitOpen] = useState(false);
    const [selectedHomework, setSelectedHomework] = useState<any | null>(null);
    const [submissionText, setSubmissionText] = useState("");

    const [activeTab, setActiveTab] = useState<"assigned" | "submitted" | "graded">("assigned");

    // Audio recording state
    const [recordingState, setRecordingState] = useState<"idle" | "recording" | "stopped">("idle");
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Queries
    const { data: student, isLoading: studentLoading } = useQuery({
        queryKey: ["studentDetails", studentId],
        queryFn: () => getStudentById(studentId)
    });

    const { data: homework = [], isLoading: homeworkLoading } = useQuery({
        queryKey: ["homework-student", studentId],
        queryFn: async () => {
            const res = await fetch(`/api/homework?studentId=${studentId}`);
            if (!res.ok) throw new Error("Failed to fetch homework assignments");
            return res.json();
        }
    });

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Recording controls
    const startRecording = async () => {
        try {
            // Request permissions
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                setRecordingState("stopped");
            };

            recorder.start(200); // Chunk size
            setRecordingState("recording");
            setDuration(0);
            setUploadedFile(null); // Clear uploaded file if user records instead

            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Failed to access microphone:", err);
            toast.error("Microphone access denied. Please upload an audio file instead.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && recordingState === "recording") {
            mediaRecorderRef.current.stop();
            // Stop stream tracks
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const deleteRecording = () => {
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingState("idle");
        setDuration(0);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith("audio/")) {
                toast.error("Please upload an audio file (e.g. mp3, wav, m4a)");
                return;
            }
            setUploadedFile(file);
            deleteRecording(); // Clear any browser recording if user uploads instead
            toast.success(`Loaded file: ${file.name}`);
        }
    };

    const resetSubmissionForm = () => {
        setSubmissionText("");
        deleteRecording();
        setUploadedFile(null);
    };

    const formatTime = (secs: number) => {
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
    };

    const handleHomeworkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedHomework) return;

        if (!audioBlob && !uploadedFile) {
            toast.error("Please record your audio recitation or upload an audio file.");
            return;
        }

        const formData = new FormData();
        formData.append("action", "submit");
        formData.append("homeworkId", selectedHomework.id);
        formData.append("submissionText", submissionText);

        if (audioBlob) {
            // webm recorded from browser
            formData.append("audioFile", audioBlob, `recitation_${selectedHomework.id}.webm`);
        } else if (uploadedFile) {
            formData.append("audioFile", uploadedFile);
        }

        try {
            setIsSubmitting(true);
            const res = await fetch("/api/homework", {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to submit recitation");
            }

            toast.success("Recitation successfully submitted! Excellent work.");
            queryClient.invalidateQueries({ queryKey: ["homework-student", studentId] });
            setIsSubmitOpen(false);
            resetSubmissionForm();
        } catch (err: any) {
            toast.error(err.message || "Failed to upload recitation");
        } finally {
            setIsSubmitting(false);
        }
    };

    const assignedTasks = homework.filter((h: any) => h.status === "assigned");
    const submittedTasks = homework.filter((h: any) => h.status === "submitted");
    const gradedTasks = homework.filter((h: any) => h.status === "graded");

    if (studentLoading || homeworkLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-semibold text-emerald-800/60 dark:text-emerald-200/60">Loading homework hub...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 font-body w-full">
            {/* Header */}
            <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground mb-1">Student Portal</p>
                <h1 className="text-3xl font-black tracking-tight text-foreground leading-none">
                    My Homework Tasks
                    <span className="text-primary ml-2 text-2xl">✦</span>
                </h1>
                <p className="text-muted-foreground mt-1.5 text-sm">Review assignments assigned by your teacher, record your recitation, and see your grades.</p>
            </div>

            {/* KPI metrics cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: "Assigned To Do", count: assignedTasks.length, sub: "Assignments pending completion", color: "text-amber-600", bg: "rgba(245,158,11,0.06)", border: "border-amber-500/20", Icon: Clock },
                    { label: "Awaiting Evaluation", count: submittedTasks.length, sub: "Submitted to teacher", color: "text-blue-600", bg: "rgba(59,130,246,0.06)", border: "border-blue-500/20", Icon: Mic },
                    { label: "Evaluated / Completed", count: gradedTasks.length, sub: "Grades and remarks available", color: "text-green-600", bg: "rgba(16,185,129,0.06)", border: "border-green-500/20", Icon: Award }
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

            {/* Tabs Filter */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/20 dark:border-white/5 pb-2">
                    <div className="flex gap-2 bg-emerald-950/5 dark:bg-black/25 p-1 rounded-2xl border border-white/10">
                        {[
                            { id: "assigned", label: "Assigned To Do", count: assignedTasks.length, color: "bg-amber-500" },
                            { id: "submitted", label: "Submitted (Awaiting)", count: submittedTasks.length, color: "bg-blue-500" },
                            { id: "graded", label: "Graded Results", count: gradedTasks.length, color: "bg-green-500" }
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

                {/* Submissions List cards */}
                <div className="grid grid-cols-1 gap-6">
                    {activeTab === "assigned" && (
                        assignedTasks.length === 0 ? (
                            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-accent/5">
                                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-foreground">All Caught Up!</h3>
                                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">Excellent work. You have completed all assignments assigned by your teacher.</p>
                            </div>
                        ) : (
                            assignedTasks.map((hw: any) => (
                                <div key={hw.id} className="p-6 rounded-[32px] border border-white/20 dark:border-white/5 bg-card hover:border-amber-500/30 transition-all flex flex-col md:flex-row justify-between gap-6 card-hover shadow-[0px_4px_24px_rgba(0,0,0,0.02)]">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-md border border-amber-500/20">
                                                To Do
                                            </span>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary-hover rounded-md">
                                                {hw.course_name}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-foreground capitalize leading-tight">{hw.title}</h3>
                                            <p className="text-xs text-emerald-800/60 dark:text-emerald-200/50 mt-1 font-semibold">
                                                Assigned by teacher: <span className="text-emerald-950 dark:text-white font-extrabold">{hw.teacher_name}</span>
                                            </p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                            <p className="text-[10px] font-black uppercase text-primary tracking-wider mb-1">Instructions / Description</p>
                                            <p className="text-sm text-emerald-900/85 dark:text-emerald-50 leading-relaxed font-semibold">
                                                {hw.description || "Recite assigned verses and upload or record audio below."}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-between items-end gap-6 shrink-0">
                                        <div className="text-right text-xs font-semibold text-muted-foreground">
                                            <p>Deadline Date</p>
                                            <p className="text-red-500 font-extrabold flex items-center gap-1 mt-0.5">
                                                <Clock className="h-3.5 w-3.5" />
                                                {format(new Date(hw.deadline), "MMM d, yyyy • h:mm a")}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedHomework(hw);
                                                resetSubmissionForm();
                                                setIsSubmitOpen(true);
                                            }}
                                            className="px-6 py-2.5 bg-forest hover:bg-forest/90 text-white font-black rounded-2xl text-xs shadow-md self-stretch md:self-auto text-center"
                                        >
                                            Start Submission
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    )}

                    {activeTab === "submitted" && (
                        submittedTasks.length === 0 ? (
                            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-accent/5">
                                <Mic className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-foreground">No Pending Evaluations</h3>
                                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">Homework that has been submitted but not graded by your instructor will show up here.</p>
                            </div>
                        ) : (
                            submittedTasks.map((hw: any) => (
                                <div key={hw.id} className="p-6 rounded-[32px] border border-white/20 dark:border-white/5 bg-card hover:border-blue-500/30 transition-all flex flex-col md:flex-row justify-between gap-6 card-hover shadow-[0px_4px_24px_rgba(0,0,0,0.02)]">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-md border border-blue-500/20">
                                                Submitted
                                            </span>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary-hover rounded-md">
                                                {hw.course_name}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-black text-foreground capitalize leading-tight">{hw.title}</h3>
                                        <p className="text-xs text-emerald-800/60 dark:text-emerald-200/50">
                                            Instructor: <span className="text-emerald-950 dark:text-white font-extrabold">{hw.teacher_name}</span>
                                        </p>

                                        {hw.submission_audio_url && (
                                            <div className="p-4 rounded-2xl border border-white/20 dark:border-white/5 bg-blue-500/5 flex flex-col gap-2">
                                                <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                                                    <Volume2 className="h-4 w-4" />
                                                    Your Audio Recitation
                                                </div>
                                                <audio src={hw.submission_audio_url} controls className="w-full mt-1" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col justify-between items-end gap-4 shrink-0 text-right">
                                        <div className="text-xs font-semibold text-muted-foreground">
                                            <p>Submitted On</p>
                                            <p className="text-foreground font-black mt-0.5">{hw.submission_date ? format(new Date(hw.submission_date), "MMM d, yyyy • h:mm a") : "—"}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    )}

                    {activeTab === "graded" && (
                        gradedTasks.length === 0 ? (
                            <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-accent/5">
                                <Award className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <h3 className="text-base font-bold text-foreground">No Graded Cards</h3>
                                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">Once evaluated, the teacher's grading and remarks will appear in this tab.</p>
                            </div>
                        ) : (
                            gradedTasks.map((hw: any) => (
                                <div key={hw.id} className="p-6 rounded-[32px] border border-white/20 dark:border-white/5 bg-card hover:border-green-500/30 transition-all flex flex-col md:flex-row justify-between gap-6 card-hover shadow-[0px_4px_24px_rgba(0,0,0,0.02)]">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold px-2 py-0.5 bg-green-500/10 text-green-600 rounded-md border border-green-500/20">
                                                Evaluated
                                            </span>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary-hover rounded-md">
                                                {hw.course_name}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-foreground capitalize leading-tight">{hw.title}</h3>
                                            <p className="text-xs text-emerald-800/60 dark:text-emerald-200/50 mt-1">
                                                Evaluated by teacher: <span className="text-emerald-950 dark:text-white font-extrabold">{hw.teacher_name}</span>
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {hw.submission_audio_url && (
                                                <div className="p-3.5 rounded-2xl border border-white/10 bg-slate-50 dark:bg-black/10 flex flex-col gap-2">
                                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Your Recitation</p>
                                                    <audio src={hw.submission_audio_url} controls className="w-full mt-1 scale-95" />
                                                </div>
                                            )}
                                            <div className="p-3.5 rounded-2xl border border-white/10 bg-emerald-500/5 flex flex-col justify-center">
                                                <p className="text-[10px] font-black uppercase text-primary tracking-wider">Evaluation & Score</p>
                                                <p className="text-sm font-black text-primary-hover mt-1">Grade: <span className="text-base font-extrabold">{hw.grade}</span></p>
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

            {/* Submission dialog */}
            <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
                <DialogContent className="sm:max-w-[480px] rounded-[32px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">Submit Recitation</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground">
                            Record your recitation in real time or upload an audio file to submit to your teacher.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleHomeworkSubmit} className="space-y-4 py-4">
                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-1">
                            <p className="text-[10px] uppercase font-bold text-primary tracking-widest">Homework Instructions</p>
                            <p className="text-sm font-black text-emerald-950 dark:text-white capitalize">{selectedHomework?.title}</p>
                            {selectedHomework?.description && (
                                <p className="text-xs text-emerald-800/60 dark:text-emerald-200/50 mt-1 font-semibold leading-relaxed">"{selectedHomework.description}"</p>
                            )}
                        </div>

                        {/* Interactive audio panel */}
                        <div className="p-5 rounded-[24px] border border-white/20 dark:border-white/5 bg-accent/15 space-y-4 relative overflow-hidden">
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Audio Recitation *</p>

                            <div className="flex flex-col items-center justify-center py-2 gap-3 bg-white/40 dark:bg-black/20 rounded-2xl p-4 border border-white/10">
                                {recordingState === "idle" && !audioUrl && !uploadedFile && (
                                    <button
                                        type="button"
                                        onClick={startRecording}
                                        className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                                    >
                                        <Mic className="h-6 w-6" />
                                    </button>
                                )}

                                {recordingState === "recording" && (
                                    <div className="flex flex-col items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={stopRecording}
                                            className="h-14 w-14 rounded-full bg-red-600 animate-pulse text-white flex items-center justify-center shadow-lg"
                                        >
                                            <Square className="h-6 w-6 fill-current" />
                                        </button>
                                        
                                        {/* CSS Equalizer Wave */}
                                        <div className="flex gap-1 items-center justify-center mt-2 h-6">
                                            <span className="w-1 bg-red-500 rounded-full animate-bounce h-3" style={{ animationDelay: "0.1s" }} />
                                            <span className="w-1 bg-red-500 rounded-full animate-bounce h-5" style={{ animationDelay: "0.2s" }} />
                                            <span className="w-1 bg-red-500 rounded-full animate-bounce h-4" style={{ animationDelay: "0.3s" }} />
                                            <span className="w-1 bg-red-500 rounded-full animate-bounce h-6" style={{ animationDelay: "0.4s" }} />
                                            <span className="w-1 bg-red-500 rounded-full animate-bounce h-3" style={{ animationDelay: "0.5s" }} />
                                        </div>
                                    </div>
                                )}

                                {recordingState === "stopped" && audioUrl && (
                                    <div className="w-full space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200">Recorded Preview</span>
                                            <button
                                                type="button"
                                                onClick={deleteRecording}
                                                className="text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 text-xs font-black"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Delete
                                            </button>
                                        </div>
                                        <audio src={audioUrl} controls className="w-full accent-primary" />
                                    </div>
                                )}

                                {uploadedFile && (
                                    <div className="w-full flex items-center justify-between bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Volume2 className="h-4 w-4 text-primary shrink-0" />
                                            <p className="text-xs font-bold truncate text-foreground/90">{uploadedFile.name}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setUploadedFile(null)}
                                            className="text-red-500 hover:text-red-600 transition-colors shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}

                                <div className="text-center">
                                    {recordingState === "idle" && !uploadedFile && (
                                        <p className="text-[11px] font-bold text-muted-foreground mt-1">Click to record microphone recitation</p>
                                    )}
                                    {recordingState === "recording" && (
                                        <p className="text-[11px] font-black text-red-600 mt-1">Recording active: {formatTime(duration)}</p>
                                    )}
                                    {recordingState === "stopped" && (
                                        <p className="text-[11px] font-bold text-emerald-600 mt-1">Recording saved ({formatTime(duration)})</p>
                                    )}
                                </div>
                            </div>

                            {/* Fallback File Uploader */}
                            {recordingState === "idle" && !audioUrl && !uploadedFile && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 justify-center text-xs font-bold text-muted-foreground">
                                        <span className="h-px w-6 bg-border" />
                                        <span>OR UPLOAD AUDIO FILE</span>
                                        <span className="h-px w-6 bg-border" />
                                    </div>
                                    <label className="flex flex-col items-center justify-center p-4 border border-dashed border-border hover:border-primary/50 bg-white/20 dark:bg-black/10 rounded-2xl cursor-pointer hover:bg-white/50 dark:hover:bg-black/25 transition-all text-center">
                                        <Upload className="h-5 w-5 text-muted-foreground mb-1.5" />
                                        <span className="text-xs font-bold text-foreground">Browse local audio files</span>
                                        <span className="text-[10px] text-muted-foreground/60 mt-0.5">Supports WAV, MP3, M4A</span>
                                        <input
                                            type="file"
                                            accept="audio/*"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Written response comments */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Remarks / Written Answer (Optional)</label>
                            <textarea
                                className="w-full min-h-[90px] p-3 rounded-2xl bg-accent/20 border border-border outline-none resize-none text-sm font-medium focus:border-primary"
                                placeholder="Add comments, translation queries, or specific verse references..."
                                value={submissionText}
                                onChange={(e) => setSubmissionText(e.target.value)}
                            />
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsSubmitOpen(false)}
                                className="px-6 py-2.5 font-bold text-sm rounded-full hover:bg-accent transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || (!audioBlob && !uploadedFile)}
                                className="px-8 py-2.5 bg-forest hover:bg-forest/90 text-white font-black rounded-full text-sm transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                {isSubmitting ? "Uploading..." : "Submit Recitation"}
                            </button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
