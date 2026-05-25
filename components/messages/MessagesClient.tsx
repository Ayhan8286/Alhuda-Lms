"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Message, ChatContact, sendMessage, getConversation, subscribeToMessages, getChatContacts, getConversationsSummary, markConversationAsRead } from "@/lib/api/chat";
import { Search, Send, User, ShieldCheck, Loader2, ArrowLeft, Paperclip, CheckCheck, Clock, MessageSquareQuote, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";

export default function MessagesClient({ 
    currentUser 
}: { 
    currentUser: { id: string, name: string, role: string, department?: string, supervisorId?: string } 
}) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDept, setSelectedDept] = useState("all");
    const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    // Voice recording & File upload state/refs
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64Audio = reader.result as string;
                    const minutes = Math.floor(recordingDuration / 60);
                    const seconds = recordingDuration % 60;
                    const durationStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

                    if (selectedContact) {
                        const voicePayload = JSON.stringify({
                            type: 'voice',
                            audio: base64Audio,
                            duration: durationStr
                        });
                        sendMutation.mutate(voicePayload);
                    }
                };
                stream.getTracks().forEach(track => track.stop());
            };

            setRecordingDuration(0);
            mediaRecorder.start();
            setIsRecording(true);

            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Failed to start audio recording", err);
            toast.error("Microphone access is required to record voice notes.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = () => {};
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
            toast.info("Recording cancelled.");
        }
    };

    const handleFileClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error("File is too large. Please select a file smaller than 2MB.");
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const base64Data = reader.result as string;
            let sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
            if (file.size > 1024 * 1024) {
                sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
            }

            if (selectedContact) {
                const filePayload = JSON.stringify({
                    type: 'file',
                    name: file.name,
                    data: base64Data,
                    size: sizeStr,
                    fileType: file.type
                });
                sendMutation.mutate(filePayload);
                toast.success(`Uploading ${file.name}...`);
            }
        };
    };

    // Fetch contacts
    const { data: contacts = [], isLoading: isLoadingContacts } = useQuery({
        queryKey: ["chat-contacts", currentUser.id],
        queryFn: () => getChatContacts(currentUser.id, currentUser.role, currentUser.department, currentUser.supervisorId)
    });

    // Fetch Conversation Summaries (Last messages)
    const { data: summaries = {}, refetch: refetchSummaries } = useQuery({
        queryKey: ["conversations-summary", currentUser.id],
        queryFn: () => getConversationsSummary(currentUser.id, currentUser.role)
    });

    // Fetch Messages for current conversation
    const { data: initialMessages, isLoading: isLoadingMessages } = useQuery<Message[]>({
        queryKey: ["messages", selectedContact?.id || 'none'],
        queryFn: () => getConversation(currentUser.id, selectedContact!.id),
        enabled: !!selectedContact,
    });

    useEffect(() => {
        if (initialMessages) {
            setMessages(initialMessages as Message[]);
            if (selectedContact) {
                markConversationAsRead(currentUser.id, selectedContact.id, currentUser.role);
            }
        }
    }, [initialMessages, selectedContact, currentUser]);

    // Handle real-time updates
    useEffect(() => {
        const subscription = subscribeToMessages((newMessage) => {
            const isToMe = newMessage.recipient_id === currentUser.id || (currentUser.role === 'admin' && newMessage.recipient_id === null);

            const belongsToCurrentThread = selectedContact && (
                (newMessage.sender_id === selectedContact.id && isToMe) ||
                (newMessage.sender_id === currentUser.id && newMessage.recipient_id === (selectedContact.id === 'system-admin' ? null : selectedContact.id)) ||
                (newMessage.sender_role === 'admin' && selectedContact.id === 'system-admin' && isToMe)
            );

            if (belongsToCurrentThread) {
                setMessages((prev) => {
                    if (prev.find(m => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
                markConversationAsRead(currentUser.id, selectedContact.id, currentUser.role);
            }

            if (isToMe && newMessage.sender_id !== selectedContact?.id && newMessage.sender_id !== currentUser.id) {
                setUnreadIds((prev) => new Set(prev).add(newMessage.sender_role === 'admin' ? 'system-admin' : newMessage.sender_id));
            }

            refetchSummaries();
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [selectedContact, currentUser, refetchSummaries]);

    // Scroll to bottom
    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior });
        }
    };

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom('auto');
        }
    }, [selectedContact]);

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom('smooth');
        }
    }, [messages]);

    const sendMutation = useMutation({
        mutationFn: (text: string) => sendMessage(
            text, 
            currentUser.id, 
            currentUser.name, 
            currentUser.role, 
            selectedContact!.id
        ),
        onSuccess: () => {
            setInput("");
            refetchSummaries();
        }
    });

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || sendMutation.isPending || !selectedContact) return;
        sendMutation.mutate(input);
    };

    const selectContact = (c: ChatContact) => {
        setSelectedContact(c);
        setUnreadIds((prev) => {
            const next = new Set(prev);
            next.delete(c.id);
            return next;
        });
        markConversationAsRead(currentUser.id, c.id, currentUser.role);
    };

    const availableDepartments = Array.from(new Set(contacts.map(c => c.department || c.role))).filter(d => d !== 'Administration').sort();

    const sortedContacts = [...contacts]
        .sort((a, b) => {
            const dateA = summaries[a.id]?.last_message_at || '0';
            const dateB = summaries[b.id]?.last_message_at || '0';
            return dateB.localeCompare(dateA); 
        })
        .filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.department?.toLowerCase().includes(searchQuery.toLowerCase());
            
            if (currentUser.role === 'supervisor' && currentUser.department?.toLowerCase() === 'supervisor') {
                if (selectedDept === 'all') return matchesSearch;
                return matchesSearch && c.role === selectedDept;
            }
            
            const contactDept = c.department || c.role;
            const matchesDept = selectedDept === "all" || contactDept === selectedDept;
            return matchesSearch && matchesDept;
        });

    const formatMessageDate = (dateStr: string) => {
        const date = new Date(dateStr);
        if (isToday(date)) return format(date, "h:mm a");
        if (isYesterday(date)) return "Yesterday";
        return format(date, "MMM d");
    };

    return (
        <div className="flex-1 overflow-hidden flex flex-col relative w-full mx-auto p-4 sm:p-6 lg:p-8 z-10 h-[calc(100vh-4rem)] md:h-screen">
            {/* Organic Background Elements */}
            <div className="organic-blob bg-primary-container/20 w-[600px] h-[600px] -top-48 -left-24 fixed pointer-events-none"></div>
            <div className="organic-blob bg-tertiary-container/20 w-[500px] h-[500px] bottom-0 right-0 fixed pointer-events-none"></div>

            <div className="mb-6 shrink-0">
                <nav className="flex items-center gap-2 text-sm mb-2">
                    <span className="text-foreground font-medium flex items-center gap-2">
                        <MessagesSquare className="h-4 w-4" /> Team Communication
                    </span>
                </nav>
                <div>
                    <h1 className="text-3xl font-black tracking-tight mb-1 text-foreground leading-none">
                        Messages
                        <span className="text-primary ml-2 text-2xl">✦</span>
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Secure end-to-end encrypted messaging with your team.</p>
                </div>
            </div>

            <div className="flex-1 flex bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/40 dark:border-white/10 shadow-[0px_20px_50px_rgba(0,0,0,0.05)] overflow-hidden ring-1 ring-black/5 relative">
                
                {/* Contacts Sidebar */}
                <div className={cn(
                    "w-full md:w-80 flex-shrink-0 border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col transition-all duration-300",
                    selectedContact ? "hidden md:flex" : "flex"
                )}>
                    <div className="p-5 pb-3">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-forest transition-colors" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search contacts..."
                                className="w-full pl-11 pr-5 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl text-[13px] font-semibold focus:ring-2 focus:ring-forest/20 transition-all placeholder:text-slate-400 outline-none shadow-sm"
                            />
                        </div>
                    </div>
                    
                    {currentUser.role === 'admin' && availableDepartments.length > 0 && (
                        <div className="px-5 pb-3 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar shrink-0">
                            <button
                                onClick={() => setSelectedDept("all")}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all",
                                    selectedDept === "all"
                                        ? "bg-forest text-white shadow-md shadow-forest/20" 
                                        : "bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:text-forest border border-slate-200/50 dark:border-slate-700/50"
                                )}
                            >
                                All
                            </button>
                            {availableDepartments.map(dept => (
                                <button
                                    key={dept}
                                    onClick={() => setSelectedDept(dept)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all",
                                        selectedDept === dept
                                            ? "bg-forest text-white shadow-md shadow-forest/20" 
                                            : "bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:text-forest border border-slate-200/50 dark:border-slate-700/50"
                                    )}
                                >
                                    {dept}
                                </button>
                            ))}
                        </div>
                    )}

                    {currentUser.role === 'supervisor' && currentUser.department?.toLowerCase() === 'supervisor' && (
                        <div className="px-5 pb-3 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar shrink-0">
                            {[
                                { id: "all", label: "All" },
                                { id: "supervisor", label: "Supervisors" },
                                { id: "teacher", label: "Teachers" }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setSelectedDept(filter.id)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all",
                                        selectedDept === filter.id
                                            ? "bg-forest text-white shadow-md shadow-forest/20" 
                                            : "bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:text-forest border border-slate-200/50 dark:border-slate-700/50"
                                    )}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6 space-y-1">
                        {isLoadingContacts ? (
                            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-forest/40" /></div>
                        ) : sortedContacts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400/50">
                                <Search className="h-12 w-12 mb-3" />
                                <p className="text-xs font-black uppercase tracking-widest text-center">No contacts found</p>
                            </div>
                        ) : sortedContacts.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => selectContact(c)}
                                className={cn(
                                    "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group active:scale-[0.98] relative",
                                    selectedContact?.id === c.id 
                                        ? "bg-forest/10 dark:bg-forest/20 shadow-sm border border-forest/20" 
                                        : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border border-transparent"
                                )}
                            >
                                <div className="relative">
                                    <div className={cn(
                                        "w-12 h-12 rounded-[1.25rem] flex items-center justify-center shadow-sm transition-transform uppercase font-black text-xs border",
                                        c.id === 'system-admin' 
                                            ? "bg-gradient-to-br from-indigo-500/10 to-purple-500/20 text-indigo-600 border-indigo-500/20" 
                                            : "bg-gradient-to-br from-forest/10 to-forest/20 text-forest border-forest/10"
                                    )}>
                                        {c.id === 'system-admin' ? <ShieldCheck className="h-5 w-5" /> : c.name.substring(0, 2)}
                                    </div>
                                    {unreadIds.has(c.id) && (
                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse shadow-lg z-10"></span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate tracking-tight">{c.name}</p>
                                        {summaries[c.id] && (
                                            <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap ml-2 opacity-60">
                                                {formatMessageDate(summaries[c.id].last_message_at)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-semibold leading-snug opacity-70 flex items-center gap-1.5">
                                        <span className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded-md",
                                            c.id === 'system-admin' ? "bg-indigo-500/10 text-indigo-600" : "bg-forest/5 text-forest"
                                        )}>
                                            {c.department || c.role}
                                        </span>
                                        {(() => {
                                            const msg = summaries[c.id]?.last_message;
                                            if (!msg) return "Start chat...";
                                            try {
                                                if (msg.startsWith('{"type":')) {
                                                    const parsed = JSON.parse(msg);
                                                    if (parsed.type === 'voice') return "🎙️ Voice Note";
                                                    if (parsed.type === 'file') return `📁 File: ${parsed.name}`;
                                                }
                                            } catch (e) {}
                                            return msg;
                                        })()}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chat Area */}
                <div className={cn(
                    "flex-1 flex flex-col bg-white/50 dark:bg-slate-900/50 backdrop-blur-md",
                    !selectedContact ? "hidden md:flex" : "flex"
                )}>
                    {selectedContact ? (
                        <>
                            {/* Chat Header */}
                            <div className="px-6 py-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center gap-4 bg-white/20 dark:bg-slate-900/20 backdrop-blur-sm z-10">
                                <button 
                                    onClick={() => setSelectedContact(null)}
                                    className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all active:scale-90 text-slate-500"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border font-black text-xs uppercase",
                                    selectedContact.id === 'system-admin' 
                                        ? "bg-gradient-to-br from-indigo-500/10 to-purple-500/20 text-indigo-600 border-indigo-500/20" 
                                        : "bg-gradient-to-br from-forest/10 to-forest/20 text-forest border-forest/10"
                                )}>
                                    {selectedContact.id === 'system-admin' ? <ShieldCheck className="h-5 w-5" /> : selectedContact.name.substring(0, 2)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-extrabold text-sm tracking-tight truncate text-slate-800 dark:text-slate-100">
                                        {selectedContact.name}
                                    </h3>
                                    <div className="flex items-center gap-1.5 opacity-80">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em] mt-0.5">
                                            {selectedContact.department || selectedContact.role}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 custom-scrollbar bg-slate-50/30 dark:bg-[#0c1a0d]/30 relative">
                                {isLoadingMessages ? (
                                    <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-forest/20" /></div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center opacity-40 p-12 space-y-4">
                                        <MessageSquareQuote className="h-16 w-16 text-forest/40" />
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Secure Channel</h4>
                                            <p className="text-[11px] mt-1 text-slate-400">Say hello to {selectedContact.name}</p>
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((m, index) => {
                                        const isMine = m.sender_id === currentUser.id || (currentUser.role === 'admin' && m.sender_role === 'admin');
                                        const isNewSequence = index === 0 || messages[index-1].sender_id !== m.sender_id;
                                        
                                        let parsedMedia: any = null;
                                        try {
                                            if (m.content.startsWith('{"type":')) {
                                                parsedMedia = JSON.parse(m.content);
                                            }
                                        } catch (e) {}

                                        return (
                                            <div key={m.id} className={cn(
                                                "flex flex-col",
                                                isMine ? "items-end" : "items-start",
                                                isNewSequence ? "mt-4" : "mt-0.5"
                                            )}>
                                                {parsedMedia?.type === 'voice' ? (
                                                    <VoicePlayer src={parsedMedia.audio} duration={parsedMedia.duration} isMine={isMine} />
                                                ) : parsedMedia?.type === 'file' ? (
                                                    <FileBubble name={parsedMedia.name} data={parsedMedia.data} size={parsedMedia.size} fileType={parsedMedia.fileType} isMine={isMine} />
                                                ) : (
                                                    <div className={cn(
                                                        "max-w-[75%] px-5 py-3 rounded-2xl text-[14px] font-medium leading-relaxed transition-all shadow-sm border",
                                                        isMine 
                                                            ? "bg-forest/90 text-white border-forest/20 rounded-br-none shadow-forest/10" 
                                                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200/50 dark:border-slate-700/50 rounded-bl-none shadow-slate-100 dark:shadow-none"
                                                    )}>
                                                        {m.content}
                                                    </div>
                                                )}
                                                {(index === messages.length - 1 || messages[index+1].sender_id !== m.sender_id) && (
                                                    <div className="flex items-center gap-1.5 mt-1.5 px-2 opacity-50">
                                                        <span className="text-[10px] font-bold tracking-tighter text-slate-400">
                                                            {format(new Date(m.created_at), "h:mm a")}
                                                        </span>
                                                        {isMine && <CheckCheck className="h-3.5 w-3.5 text-forest" />}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Box */}
                            <div className="p-5 bg-white/60 dark:bg-slate-900/60 border-t border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl z-10">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />

                                {isRecording ? (
                                    <div className="relative flex items-center justify-between gap-4 max-w-4xl mx-auto w-full bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 px-5 py-3 rounded-2xl animate-pulse">
                                        <div className="flex items-center gap-3">
                                            <span className="relative flex h-3.5 w-3.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
                                            </span>
                                            <span className="text-xs font-black uppercase text-red-600 tracking-wider">
                                                Recording Audio: {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60) < 10 ? '0' : ''}{recordingDuration % 60}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                type="button" 
                                                onClick={cancelRecording}
                                                className="w-10 h-10 rounded-xl bg-slate-200/60 dark:bg-slate-700/60 hover:bg-red-500/10 hover:text-red-500 text-slate-500 flex items-center justify-center transition-all active:scale-90"
                                                title="Cancel recording"
                                            >
                                                <span className="material-symbols-outlined text-sm font-black">delete</span>
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={stopRecording}
                                                className="w-10 h-10 rounded-xl bg-forest text-white hover:bg-forest/90 flex items-center justify-center transition-all active:scale-90 shadow-md shadow-forest/20 font-bold"
                                                title="Send voice note"
                                            >
                                                <span className="material-symbols-outlined text-sm font-black">check</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSend} className="relative flex items-center gap-3 max-w-4xl mx-auto">
                                        <div className="flex-1 relative flex items-center group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-forest/20 focus-within:border-forest/30 transition-all">
                                            <button 
                                                type="button" 
                                                onClick={handleFileClick}
                                                className="p-3.5 text-slate-400 hover:text-forest transition-colors ml-1 active:scale-90"
                                                title="Share file (PDF, Doc, Zip, Images...)"
                                            >
                                                <Paperclip className="h-5 w-5" />
                                            </button>
                                            <input
                                                type="text"
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                placeholder={`Message ${selectedContact.name}...`}
                                                className="flex-1 bg-transparent border-none outline-none py-3.5 text-[14px] font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={startRecording}
                                                className="p-3.5 text-slate-400 hover:text-red-500 transition-colors mr-1 active:scale-90"
                                                title="Record voice note"
                                            >
                                                <span className="material-symbols-outlined text-lg">mic</span>
                                            </button>
                                            <button 
                                                type="submit"
                                                disabled={!input.trim() || sendMutation.isPending}
                                                className={cn(
                                                    "mr-2 h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                                                    input.trim() 
                                                        ? "bg-forest text-white shadow-md shadow-forest/20 hover:scale-105 active:scale-95" 
                                                        : "bg-slate-100 dark:bg-slate-700 text-slate-400 opacity-50"
                                                )}
                                            >
                                                <Send className="h-4 w-4 ml-0.5" />
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                            <div className="w-24 h-24 rounded-full bg-forest/5 flex items-center justify-center mb-6">
                                <MessagesSquare className="h-10 w-10 text-forest/40" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Your Messages</h2>
                            <p className="text-sm text-slate-500 max-w-xs">Select a contact from the sidebar to start a secure conversation.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Standalone Helper Component: VoicePlayer with real base64 playback & animated waveform
function VoicePlayer({ src, duration, isMine }: { src: string, duration: string, isMine: boolean }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio(src);
        audioRef.current = audio;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener("timeupdate", updateTime);
        audio.addEventListener("ended", handleEnded);

        return () => {
            audio.removeEventListener("timeupdate", updateTime);
            audio.removeEventListener("ended", handleEnded);
            audio.pause();
        };
    }, [src]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className={cn(
            "flex items-center gap-3.5 p-3 rounded-2xl min-w-[220px] max-w-[280px] shadow-sm border font-body",
            isMine 
                ? "bg-forest/90 text-white border-forest/20 shadow-forest/10" 
                : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200/50 dark:border-slate-700/50"
        )}>
            <button 
                type="button"
                onClick={togglePlay}
                className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-md shrink-0",
                    isMine 
                        ? "bg-white text-forest hover:bg-slate-100 animate-none" 
                        : "bg-forest text-white hover:bg-forest/90"
                )}
            >
                {isPlaying ? (
                    <span className="material-symbols-outlined text-sm font-black">pause</span>
                ) : (
                    <span className="material-symbols-outlined text-sm font-black pl-0.5">play_arrow</span>
                )}
            </button>
            <div className="flex-1 space-y-1">
                {/* Waveform Visualization Mock */}
                <div className="flex items-end gap-[3px] h-5 px-1">
                    {Array.from({ length: 18 }).map((_, i) => {
                        const active = isPlaying && currentTime > 0;
                        const height = Math.abs(Math.sin(i * 0.5 + (isPlaying ? currentTime * 4 : 0))) * 14 + 4;
                        return (
                            <div 
                                key={i} 
                                className={cn(
                                    "w-[3px] rounded-full transition-all duration-150",
                                    isMine 
                                        ? (active ? "bg-white" : "bg-white/40")
                                        : (active ? "bg-forest" : "bg-slate-300 dark:bg-slate-600")
                                )}
                                style={{ height: `${height}px` }}
                            />
                        );
                    })}
                </div>
                <div className="flex justify-between text-[10px] font-bold opacity-75 px-0.5">
                    <span>{formatTime(currentTime)}</span>
                    <span>{duration || "0:00"}</span>
                </div>
            </div>
        </div>
    );
}

// Standalone Helper Component: FileBubble with images rendering and downloadable files
function FileBubble({ name, data, size, fileType, isMine }: { name: string, data: string, size: string, fileType: string, isMine: boolean }) {
    const isImage = fileType?.startsWith("image/") || name.match(/\.(jpg|jpeg|png|gif|webp)$/i);

    if (isImage) {
        return (
            <div className="space-y-1.5 max-w-[280px] font-body">
                <div className="rounded-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 shadow-md">
                    <img src={data} alt={name} className="w-full max-h-48 object-cover hover:scale-[1.03] transition-all duration-300 cursor-pointer" />
                </div>
                <div className="flex justify-between items-center px-1 text-[10px] font-bold text-slate-400">
                    <span className="truncate max-w-[150px]">{name}</span>
                    <span>{size}</span>
                </div>
                <a 
                    href={data} 
                    download={name}
                    className={cn(
                        "flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                        isMine 
                            ? "bg-white/10 hover:bg-white/20 text-white" 
                            : "bg-forest/10 hover:bg-forest/20 text-forest"
                    )}
                >
                    <span className="material-symbols-outlined text-xs">download</span> Download Image
                </a>
            </div>
        );
    }

    const getIcon = () => {
        if (name.endsWith('.pdf')) return "picture_as_pdf";
        if (name.match(/\.(doc|docx)$/i)) return "description";
        if (name.match(/\.(xls|xlsx)$/i)) return "table_chart";
        if (name.match(/\.(zip|rar|7z)$/i)) return "archive";
        return "draft";
    };

    const getIconColor = () => {
        if (name.endsWith('.pdf')) return "text-red-500 bg-red-500/10";
        if (name.match(/\.(doc|docx)$/i)) return "text-blue-500 bg-blue-500/10";
        if (name.match(/\.(xls|xlsx)$/i)) return "text-emerald-500 bg-emerald-500/10";
        return "text-amber-500 bg-amber-500/10";
    };

    return (
        <div className={cn(
            "flex flex-col p-4 rounded-2xl min-w-[220px] max-w-[280px] shadow-sm border gap-3 font-body",
            isMine 
                ? "bg-forest/90 text-white border-forest/20 shadow-forest/10" 
                : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200/50 dark:border-slate-700/50"
        )}>
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-transparent font-semibold shadow-sm",
                    isMine ? "bg-white/20 text-white" : getIconColor()
                )}>
                    <span className="material-symbols-outlined text-lg">{getIcon()}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-bold truncate", isMine ? "text-white" : "text-slate-800 dark:text-slate-200")}>{name}</p>
                    <p className="text-[10px] font-semibold opacity-75 mt-0.5">{size}</p>
                </div>
            </div>
            <a 
                href={data} 
                download={name}
                className={cn(
                    "w-full py-2.5 rounded-xl text-center text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95",
                    isMine 
                        ? "bg-white text-forest hover:bg-slate-100" 
                        : "bg-forest text-white hover:bg-forest/90"
                )}
            >
                <span className="material-symbols-outlined text-xs">download</span> Download File
            </a>
        </div>
    );
}
