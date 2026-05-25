import { supabase } from "@/lib/supabase";

export interface SystemNotification {
    id: string;
    created_at: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
    title: string;
    message: string;
    sender_id?: string;
    recipient_id?: string | null;
    is_read: boolean;
    link?: string;
    metadata?: any;
}

export async function getNotifications(userId?: string, role: string = 'admin'): Promise<SystemNotification[]> {
    let query = supabase
        .from("system_notifications")
        .select("*");

    const isStaff = role !== 'student' && role !== 'teacher';

    if (userId) {
        if (isStaff) {
            query = query.or(`recipient_id.eq.${userId},recipient_id.is.null`);
        } else {
            query = query.eq("recipient_id", userId);
        }
    } else {
        if (isStaff) {
            query = query.is("recipient_id", null);
        } else {
            // Non-staff should never query empty recipient_id broadcast alerts
            query = query.eq("recipient_id", "00000000-0000-0000-0000-000000000000"); 
        }
    }

    query = query.order("created_at", { ascending: false }).limit(20);

    const { data, error } = await query;

    if (error) {
        console.error("DEBUG - Notification FETCH ERROR:", JSON.stringify({
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        }, null, 2));
        return [];
    }

    return data || [];
}

export async function createNotification(notification: Omit<SystemNotification, "id" | "created_at" | "is_read">) {
    const { data, error } = await supabase
        .from("system_notifications")
        .insert([{ ...notification, is_read: false }])
        .select()
        .single();

    if (error) {
        console.error("Error creating notification:", error);
        throw error;
    }

    return data;
}

export async function markAsRead(id: string) {
    const { error } = await supabase
        .from("system_notifications")
        .update({ is_read: true })
        .eq("id", id);

    if (error) {
        console.error("Error marking notification as read:", error);
        throw error;
    }
}

export async function markAllAsRead(userId?: string, role: string = 'admin') {
    let query = supabase
        .from("system_notifications")
        .update({ is_read: true })
        .eq("is_read", false);

    const isStaff = role !== 'student' && role !== 'teacher';

    if (userId) {
        if (isStaff) {
            query = query.or(`recipient_id.eq.${userId},recipient_id.is.null`);
        } else {
            query = query.eq("recipient_id", userId);
        }
    } else {
        if (isStaff) {
            query = query.is("recipient_id", null);
        } else {
            query = query.eq("recipient_id", "00000000-0000-0000-0000-000000000000");
        }
    }

    const { error } = await query;

    if (error) {
        console.error("Error marking all notifications as read:", error);
        throw error;
    }
}

export function subscribeToNotifications(userId: string | undefined, role: string, onNew: (notif: SystemNotification) => void) {
    // Unique channel per user/role subscription
    const channelId = `notifications-${role}-${userId || 'broadcast'}`;
    
    const isStaff = role !== 'student' && role !== 'teacher';

    return supabase
        .channel(channelId)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'system_notifications'
            },
            (payload) => {
                const newNotif = payload.new as SystemNotification;
                
                // Filtering logic for the client-side subscription
                const isToMe = isStaff 
                    ? (newNotif.recipient_id === userId || !newNotif.recipient_id)
                    : (newNotif.recipient_id === userId);

                if (isToMe) {
                    onNew(newNotif);
                }
            }
        )
        .subscribe();
}
