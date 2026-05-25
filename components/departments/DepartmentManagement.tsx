"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupervisors, addSupervisor, updateSupervisor, deleteSupervisor } from "@/lib/api/supervisors";
import { getSupervisorStats, getTeacherStats, getTeachersBySupervisor } from "@/lib/api/classes";
import { Supervisor } from "@/types/supervisor";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Plus, Search, Loader2, ShieldCheck,
    Mail, Phone, Save, Edit2, Trash2,
    ChevronLeft, ChevronRight, Clock,
    Megaphone, Cpu, Banknote, UserCheck,
    Users, MessageSquare, GraduationCap
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { FormInput } from "@/components/ui/form-input";
import { STALE_LONG } from "@/lib/query-config";

interface DepartmentManagementProps {
    department: "Supervisor" | "Marketing" | "Tech Team" | "Finance" | "Teacher";
}

const placeholderAvatars = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBrIoAtvN3GQ85WgwsNfmcAvVWfZeJ-0Cxl-cvMOMN-az-Y2gka_3fEN7urgkJJoikssLjc5X8KiCOvmHU3mJPO1OF8Ngz65fydDrfIPVJxdlIhNC5zNBezXg8zks3XwSj_rha0aapFzEGOpy407AvLuK4Z5cQc1XIrlePf5DnNv4_h3MiyxEqJFM1yrlwqJGIbBirs8iK6vPzYIwZOCQAUpX8f1K0Z3SVu2_6t_ZDBpQ4Sxw8RMJK2OFGw4-QeFxBt7puFN_adCZU",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD00CNm0XRMT0c4CACeo15HD-cw-uuGEvZbq4lEvodzpLvgLTIPvv-eHO9zif0W46MUXXGqlPuHwVEmInOZVInYiXSXRQkiJJKviAMET1k_7Fcbw8su1g9r5KR5YwulcVg0gLsrCVu3UvCVQzAcqIm-BVGznnx0mC5l_OrijlJjhEhSgA_kSytc37KQ2YNlRiH0qnnbj534VTtOjeqd3pe7xLfpY7aygDIPSnfHyURCOzWbsG1j5pBj2F1GJOV97TBqq3McTQgYwLM",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBBJEyg9pTzhSqwwcG5zYK9KVJlcA7BvTgw0RRIDvw23JSnkFbImpiE8WzlAUoUnw-q0TnJgxYhsTPDEY_N7SM7P9GrrjeLWrB4PLiEV_KHcRbjHaBpnvkPtxntFdAKG23dcXQLEkTtc368SZ3AQBs_7uwK1xmDogz30quj7H2PZsJ3i6_t9Ix3C4tsFZNovhqiEYtPYfrMlsZiLy36zNGyeSi3gDRYfcfJKRG_Cuz5WWIqkKCvea2spbaXVmPnVOV1O1ulSqU8dUc",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAsSg2mUp2pu6c24pAavh5IMTHx17Qe5Nm2bUtpp4G44OWWjXJGZO1RSHcnsyo1nEidswX7Q8XFrMYBYKnKqv3TTZIAqwewb3SWfhmyw__NxRTZ3XxQQMAd78aPmkbhDjnQzgKFNopYCP_LTvIpAcIo7CDBjR5Y0OkLiZraIlK60cz_SwGZRgzi1YLC_vXlB_3Gr-oRSo8sHDlHFtJMtYbn-sizWEQalQ6rlUOuqwJWkMnco7zXVOguFcmBiKNtymkH98qW3ruOnAM",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAr3sVQGyBmtXQWu9LgpamkFCN3WmUNBgG_36ZGla_F0NktW_DwIk1xgoqDf1gOm8ok7T5_w5f__aoYRM5Pm-er0g_o1_hrF3BEpym8aNps8bkagFkcEOBG9rlZVextwTTToedLL_mVn5G8we3S0BPrRpYOuIm9ZWJXSSjYb6nlqbwGWGnFCMlsZRSc41ZUmOU0CXigxR2KRuXuvcywlAZCd433I6FDqrpTZZU2sstLc_KA9uXm5qIACUPWdSoArDjB134u3HiKVn0",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBWSDAba86vGuxkf3y5Z-l3uU1rJLxWpf397WPYilLyuVyLSexFhxDQzkqcIBuYqITpE3vNoCsa_T4n2iYCh-BVdUN9nDAjKCrhBfQTPMz2lTyQavNSsI9VUW-CRraaEW1nHgBEXQf7P1JT0-gq0vk6xCgMBwS_RQrz9J5ikZIVBMVO7i1wBV18jsRTl4wAo0AmF1vvSL97ua4Pp4jS07wljkyBPWO5WjvUmqxYNti_UTy8wESI4h4q0Vd4-Ug5rI4M-6W_OBVAjdg"
];

const departmentColors = {
    "Supervisor": "text-primary bg-primary/10",
    "Marketing": "text-blue-500 bg-blue-500/10",
    "Tech Team": "text-emerald-500 bg-emerald-500/10",
    "Finance": "text-amber-500 bg-amber-500/10",
    "Teacher": "text-forest bg-forest/10"
};

const departmentIcons = {
    "Supervisor": ShieldCheck,
    "Marketing": Megaphone,
    "Tech Team": Cpu,
    "Finance": Banknote,
    "Teacher": GraduationCap
};

export function DepartmentManagement({ department }: DepartmentManagementProps) {
    const [search, setSearch] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Supervisor | null>(null);
    const queryClient = useQueryClient();

    const [role, setRole] = useState("admin");
    const [supervisorId, setSupervisorId] = useState("");

    useEffect(() => {
        const getCookie = (name: string) => {
            if (typeof document === "undefined") return undefined;
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
            return undefined;
        };
        setRole(getCookie("auth_role") || "admin");
        setSupervisorId(getCookie("supervisor_id") || "");
    }, []);

    const isSupervisor = role === "supervisor";

    const Icon = departmentIcons[department];
    const colorClass = departmentColors[department];

    const deleteMutation = useMutation({
        mutationFn: deleteSupervisor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["staff", department] });
            if (department === "Teacher") {
                queryClient.invalidateQueries({ queryKey: ["teachers"] });
                queryClient.invalidateQueries({ queryKey: ["allClasses"] });
            }
            toast.success(`${department} member deleted`);
        },
        onError: () => {
            toast.error("Failed to delete member");
        },
    });

    const handleDelete = (id: string, name: string) => {
        if (window.confirm(`Are you sure you want to remove ${name} from ${department}?`)) {
            deleteMutation.mutate(id);
        }
    };

    const handleEditClick = (employee: Supervisor) => {
        setSelectedEmployee(employee);
        setIsEditDialogOpen(true);
    };

    const { data: staff = [], isLoading } = useQuery({
        queryKey: ["staff", department, role, supervisorId],
        queryFn: async () => {
            if (department === "Teacher" && role === "supervisor" && supervisorId) {
                const teachers = await getTeachersBySupervisor(supervisorId);
                return teachers.map(t => ({
                    id: t.id,
                    name: t.name,
                    email: t.email,
                    phone: t.phone,
                    timing: t.timing,
                    password: t.password,
                    department: "Teacher"
                }));
            }
            return await getSupervisors(department);
        },
        ...STALE_LONG,
    });

    const { data: supervisorStats = {} } = useQuery({
        queryKey: ["supervisorStats"],
        queryFn: getSupervisorStats,
        enabled: department === "Supervisor",
        ...STALE_LONG,
    });

    const { data: teacherStats = {} } = useQuery({
        queryKey: ["teacherStats"],
        queryFn: getTeacherStats,
        enabled: department === "Teacher",
        ...STALE_LONG,
    });

    const filteredStaff = staff.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="flex flex-col gap-6 w-full animate-entrance">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-foreground leading-none">
                        {department} Leads
                        <span className="text-primary ml-2 text-xl">✦</span>
                    </h2>
                    <p className="text-muted-foreground mt-1.5 text-sm">
                        {department === "Teacher" 
                            ? "Manage faculty roster, monitor assigned students, and track teaching progress."
                            : `Manage ${department.toLowerCase()} personnel and dashboard access.`}
                    </p>
                </div>
                {!isSupervisor && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsAddDialogOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-forest hover:bg-forest/90 text-white font-black rounded-full text-sm shadow-xl transition-all shrink-0"
                        >
                            <Plus className="h-4 w-4" />
                            Add Member
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="card-hover relative glass-panel rounded-3xl p-5 border border-white/20 dark:border-white/5 overflow-hidden group flex flex-col gap-3 shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
                    <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/10">
                        <UserCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div className="relative">
                        <p className="text-3xl font-black tracking-tight text-primary">{isLoading ? "-" : staff.length}</p>
                        <p className="text-[11px] font-bold text-foreground mt-1.5 uppercase tracking-wider">Total {department}</p>
                    </div>
                </div>
            </div>

            <div className="relative w-full sm:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
                <input
                    className="pill-input w-full pl-10 pr-5 py-2.5 glass-panel border border-white/20 dark:border-white/5 text-sm text-foreground placeholder:text-muted-foreground/50"
                    placeholder={`Search in ${department}...`}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {filteredStaff.length === 0 ? (
                <div className="text-center p-12 bg-card/50 backdrop-blur-md rounded-3xl border border-white/10">
                    <Icon className="h-12 w-12 mx-auto text-muted-foreground opacity-40 mb-3" />
                    <p className="font-bold text-foreground">No leads found in {department}</p>
                    <p className="text-sm text-muted-foreground mt-1">Add your first member to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredStaff.map((employee, index) => {
                        const avatar = placeholderAvatars[index % placeholderAvatars.length];
                        const stats = department === "Supervisor" ? supervisorStats[employee.id] ?? { teachers: 0, students: 0 } : 
                                     department === "Teacher" ? teacherStats[employee.id] ?? { students: 0 } : null;

                        const isTeacherDept = department === "Teacher";
                        const isSupervisorDept = department === "Supervisor";

                        return (
                            <div key={employee.id} className="card-hover glass-panel rounded-3xl border border-white/20 dark:border-white/5 overflow-hidden flex flex-col shadow-[0px_0px_48px_rgba(45,52,50,0.06)]">
                                <div className="p-6 pb-4 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <img
                                            className="size-16 rounded-2xl object-cover ring-4 ring-primary/5"
                                            alt={employee.name}
                                            src={avatar}
                                        />
                                        {!isSupervisor && (
                                            <button
                                                onClick={() => handleDelete(employee.id, employee.name)}
                                                className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-xl hover:bg-red-500/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-foreground mb-1">{employee.name}</h4>
                                        <div className="flex flex-col gap-1.5 mt-3">
                                            {employee.timing && (
                                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span className="font-bold text-foreground/80">{employee.timing}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                                <Mail className="h-3.5 w-3.5" />
                                                <span className="truncate">{employee.email || "No email"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                                <Phone className="h-3.5 w-3.5" />
                                                <span>{employee.phone || "No phone"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {isSupervisorDept && stats && 'teachers' in stats && (
                                    <div className="px-6 py-4 bg-primary/[0.03] border-t border-white/5 grid grid-cols-2 gap-4">
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-primary">{(stats as { teachers: number; students: number }).teachers}</p>
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Teachers</p>
                                        </div>
                                        <div className="text-center border-l border-white/10 pl-4">
                                            <p className="text-2xl font-black text-primary">{stats.students}</p>
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Students</p>
                                        </div>
                                    </div>
                                )}

                                {isTeacherDept && stats && (
                                    <div className="px-6 py-4 bg-forest/[0.03] border-t border-white/5 flex items-center justify-center">
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-forest">{stats.students}</p>
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Active Students</p>
                                        </div>
                                    </div>
                                )}

                                <div className="p-4 flex flex-col gap-3 relative z-20">
                                    {isSupervisorDept && (
                                        <Link 
                                            href={`/supervisors/${employee.id}`} 
                                            onClick={(e) => e.stopPropagation()}
                                            className="py-2.5 flex items-center justify-center gap-2 rounded-full text-sm font-black bg-forest text-white shadow-lg shadow-forest/20 hover:bg-forest/90 transition-all w-full"
                                        >
                                            <Users className="h-4 w-4" />
                                            Teachers
                                        </Link>
                                    )}
                                    {isTeacherDept && (
                                        <Link 
                                            href={`/teachers/${employee.id}`} 
                                            onClick={(e) => e.stopPropagation()}
                                            className="py-2.5 flex items-center justify-center gap-2 rounded-full text-sm font-black bg-forest text-white shadow-lg shadow-forest/20 hover:bg-forest/90 transition-all w-full"
                                        >
                                            <Users className="h-4 w-4" />
                                            Students
                                        </Link>
                                    )}
                                    {!isSupervisor && (
                                        <div className="w-full">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleEditClick(employee as any);
                                                }}
                                                className="w-full py-2.5 rounded-full text-sm font-bold border border-white/10 text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                                Edit
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <AddEmployeeDialog department={department} open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
            <EditEmployeeDialog
                department={department}
                employee={selectedEmployee}
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
            />
        </div>
    );
}

function AddEmployeeDialog({ department, open, onOpenChange }: { department: string; open: boolean; onOpenChange: (open: boolean) => void }) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({ name: "", email: "", phone: "", timing: "", password: "" });

    const addMutation = useMutation({
        mutationFn: (data: any) => addSupervisor({ ...data, department }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["staff", department] });
            if (department === "Teacher") {
                queryClient.invalidateQueries({ queryKey: ["teachers"] });
            }
            onOpenChange(false);
            setFormData({ name: "", email: "", phone: "", timing: "", password: "" });
            toast.success(`${department} member added`);
        },
        onError: () => toast.error("Failed to add member")
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addMutation.mutate({ 
            name: formData.name, 
            email: formData.email || null, 
            phone: formData.phone || null, 
            timing: formData.timing || null,
            password: formData.password || null 
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-[480px] rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-xl font-black">Add {department} Member</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <FormInput label="Name *" name="name" value={formData.name} onChange={handleChange} required />
                    <div className="grid grid-cols-2 gap-3">
                        <FormInput label="Email" name="email" type="email" value={formData.email} onChange={handleChange} />
                        <FormInput label="Phone" name="phone" value={formData.phone} onChange={handleChange} />
                    </div>
                    <FormInput label="Password" name="password" value={formData.password} onChange={handleChange} type="text" placeholder="Access code..." />
                    <div className="flex justify-end pt-2">
                        <button type="submit" disabled={addMutation.isPending} className="px-7 py-3 bg-primary text-white font-black rounded-full text-sm hover:opacity-90 transition-all">
                            Save Member
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditEmployeeDialog({ department, employee, open, onOpenChange }: { department: string; employee: Supervisor | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({ name: "", email: "", phone: "", timing: "", password: "" });

    useEffect(() => {
        if (employee && open) {
            setFormData({
                name: employee.name || "",
                email: employee.email || "",
                phone: employee.phone || "",
                timing: employee.timing || "",
                password: employee.password || "",
            });
        }
    }, [employee, open]);

    const updateMutation = useMutation({
        mutationFn: () => updateSupervisor(employee!.id, { ...formData, department }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["staff", department] });
            if (department === "Teacher") {
                queryClient.invalidateQueries({ queryKey: ["teachers"] });
            }
            onOpenChange(false);
            toast.success("Updated successfully");
        },
        onError: () => toast.error("Failed to update")
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-[480px] rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-xl font-black">Edit {department} Details</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4 pt-2">
                    <FormInput label="Name *" name="name" value={formData.name} onChange={(e) => setFormData(p => ({...p, name: e.target.value}))} required />
                    <div className="grid grid-cols-2 gap-3">
                        <FormInput label="Email" name="email" value={formData.email} onChange={(e) => setFormData(p => ({...p, email: e.target.value}))} />
                        <FormInput label="Phone" name="phone" value={formData.phone} onChange={(e) => setFormData(p => ({...p, phone: e.target.value}))} />
                    </div>
                    <FormInput label="Password" name="password" value={formData.password} onChange={(e) => setFormData(p => ({...p, password: e.target.value}))} />
                    <div className="flex justify-end pt-2">
                        <button type="submit" disabled={updateMutation.isPending} className="px-7 py-3 bg-primary text-white font-black rounded-full text-sm">
                            Save Changes
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
