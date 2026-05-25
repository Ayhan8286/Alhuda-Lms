"use client";

import React, { useState, useEffect } from "react";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { 
  getTasks, 
  createTask, 
  updateTask, 
  deleteTask as deleteTaskApi 
} from "@/lib/api/tasks";
import { getSupervisors } from "@/lib/api/supervisors";
import { getTeachersBySupervisor } from "@/lib/api/classes";
import { createNotification } from "@/lib/api/notifications";
import { Task, TaskStatus, CreateTaskInput, UpdateTaskInput } from "@/types/task";
import { Supervisor } from "@/types/supervisor";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Filter, 
  Search, 
  LayoutDashboard, 
  UserCircle2,
  AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";

// Simple cookie helper to avoid extra dependencies
const getCookie = (name: string) => {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [initialStatus, setInitialStatus] = useState<TaskStatus>("todo");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("all");
  const [user, setUser] = useState<{ id: string; name: string; role: 'admin' | 'supervisor' } | null>(null);
  const [hasError, setHasError] = useState(false);

  // Load user data from cookies (similar to layout.tsx logic)
  useEffect(() => {
    const role = (getCookie("auth_role") as 'admin' | 'supervisor') || "admin";
    const supervisorId = getCookie("supervisor_id");
    // Use the supervisorId if available, or 'admin' for admins (now supported by TEXT column)
    const userId = (role === "supervisor" ? supervisorId : "admin") || "unknown";
    
    setUser({ 
        id: userId, 
        name: role === "admin" ? "Admin" : "Supervisor", 
        role: role 
    });
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setHasError(false);
    
    const role = getCookie("auth_role") || "admin";
    const supervisorId = getCookie("supervisor_id");

    // Fetch supervisors independently so they load even if tasks fail
    try {
        if (role === "admin") {
            const sups = await getSupervisors(undefined, true);
            setSupervisors(sups);
        } else if (role === "supervisor" && supervisorId) {
            // For supervisors, fetch only their assigned teachers!
            const teachers = await getTeachersBySupervisor(supervisorId);
            const mappedTeachers = teachers.map(t => ({
                id: t.id,
                name: t.name,
                email: t.email,
                phone: t.phone,
                department: "Teacher",
                timing: t.timing || "",
                password: t.password || ""
            }));
            setSupervisors(mappedTeachers as any);
            
            // Fetch current supervisor details to update their name in the task board header
            const { getSupervisorById } = await import("@/lib/api/supervisors");
            const currentSup = await getSupervisorById(supervisorId);
            if (currentSup) {
                setUser(prev => {
                    if (prev && prev.name !== currentSup.name) {
                        return { ...prev, name: currentSup.name };
                    }
                    return prev;
                });
            }
        }
    } catch (error) {
        console.error("Failed to load staff list", error);
    }

    try {
      const filters: any = {};
      if (role === "supervisor" && supervisorId) {
        filters.supervisor_id = supervisorId;
        filters.created_by = supervisorId; // Allows supervisors to see supervisor-created tasks (for teachers)
      } else if (selectedSupervisor !== "all") {
        filters.supervisor_id = selectedSupervisor;
      }

      const tasksData = await getTasks(filters);
      setTasks(tasksData);
    } catch (error) {
      console.error("Failed to load tasks", error);
      setHasError(true);
      setTasks([]); 
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user, selectedSupervisor]);

  const handleAddTask = (status: TaskStatus) => {
    if (user?.role !== 'admin' && user?.role !== 'supervisor') {
        toast.error("You are not authorized to create tasks");
        return;
    }
    setSelectedTask(null);
    setInitialStatus(status);
    setIsDialogOpen(true);
  };

  const handleTaskClick = async (task: Task) => {
    // Check if this was a quick status update from the card
    const originalTask = tasks.find(t => t.id === task.id);
    if (originalTask && originalTask.status !== task.status) {
        try {
            const updatedTask = await updateTask(task.id, { status: task.status });
            setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
            toast.success(`Task moved to ${task.status.replace('_', ' ')}`);

            // Notify Admin if supervisor moved task
            if (user?.role === 'supervisor') {
                try {
                    await createNotification({
                        type: 'INFO',
                        title: 'Task Status Updated',
                        message: `${user.name} moved '${task.title}' to ${task.status.replace('_', ' ')}`,
                        recipient_id: null, // Broadcast to admins
                        link: '/tasks'
                    });
                } catch (e) {
                    console.error("Failed to send status update notification", e);
                }
            }
            return;
        } catch (error) {
            console.error("Failed to update status", error);
            toast.error("Status update failed");
        }
    }
    
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const handleSaveTask = async (input: any) => {
    try {
      if (selectedTask) {
        const updatedTask = await updateTask(selectedTask.id, input as UpdateTaskInput);
        setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
        toast.success("Task updated successfully");
      } else {
        const newTask = await createTask({
          ...input,
          created_by: user?.id
        } as CreateTaskInput);
        setTasks([newTask, ...tasks]);
        toast.success("Task created successfully");
      }
    } catch (error) {
      console.error("Save error", error);
      toast.error("Failed to save task");
      throw error;
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteTaskApi(id);
      setTasks(tasks.filter(t => t.id !== id));
      setIsDialogOpen(false);
      toast.success("Task deleted");
    } catch (error) {
      console.error("Delete error", error);
      toast.error("Failed to delete task");
    }
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-emerald-950 dark:text-emerald-50 brand-font mb-2">
            Project Board
          </h1>
          <p className="text-emerald-800/60 dark:text-emerald-200/60 font-medium">
            {user?.role === 'admin' 
              ? "Oversee and assign tasks to department staff" 
              : "Manage and assign tasks for your department"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(user?.role === 'admin' || user?.role === 'supervisor') && (
            <Button 
              onClick={() => handleAddTask('todo')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-6 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Task
            </Button>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-3xl p-4 border border-white/20 dark:border-white/5 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-auto md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-800/40 dark:text-emerald-200/40" />
          <Input 
            placeholder="Search tasks..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/60 dark:bg-emerald-950/40 border-none rounded-2xl focus-visible:ring-emerald-500"
          />
        </div>

        {user?.role === 'admin' && (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="w-4 h-4 text-emerald-800/60 dark:text-emerald-200/60" />
            <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
              <SelectTrigger className="w-full md:w-[200px] bg-white/60 dark:bg-emerald-950/40 border-none rounded-2xl">
                <div className="flex items-center">
                  <UserCircle2 className="w-4 h-4 mr-2 opacity-50" />
                  <SelectValue placeholder="All Staff" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#0c1a0d] border-emerald-100 dark:border-emerald-800/40 rounded-2xl">
                <SelectItem value="all">All Staff</SelectItem>
                {supervisors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{s.name}</span>
                      <span className="text-[10px] opacity-40 uppercase font-black">{s.department || "Supervisor"}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {hasError ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/20 dark:bg-white/5 rounded-[40px] border-2 border-dashed border-emerald-100 dark:border-emerald-800/20">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-6">
            <LayoutDashboard className="w-10 h-10 text-emerald-600 dark:text-emerald-400 opacity-60" />
          </div>
          <h3 className="text-xl font-bold text-emerald-950 dark:text-emerald-50 mb-2">Connection Issue</h3>
          <p className="text-emerald-800/60 dark:text-emerald-200/60 text-center max-w-sm px-6">
            We couldn't reach the tasks database. Please check your setup.
          </p>
          
          <div className="mt-8 p-6 bg-amber-50 dark:bg-amber-950/20 rounded-3xl border border-amber-200/50 dark:border-amber-900/20 max-w-2xl flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-100 mb-1">Database Setup Required</p>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                  It looks like the `tasks` tables are missing or misconfigured. Please run this SQL in your Supabase SQL Editor:
                </p>
              </div>
            </div>
            
            <pre className="bg-black/80 text-emerald-400 p-4 rounded-xl text-[10px] overflow-x-auto custom-scrollbar font-mono">
{`CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    deadline TIMESTAMPTZ,
    supervisor_id UUID REFERENCES public.supervisors(id),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);`}
            </pre>
          </div>
        </div>
      ) : (
        <TaskBoard 
          tasks={filteredTasks}
          supervisors={supervisors}
          onTaskClick={handleTaskClick}
          onAddTask={handleAddTask}
          isLoading={isLoading}
        />
      )}

      {user && (
        <TaskDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          task={selectedTask}
          supervisors={supervisors}
          user={user}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          initialStatus={initialStatus}
        />
      )}
    </div>
  );
}
