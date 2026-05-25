"use client";

import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  CreateTaskInput, 
  UpdateTaskInput 
} from "@/types/task";
import { Supervisor } from "@/types/supervisor";
import { 
  Calendar, 
  User, 
  Loader2, 
  Trash2,
  CheckCircle2,
  Clock3,
  ListTodo
} from "lucide-react";

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  supervisors: Supervisor[];
  user: { id: string; name: string; role: 'admin' | 'supervisor' };
  onSave: (task: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  initialStatus?: TaskStatus;
}

export const TaskDialog: React.FC<TaskDialogProps> = ({
  isOpen,
  onClose,
  task,
  supervisors,
  user,
  onSave,
  onDelete,
  initialStatus = "todo"
}) => {
  const [formData, setFormData] = useState<Partial<Task>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>("all");

  const departments = ["Supervisor", "Marketing", "Tech Team", "Finance"];

  useEffect(() => {
    if (task) {
      setFormData(task);

      // Auto-detect department
      if (task.supervisor_id) {
          const sup = supervisors.find(s => s.id === task.supervisor_id);
          if (sup) setSelectedDept(sup.department || "Supervisor");
      } else {
          setSelectedDept("all");
      }
    } else {
      setFormData({
        title: "",
        description: "",
        status: initialStatus,
        priority: "medium",
        supervisor_id: "",
        deadline: ""
      });
      setSelectedDept("all");
    }
  }, [task, initialStatus, isOpen, supervisors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData as any);
      onClose();
    } catch (error) {
      console.error("Failed to save task", error);
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = user.role === 'admin';
  const isSupervisor = user.role === 'supervisor';

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-emerald-100 dark:border-emerald-800/20 bg-emerald-50/50 dark:bg-[#0c1a0d] gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-emerald-100 dark:border-emerald-800/20">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold tracking-tight text-emerald-950 dark:text-emerald-50">
                {task ? "Task Details" : "Create New Task"}
              </DialogTitle>
              <DialogDescription className="text-emerald-800/60 dark:text-emerald-200/60 mt-1">
                Manage your project tasks and collaborate with team members.
              </DialogDescription>
            </div>
            {task && (isAdmin || (isSupervisor && task.created_by === user.id)) && onDelete && (
              <button
                type="button"
                onClick={() => {
                   if (!showDeleteConfirm) {
                     setShowDeleteConfirm(true);
                     setTimeout(() => setShowDeleteConfirm(false), 3000); // Reset after 3 seconds
                   } else {
                     onDelete(task.id);
                   }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  showDeleteConfirm 
                    ? 'bg-rose-500 text-white animate-pulse scale-105' 
                    : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {showDeleteConfirm ? "Click again to Confirm" : "Delete"}
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="title" className="text-emerald-900 dark:text-emerald-100 font-semibold">Title</Label>
              </div>
              <Input
                id="title"
                placeholder="What needs to be done?"
                value={formData.title || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                disabled={!isAdmin && !isSupervisor}
                required
                className={`bg-white dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/40 focus:ring-emerald-500 ${!isAdmin && !isSupervisor ? 'opacity-70 cursor-not-allowed' : ''}`}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description" className="text-emerald-900 dark:text-emerald-100 font-semibold">Description</Label>
              </div>
              <Textarea
                id="description"
                placeholder="Add more details about this task..."
                value={formData.description || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                readOnly={!isAdmin && !isSupervisor}
                className={`bg-white dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/40 min-h-[100px] focus:ring-emerald-500 ${!isAdmin && !isSupervisor ? 'opacity-70' : ''}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-emerald-900 dark:text-emerald-100 font-semibold">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val as TaskStatus })}
                >
                  <SelectTrigger className="bg-white dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/40">
                    <div className="flex items-center">
                      {formData.status === 'todo' && <ListTodo className="w-4 h-4 mr-2 text-emerald-600" />}
                      {formData.status === 'in_progress' && <Clock3 className="w-4 h-4 mr-2 text-amber-500" />}
                      {formData.status === 'done' && <CheckCircle2 className="w-4 h-4 mr-2 text-blue-500" />}
                      <SelectValue placeholder="Select status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#0c1a0d] border-emerald-100 dark:border-emerald-800/40">
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-emerald-900 dark:text-emerald-100 font-semibold">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(val) => setFormData({ ...formData, priority: val as TaskPriority })}
                  disabled={!isAdmin && !isSupervisor}
                >
                  <SelectTrigger className="bg-white dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/40">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#0c1a0d] border-emerald-100 dark:border-emerald-800/40">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-emerald-900 dark:text-emerald-100 font-semibold">Department</Label>
                </div>
                <Select
                  value={selectedDept}
                  onValueChange={setSelectedDept}
                  disabled={!isAdmin}
                >
                  <SelectTrigger className={`bg-white dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/40 ${!isAdmin ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#0c1a0d] border-emerald-100 dark:border-emerald-800/40">
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-emerald-900 dark:text-emerald-100 font-semibold">Assign To</Label>
                </div>
                <Select
                  value={formData.supervisor_id || "unassigned"}
                  onValueChange={(val) => {
                      const newId = val === "unassigned" ? null : val;
                      setFormData(prev => ({ ...prev, supervisor_id: newId }));
                  }}
                  disabled={!isAdmin && !isSupervisor}
                >
                  <SelectTrigger className={`bg-white dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/40 ${!isAdmin && !isSupervisor ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2 opacity-50" />
                      <SelectValue placeholder="Search employee..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#0c1a0d] border-emerald-100 dark:border-emerald-800/40">
                    <SelectItem value="unassigned">Not Assigned</SelectItem>
                    {supervisors
                      .filter(s => selectedDept === "all" || s.department === selectedDept)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center justify-between w-full min-w-[140px]">
                            <span>{s.name}</span>
                            <span className="text-[9px] opacity-40 uppercase font-black ml-4">{s.department || "Supervisor"}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline" className="text-emerald-900 dark:text-emerald-100 font-semibold">Deadline</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-4 h-4 opacity-50 text-emerald-800 dark:text-emerald-200" />
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline ? formData.deadline.split('T')[0] : ""}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    disabled={!isAdmin && !isSupervisor}
                    className="pl-10 bg-white dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800/40"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <DialogFooter className="p-6 border-t border-emerald-100 dark:border-emerald-800/20 bg-white/50 dark:bg-black/20">
          <div className="flex justify-end w-full items-center">
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
              <Button 
                type="button"
                onClick={handleSubmit} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 font-semibold"
                disabled={isSaving || !formData.title}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {task ? "Save Changes" : "Create Task"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
