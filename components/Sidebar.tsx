"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(auth)/login/actions";
import { Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const navItems = [
    { label: "Dashboard", href: "/", icon: "dashboard" },
    { label: "Departments", href: "/departments/supervisor", icon: "corporate_fare" },
    { label: "Students", href: "/students", icon: "group" },
    { label: "Time Table", href: "/timetable", icon: "calendar_month" },
    { label: "Attendance", href: "/attendance", icon: "event_available" },
    { label: "Online Class", href: "/online-class", icon: "video_call" },
    { label: "Tasks", href: "/tasks", icon: "assignment" },
    { label: "Messages", href: "/messages", icon: "chat" },
    { label: "Reports", href: "/reports", icon: "history_edu" },
    { label: "Complaints", href: "/complaints", icon: "report_problem" },
    { label: "Payroll", href: "/payroll", icon: "payments" },
    { label: "Homework", href: "/homework", icon: "menu_book" },
    { label: "Settings", href: "/settings", icon: "settings" },
];

export function Sidebar({ 
    role = "admin", 
    userName = "Admin", 
    supervisorId,
    currentUserId,
    department = "Supervisor" 
}: { 
    role?: string, 
    userName?: string, 
    supervisorId?: string,
    currentUserId?: string,
    department?: string
}) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
    const deptRole = department.toLowerCase().replace(' ', '-');

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!currentUserId) return;

        const checkUnread = async () => {
            let query = supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('is_read', false);

            if (role === 'admin') {
                query = query.is('recipient_id', null).neq('sender_role', 'admin');
            } else {
                query = query.eq('recipient_id', currentUserId);
            }

            const { count, error } = await query;
            if (!error && count !== null) {
                setHasUnreadMessages(count > 0);
            }
        };

        checkUnread();

        // Real-time subscription to new messages
        const channelId = `sidebar-chat-${Math.random().toString(36).substring(7)}`;
        const channel = supabase.channel(channelId);
        
        channel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                const newMessage = payload.new;
                
                // If message is unread and addressed to current user
                if (newMessage.is_read === false) {
                    const isForMe = role === 'admin' 
                        ? (newMessage.recipient_id === null && newMessage.sender_role !== 'admin')
                        : (newMessage.recipient_id === currentUserId);
                        
                    if (isForMe) {
                        setHasUnreadMessages(true);
                    }
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
                // If messages are marked as read, recheck
                checkUnread();
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [currentUserId, role]);

    const SidebarContent = () => (
        <>
            <div className="mb-10 px-4 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-50 brand-font">AL Huda LMS</h1>
                    <p className="text-emerald-800/60 dark:text-emerald-200/60 text-sm font-medium">Management</p>
                </div>
                <button
                    className="md:hidden p-2 text-emerald-800 dark:text-emerald-200 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-800/40"
                    onClick={() => setMobileOpen(false)}
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
            
            <nav className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pb-4 pt-2 pr-2">
                {navItems.map((item) => {
                    // Role-based visibility
                    if (role === "supervisor") {
                        if (deptRole === 'supervisor') {
                            const allowed = ["Dashboard", "Departments", "Students", "Attendance", "Time Table", "Tasks", "Reports", "Homework", "Messages"];
                            if (!allowed.includes(item.label)) return null;
                        } else {
                            // Specialized departments only see Tasks and Messages
                            const allowed = ["Dashboard", "Tasks", "Messages"];
                            if (!allowed.includes(item.label)) return null;
                        }
                    }

                    if (role === "teacher") {
                        const allowed = ["Dashboard", "Time Table", "Online Class", "Attendance", "Reports", "Students", "Homework", "Messages"];
                        if (!allowed.includes(item.label)) return null;
                    }

                    if (role === "student") {
                        const allowed = ["Dashboard", "Online Class", "Homework", "Messages"];
                        if (!allowed.includes(item.label)) return null;
                    }

                    let href = item.href;
                    // Point Dashboard to correct personal URL for specialized departments
                    if (role === "supervisor" && item.label === "Dashboard" && supervisorId) {
                        if (deptRole !== 'supervisor' && deptRole !== 'tech' && deptRole !== 'marketing') {
                            href = `/departments/${deptRole}/${supervisorId}`;
                        }
                    }
                    if (role === "supervisor" && item.label === "Departments") {
                        href = "/departments/teacher";
                    }

                    const isActive = pathname === href || 
                                     (href !== "/" && pathname.startsWith(href)) ||
                                     (item.label === "Students" && pathname === "/departments/students");
                    const showDot = item.label === "Messages" && hasUnreadMessages;
                    
                    return (
                        <Link
                            key={item.label}
                            href={href}
                            className={cn(
                                "flex items-center space-x-3 px-4 py-3 rounded-full transition-all duration-200 relative",
                                isActive
                                    ? "bg-forest dark:bg-emerald-600 text-white shadow-md scale-100"
                                    : "text-emerald-800/70 dark:text-emerald-200/70 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 hover:scale-[1.02]"
                            )}
                        >
                            <span className="material-symbols-outlined shrink-0" data-icon={item.icon}>{item.icon}</span>
                            <span className={cn("font-medium", isActive && "font-semibold")}>{item.label}</span>
                            {showDot && (
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse shadow-md"></span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="pt-6 shrink-0">
                <div className="flex items-center space-x-3 p-3 bg-white/40 dark:bg-white/5 rounded-2xl mb-3">
                    <img 
                      alt="User profile" 
                      className="w-10 h-10 rounded-full object-cover shadow-sm"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUhxV22pIJmPilkEv8LzdMcLfEGEmONVFg6yH_HZKUzvG1rqH6gG-QpyjBAbnp4uu4uUYLfMs6JSb_4m6jct1NQ-i1N1Dhp5jRyFugoX3t3eNTxCeflBqir-a-tWDLVS0OAIw0i-M6Jmnf4y0Oco8kpEUtGcrM8ESnf9oJNtYAGDNtSL0vzG7ICmrfuyoKKXG1Pif4i90BNTDRT2uc_BO5wlXAzQdaEh6NvLQcdrL_0DkQ4BALCk6m6puEsbWdg6nT1w6QPyioUYmV" 
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-50 truncate capitalize">
                            {userName}
                        </p>
                        <p className="text-xs text-emerald-800/60 dark:text-emerald-200/60 truncate capitalize">
                            {role === "admin" ? "Administrator" : (role === "teacher" ? "Teacher" : (role === "student" ? "Student" : `${department} Team`))}
                        </p>
                    </div>
                </div>
                
                <form action={logoutAction} className="w-full">
                    <button 
                      type="submit"
                      className="flex items-center space-x-3 px-4 py-3 text-emerald-800/70 dark:text-emerald-200/70 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full hover:scale-[1.02] transition-all duration-200 w-full text-left"
                    >
                        <span className="material-symbols-outlined text-red-600 dark:text-red-400">logout</span>
                        <span className="font-medium text-red-600 dark:text-red-400">Logout</span>
                    </button>
                </form>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Header (retained for mobile friendliness) */}
            <header className="md:hidden fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-30 glass-panel border-b border-white/20">
                <div className="flex items-center">
                   <h1 className="text-xl font-bold tracking-tight text-emerald-900 dark:text-emerald-50 brand-font">AL Huda LMS</h1>
                </div>
                <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2 -mr-2 text-emerald-900 dark:text-emerald-50 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 rounded-xl transition-colors"
                >
                    <Menu className="h-6 w-6" />
                </button>
            </header>

            {/* Mobile Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden",
                    mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setMobileOpen(false)}
                aria-hidden="true"
            />

            {/* Desktop / Mobile Combined Sidebar Layout */}
            <aside
                className={cn(
                    "fixed md:relative top-0 bottom-0 left-0 z-50 flex flex-col h-full w-72 p-6 glass-panel md:rounded-r-3xl rounded-none shadow-[0px_0px_48px_rgba(45,52,50,0.06)] md:border-r border-white/20 dark:border-white/5 transition-transform duration-300 ease-in-out font-body",
                    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}
            >
                <SidebarContent />
            </aside>
        </>
    );
}
