import { supabase } from "@/lib/supabase";

export interface Message {
    id: string;
    sender_id: string;
    sender_name: string;
    sender_role: string;
    recipient_id: string | null;
    content: string;
    created_at: string;
    is_read: boolean;
}

export interface ChatContact {
    id: string;
    name: string;
    role: string;
    department?: string;
    email?: string;
}

export async function sendMessage(
    content: string, 
    senderId: string, 
    senderName: string, 
    senderRole: string,
    recipientId: string | null = null
): Promise<Message> {
    const finalRecipientId = recipientId === 'system-admin' ? null : recipientId;

    const { data, error } = await supabase
        .from("messages")
        .insert([{
            content,
            sender_id: senderId,
            sender_name: senderName,
            sender_role: senderRole,
            recipient_id: finalRecipientId
        }])
        .select()
        .single();

    if (error) {
        console.error("Error sending message:", error.message, error.details, error.hint);
        throw error;
    }

    return data;
}

export async function getConversation(user1Id: string, user2Id: string | null): Promise<Message[]> {
    let query = supabase.from("messages").select("*");

    if (user2Id === 'system-admin' || user2Id === null) {
        // Conversation between user1 and Admin (null recipient)
        query = query.or(`and(sender_id.eq.${user1Id},recipient_id.is.null),and(sender_role.eq.admin,recipient_id.eq.${user1Id})`);
    } else {
        // Conversation between user1 and user2
        query = query.or(`and(sender_id.eq.${user1Id},recipient_id.eq.${user2Id}),and(sender_id.eq.${user2Id},recipient_id.eq.${user1Id})`);
    }

    const { data, error } = await query.order("created_at", { ascending: true });

    if (error) {
        console.error("Error fetching conversation:", error.message, error.details, error.hint);
        throw error;
    }

    return data || [];
}

export async function getConversationsSummary(userId: string, role: string): Promise<Record<string, { last_message: string, last_message_at: string }>> {
    let query = supabase.from("messages").select("sender_id, recipient_id, content, created_at, sender_role");
    
    if (role === 'admin') {
        // Admin sees all their messages
        query = query.or(`sender_role.eq.admin,recipient_id.is.null,recipient_id.eq.${userId}`);
    } else {
        // User sees messages to/from them
        query = query.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching summaries:", error);
        throw error;
    }

    const summaries: Record<string, { last_message: string, last_message_at: string }> = {};

    data?.forEach((m) => {
        let otherId: string;
        
        if (role === 'admin') {
            otherId = m.sender_role === 'admin' ? (m.recipient_id || 'unknown') : m.sender_id;
        } else {
            if (m.sender_role === 'admin' || m.recipient_id === null) {
                otherId = 'system-admin';
            } else {
                otherId = m.sender_id === userId ? m.recipient_id! : m.sender_id;
            }
        }

        if (otherId && otherId !== 'unknown' && !summaries[otherId]) {
            summaries[otherId] = {
                last_message: m.content,
                last_message_at: m.created_at
            };
        }
    });

    return summaries;
}

export async function getChatContacts(
    userId: string, 
    role: string, 
    department: string = 'Supervisor',
    supervisorId?: string
): Promise<ChatContact[]> {
    const contacts: ChatContact[] = [];

    const ADMIN_CONTACT: ChatContact = {
        id: 'system-admin',
        name: 'System Administrator',
        role: 'admin',
        department: 'Administration'
    };
    
    if (role !== 'admin') {
        contacts.push(ADMIN_CONTACT);
    }

    if (role === 'admin') {
        const { data: supervisors } = await supabase.from('supervisors').select('id, name, department, email');
        const { data: teachers } = await supabase.from('teachers').select('id, name, department, email').eq('is_active', true);
        const { data: students } = await supabase.from('students').select('id, full_name, reg_no').eq('status', 'active');
        
        supervisors?.forEach(s => contacts.push({ ...s, role: 'supervisor' }));
        teachers?.forEach(t => contacts.push({ ...t, role: 'teacher' }));
        students?.forEach(s => contacts.push({ id: s.id, name: `${s.full_name} (${s.reg_no})`, role: 'student', department: 'Student' }));
    } 
    else if (role === 'supervisor') {
        if (department.toLowerCase() === 'supervisor') {
            const { data: otherSupervisors } = await supabase.from('supervisors')
                .select('id, name, department, email')
                .ilike('department', 'supervisor')
                .neq('id', userId);
            otherSupervisors?.forEach(s => contacts.push({ ...s, role: 'supervisor' }));

            const { data: assignedTeachers } = await supabase.from('teachers')
                .select('id, name, department, email')
                .eq('supervisor_id', userId)
                .eq('is_active', true);
            assignedTeachers?.forEach(t => contacts.push({ ...t, role: 'teacher' }));

            // Supervisors can see active students under their direct supervision or their teachers
            const studentIds = new Set<string>();
            const { data: directStudents } = await supabase.from('students')
                .select('id, full_name, reg_no')
                .eq('supervisor_id', userId)
                .eq('status', 'active');
            directStudents?.forEach(s => {
                if (!studentIds.has(s.id)) {
                    studentIds.add(s.id);
                    contacts.push({ id: s.id, name: `${s.full_name} (${s.reg_no})`, role: 'student', department: 'Student' });
                }
            });

            const teacherIds = (assignedTeachers || []).map(t => t.id);
            if (teacherIds.length > 0) {
                const { data: classStudents } = await supabase.from('classes')
                    .select(`student:students(id, full_name, reg_no)`)
                    .in('teacher_id', teacherIds);
                classStudents?.forEach((cs: any) => {
                    const s = Array.isArray(cs.student) ? cs.student[0] : cs.student;
                    if (s && !studentIds.has(s.id)) {
                        studentIds.add(s.id);
                        contacts.push({ id: s.id, name: `${s.full_name} (${s.reg_no})`, role: 'student', department: 'Student' });
                    }
                });
            }
        } else {
            const { data: deptMembers } = await supabase.from('supervisors')
                .select('id, name, department, email')
                .eq('department', department)
                .neq('id', userId);
            deptMembers?.forEach(s => contacts.push({ ...s, role: 'supervisor' }));
        }
    }
    else if (role === 'teacher') {
        if (supervisorId) {
            const { data: mySupervisor } = await supabase.from('supervisors')
                .select('id, name, department, email')
                .eq('id', supervisorId)
                .single();
            if (mySupervisor) {
                contacts.push({ ...mySupervisor, role: 'supervisor' });
            }
            
            const { data: peerTeachers } = await supabase.from('teachers')
                .select('id, name, department, email')
                .eq('supervisor_id', supervisorId)
                .neq('id', userId)
                .eq('is_active', true);
            peerTeachers?.forEach(t => contacts.push({ ...t, role: 'teacher' }));
        }

        // Teachers can see active students assigned to their classes
        const { data: classStudents } = await supabase.from('classes')
            .select(`student:students(id, full_name, reg_no)`)
            .eq('teacher_id', userId);
        const studentIds = new Set<string>();
        classSchedulesMapping(classStudents, studentIds, contacts);
    }
    else if (role === 'student') {
        // Students see assigned supervisor
        const { data: student } = await supabase.from('students')
            .select('supervisor_id')
            .eq('id', userId)
            .maybeSingle();

        if (student?.supervisor_id) {
            const { data: supervisor } = await supabase.from('supervisors')
                .select('id, name, department, email')
                .eq('id', student.supervisor_id)
                .maybeSingle();
            if (supervisor) {
                contacts.push({ ...supervisor, role: 'supervisor' });
            }
        }

        // Students see active teachers from their classes
        const { data: classSchedules } = await supabase.from('classes')
            .select(`
                teacher:teachers(id, name, department, email)
            `)
            .eq('student_id', userId);

        const teacherIds = new Set<string>();
        classSchedules?.forEach((cs: any) => {
            const t = Array.isArray(cs.teacher) ? cs.teacher[0] : cs.teacher;
            if (t && !teacherIds.has(t.id)) {
                teacherIds.add(t.id);
                contacts.push({ ...t, role: 'teacher' });
            }
        });
    }

    return contacts;
}

// Helper function to prevent duplicate student list mappings
function classSchedulesMapping(classStudents: any[] | null, studentIds: Set<string>, contacts: ChatContact[]) {
    classStudents?.forEach((cs: any) => {
        const s = Array.isArray(cs.student) ? cs.student[0] : cs.student;
        if (s && !studentIds.has(s.id)) {
            studentIds.add(s.id);
            contacts.push({ id: s.id, name: `${s.full_name} (${s.reg_no})`, role: 'student', department: 'Student' });
        }
    });
}

export function subscribeToMessages(callback: (message: Message) => void) {
    const channelId = `chat-${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId);
    
    channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            callback(payload.new as Message);
        })
        .subscribe();

    return channel;
}

export async function markConversationAsRead(
    userId: string, 
    senderId: string, 
    userRole: string
): Promise<void> {
    let query = supabase.from("messages").update({ is_read: true }).eq("is_read", false);

    if (userRole === "admin") {
        // Admin reading a thread from senderId
        query = query.is("recipient_id", null).eq("sender_id", senderId);
    } else {
        // User reading a thread from senderId (which might be 'system-admin')
        if (senderId === "system-admin") {
            query = query.eq("recipient_id", userId).eq("sender_role", "admin");
        } else {
            query = query.eq("recipient_id", userId).eq("sender_id", senderId);
        }
    }

    const { error } = await query;
    if (error) {
        console.error("Error marking messages as read:", error);
    }
}
