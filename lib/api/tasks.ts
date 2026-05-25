import { supabase } from "@/lib/supabase";
import { Task, TaskComment, CreateTaskInput, UpdateTaskInput } from "@/types/task";
import { createNotification } from "./notifications";

export async function getTasks(filters?: { supervisor_id?: string; status?: string; created_by?: string }): Promise<Task[]> {
    let query = supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

    if (filters?.supervisor_id && filters?.created_by) {
        query = query.or(`supervisor_id.eq.${filters.supervisor_id},created_by.eq.${filters.created_by}`);
    } else if (filters?.supervisor_id) {
        query = query.eq("supervisor_id", filters.supervisor_id);
    }
    
    if (filters?.status) {
        query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) {
        console.error(`[TASKS API ERROR] ${error.message} (Code: ${error.code})`);
        if (error.hint) console.error(`Hint: ${error.hint}`);
        throw error;
    }

    return data || [];
}

export async function getTaskById(id: string): Promise<Task | null> {
    const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error("Error fetching task:", error);
        return null;
    }

    return data;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
    const { data, error } = await supabase
        .from("tasks")
        .insert([input])
        .select()
        .single();

    if (error) {
        console.error(`[CREATE TASK ERROR] ${error.message} (Code: ${error.code})`);
        throw error;
    }

    // Notify Assignee if assigned
    if (data.supervisor_id) {
        try {
            await createNotification({
                type: 'INFO',
                title: 'New Task Assigned',
                message: `A new task has been assigned to you: ${data.title}`,
                recipient_id: data.supervisor_id,
                link: '/tasks'
            });
        } catch (e) {
            console.error("Failed to send assignment notification", e);
        }
    }

    return data;
}

export async function updateTask(id: string, updates: UpdateTaskInput): Promise<Task> {
    const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Error updating task:", error);
        throw error;
    }

    // Notify Admin if a supervisor updates status
    // Note: In a real app, we'd check the current user's role here.
    // We'll assume the caller handles the role check if needed, 
    // or we'll pass a performerName in the future.
    
    return data;
}

export async function deleteTask(id: string): Promise<void> {
    const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

    if (error) {
        console.error(`[DELETE TASK ERROR] ${error.message} (Code: ${error.code})`);
        throw error;
    }
}

// Comments API
export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
    const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error fetching comments:", error);
        throw error;
    }

    return data || [];
}

export async function addTaskComment(comment: Omit<TaskComment, "id" | "created_at">): Promise<TaskComment> {
    const { data, error } = await supabase
        .from("task_comments")
        .insert([comment])
        .select()
        .single();

    if (error) {
        console.error("Error adding comment:", error);
        throw error;
    }

    return data;
}
