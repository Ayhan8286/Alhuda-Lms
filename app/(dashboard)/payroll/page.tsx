"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingShimmer } from "@/components/ui/LoadingShimmer";
import {
    Search,
    Plus,
    Clock,
    CheckCircle2,
    ArrowUpDown,
    Filter,
    X,
    Check,
    Coins,
    TrendingUp,
    BadgeAlert,
    Printer,
    DollarSign,
    User,
    Calendar,
    ArrowRightLeft,
    Banknote,
    FileText,
    Percent,
    Sparkles,
    CheckCircle,
    UserCheck,
    History,
    CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PayrollRecord {
    id: string;
    staff_id: string;
    staff_name: string;
    staff_email: string | null;
    role: "Supervisor" | "Teacher";
    department: string;
    month: string;
    base_salary: number;
    bonus: number;
    deductions: number;
    net_payable: number;
    status: "Pending" | "Paid";
    payment_date: string | null;
    payment_method: "Bank Transfer" | "Cash" | "Cheque" | null;
    remarks: string | null;
}

export default function PayrollPage() {
    const queryClient = useQueryClient();
    
    // Default to current month (YYYY-MM)
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [searchQuery, setSearchQuery] = useState("");
    const [filterRole, setFilterRole] = useState<"all" | "Supervisor" | "Teacher" | "Tech" | "Marketing" | "Finance">("all");
    const [filterStatus, setFilterStatus] = useState<"all" | "Pending" | "Paid">("all");
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

    // Drawer and Modal States
    const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isPayslipOpen, setIsPayslipOpen] = useState(false);

    // Edit Form Local State
    const [formBaseSalary, setFormBaseSalary] = useState(0);
    const [formBonus, setFormBonus] = useState(0);
    const [formDeductions, setFormDeductions] = useState(0);
    const [formStatus, setFormStatus] = useState<"Pending" | "Paid">("Pending");
    const [formPaymentMethod, setFormPaymentMethod] = useState<"Bank Transfer" | "Cash" | "Cheque">("Bank Transfer");
    const [formRemarks, setFormRemarks] = useState("");

    // Fetch payroll records for selected month
    const { data, isLoading } = useQuery({
        queryKey: ["payroll", selectedMonth],
        queryFn: async () => {
            const res = await fetch(`/api/payroll?month=${selectedMonth}`);
            if (!res.ok) throw new Error("Failed to load payroll");
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Failed to load payroll");
            return json.records as PayrollRecord[];
        }
    });

        // Fetch individual staff payment history
    const { data: staffHistory = [], isLoading: isHistoryLoading } = useQuery({
        queryKey: ["payrollHistory", selectedRecord?.staff_id],
        queryFn: async () => {
            if (!selectedRecord?.staff_id) return [];
            const res = await fetch(`/api/payroll?staffId=${selectedRecord.staff_id}`);
            if (!res.ok) throw new Error("Failed to load history");
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Failed to load history");
            return json.history as PayrollRecord[];
        },
        enabled: !!selectedRecord?.staff_id && isEditOpen
    });

    const payrollRecords = data || [];

    // Mutation: Save individual payroll record slip adjustments
    const saveRecordMutation = useMutation({
        mutationFn: async (record: PayrollRecord) => {
            const res = await fetch("/api/payroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "save_record", record })
            });
            if (!res.ok) throw new Error("Failed to save payroll record");
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Failed to save payroll");
            return json.record;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payroll", selectedMonth] });
            setIsEditOpen(false);
        },
        onError: (err: any) => {
            alert("Failed to save payroll adjustments: " + err.message);
        }
    });

    // Mutation: Save default base salary configuration
    const saveConfigMutation = useMutation({
        mutationFn: async ({ staff_id, base_salary }: { staff_id: string; base_salary: number }) => {
            const res = await fetch("/api/payroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "save_config", staff_id, base_salary, month: selectedMonth })
            });
            if (!res.ok) throw new Error("Failed to save base salary config");
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Failed to save base config");
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payroll", selectedMonth] });
        },
        onError: (err: any) => {
            alert("Failed to save base salary: " + err.message);
        }
    });

    // Mutation: Batch mark all as paid
    const markAllPaidMutation = useMutation({
        mutationFn: async (recordsToPay: PayrollRecord[]) => {
            const res = await fetch("/api/payroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "mark_all_paid", month: selectedMonth, records: recordsToPay })
            });
            if (!res.ok) throw new Error("Failed to batch pay staff");
            const json = await res.json();
            if (!json.success) throw new Error(json.error || "Failed to batch pay");
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payroll", selectedMonth] });
            alert("Success! All filtered staff payrolls marked as 'Paid' via Bank Transfer.");
        },
        onError: (err: any) => {
            alert("Failed to batch process salaries: " + err.message);
        }
    });

    // Handles triggering the Edit Drawer/Modal
    const handleEditClick = (record: PayrollRecord) => {
        setSelectedRecord(record);
        setFormBaseSalary(record.base_salary);
        setFormBonus(record.bonus);
        setFormDeductions(record.deductions);
        setFormStatus(record.status);
        setFormPaymentMethod(record.payment_method || "Bank Transfer");
        setFormRemarks(record.remarks || "");
        setIsEditOpen(true);
    };

    // Submits the edit slip form
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecord) return;

        // 1. Trigger config save if base salary was adjusted
        if (formBaseSalary !== selectedRecord.base_salary) {
            saveConfigMutation.mutate({ staff_id: selectedRecord.staff_id, base_salary: formBaseSalary });
        }

        // 2. Trigger slip update
        const updatedRecord: PayrollRecord = {
            ...selectedRecord,
            base_salary: formBaseSalary,
            bonus: formBonus,
            deductions: formDeductions,
            status: formStatus,
            payment_method: formStatus === "Paid" ? formPaymentMethod : null,
            remarks: formRemarks || null,
            net_payable: formBaseSalary + formBonus - formDeductions
        };

        saveRecordMutation.mutate(updatedRecord);
    };

    // Handles payslip drawer trigger
    const handlePayslipClick = (record: PayrollRecord) => {
        setSelectedRecord(record);
        setIsPayslipOpen(true);
    };

    // Quick toggle individual pay status
    const handleQuickPayToggle = (record: PayrollRecord) => {
        const nextStatus = record.status === "Paid" ? "Pending" : "Paid";
        const updatedRecord: PayrollRecord = {
            ...record,
            status: nextStatus,
            payment_method: nextStatus === "Paid" ? "Bank Transfer" : null,
            payment_date: nextStatus === "Paid" ? new Date().toISOString() : null,
            remarks: nextStatus === "Paid" ? "Salary processed by admin" : null
        };
        saveRecordMutation.mutate(updatedRecord);
    };

    // Filter & Sort Logic
    const filteredRecords = payrollRecords
        .filter(r => {
            const matchesSearch = r.staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (r.staff_email && r.staff_email.toLowerCase().includes(searchQuery.toLowerCase())) ||
                r.department.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = filterRole === "all" ? true : (
                filterRole === "Teacher" 
                    ? r.role === "Teacher"
                    : (filterRole === "Supervisor"
                        ? (r.role === "Supervisor" && (r.department?.toLowerCase() === "supervisor" || !r.department))
                        : (r.department?.toLowerCase() === filterRole.toLowerCase() || r.department?.toLowerCase()?.startsWith(filterRole.toLowerCase()))));
            const matchesStatus = filterStatus === "all" ? true : r.status === filterStatus;
            return matchesSearch && matchesRole && matchesStatus;
        })
        .sort((a, b) => {
            const netA = a.net_payable;
            const netB = b.net_payable;
            return sortOrder === "desc" ? netB - netA : netA - netB;
        });

    // Calculations for Stats Bar
    const totalPayrollExpenses = filteredRecords.reduce((sum, r) => sum + r.net_payable, 0);
    const totalSettled = filteredRecords.filter(r => r.status === "Paid").reduce((sum, r) => sum + r.net_payable, 0);
    const totalOutstanding = filteredRecords.filter(r => r.status === "Pending").reduce((sum, r) => sum + r.net_payable, 0);
    const activeStaffCount = filteredRecords.length;

    // List of months for selector (last 6 months and next 3 months)
    const monthOptions = Array.from({ length: 10 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - 6 + i);
        return d.toISOString().slice(0, 7);
    });

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency: "PKR",
            maximumFractionDigits: 0
        }).format(val);
    };

    return (
        <div className="flex-1 overflow-y-auto flex flex-col relative w-full mx-auto">
            {/* Organic Background Elements */}
            <div className="organic-blob bg-primary-container/20 w-[600px] h-[600px] -top-48 -left-24 fixed"></div>
            <div className="organic-blob bg-tertiary-container/20 w-[500px] h-[500px] bottom-0 right-0 fixed"></div>

            <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-emerald-900/5 pb-6">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground mb-1">Financial Management</p>
                        <h1 className="text-3xl font-black tracking-tight text-foreground leading-none">
                            Staff Salaries & Payroll
                            <span className="text-primary ml-2 text-2xl">✦</span>
                        </h1>
                        <p className="text-muted-foreground mt-1.5 text-sm">Manage default base salary configurations and monthly payroll disbursements for Supervisors and Teachers.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="pill-input pl-10 pr-6 py-2.5 glass-panel border border-white/20 dark:border-white/5 text-xs font-black uppercase tracking-wider text-foreground w-44 focus:ring-primary shadow-sm outline-none cursor-pointer"
                            >
                                {monthOptions.map(m => (
                                    <option key={m} value={m} className="text-foreground dark:bg-emerald-950 font-semibold">{m}</option>
                                ))}
                            </select>
                        </div>
                        {filteredRecords.some(r => r.status === "Pending") && (
                            <button
                                onClick={() => {
                                    const pending = filteredRecords.filter(r => r.status === "Pending");
                                    if (confirm(`Are you sure you want to mark ALL ${pending.length} pending staff salaries as PAID for ${selectedMonth}?`)) {
                                        markAllPaidMutation.mutate(pending);
                                    }
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-forest hover:bg-forest/90 text-white font-black rounded-full text-xs uppercase tracking-wider fab-glow transition-all shrink-0 active:scale-95"
                            >
                                <CheckCircle className="h-4 w-4" />
                                Batch Pay
                            </button>
                        )}
                    </div>
                </div>

                {/* Metrics Stats */}
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">Salary Budget Overview ({selectedMonth})</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                    {[
                        { label: "Payroll Expenses", value: formatCurrency(totalPayrollExpenses), sub: "Total monthly allocation", accent: "#3b82f6", Icon: Banknote, tag: "Budget" },
                        { label: "Cleared Payments", value: formatCurrency(totalSettled), sub: "Salary disbursements paid", accent: "#10b981", Icon: Coins, tag: "Paid" },
                        { label: "Outstanding Pending", value: formatCurrency(totalOutstanding), sub: "Remaining unpaid balance", accent: "#f59e0b", Icon: Clock, tag: "Unpaid" },
                        { label: "Enrolled Employees", value: activeStaffCount, sub: "Teachers & Supervisors", accent: "#8b5cf6", Icon: User, tag: "Staff" },
                    ].map(({ label, value, sub, accent, Icon, tag }, i) => (
                        <div key={i} className="card-hover relative glass-panel rounded-3xl p-5 border border-white/20 dark:border-white/5 shadow-[0px_0px_48px_rgba(45,52,50,0.03)] overflow-hidden group flex flex-col gap-3">
                            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity" style={{ background: accent }} />
                            <div className="flex items-start justify-between">
                                <div className="relative w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: `${accent}14` }}>
                                    <Icon className="h-4 w-4" style={{ color: accent }} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border" style={{ color: accent, background: `${accent}0c`, borderColor: `${accent}25` }}>{tag}</span>
                            </div>
                            <div className="relative">
                                <p className="text-2xl font-black tracking-tight" style={{ color: accent }}>{value}</p>
                                <p className="text-[10px] font-bold text-foreground mt-1 uppercase tracking-wider">{label}</p>
                                <p className="text-[9px] text-muted-foreground">{sub}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filter and Control Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/20 dark:bg-black/10 p-4 rounded-3xl border border-white/10 dark:border-white/5 shadow-sm">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search staff name, email, department..."
                            className="pill-input pl-10 pr-5 py-2 glass-panel border border-white/10 dark:border-white/5 text-xs text-foreground w-full placeholder:text-muted-foreground/50 font-medium"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Role Filter */}
                        <div className="flex flex-wrap items-center bg-accent/40 rounded-3xl p-1 border border-border/50 gap-1">
                            {[
                                { key: "all", label: "All Staff" },
                                { key: "Supervisor", label: "Supervisors" },
                                { key: "Teacher", label: "Teachers" },
                                { key: "Tech", label: "Tech Team" },
                                { key: "Marketing", label: "Marketing Team" },
                                { key: "Finance", label: "Finance Team" }
                            ].map(btn => (
                                <button
                                    key={btn.key}
                                    type="button"
                                    onClick={() => setFilterRole(btn.key as any)}
                                    className={cn("px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-black transition-all", filterRole === btn.key ? "bg-white dark:bg-primary/20 text-emerald-950 dark:text-white shadow" : "text-muted-foreground hover:text-foreground")}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center bg-accent/40 rounded-full p-1 border border-border/50">
                            {[
                                { key: "all", label: "All Status" },
                                { key: "Paid", label: "Paid" },
                                { key: "Pending", label: "Pending" }
                            ].map(btn => (
                                <button
                                    key={btn.key}
                                    onClick={() => setFilterStatus(btn.key as any)}
                                    className={cn("px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-black transition-all", filterStatus === btn.key ? "bg-white dark:bg-primary/20 text-emerald-950 dark:text-white shadow" : "text-muted-foreground hover:text-foreground")}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                            className="glass-panel px-4 py-2 border border-white/10 dark:border-white/5 rounded-full text-[10px] uppercase tracking-widest font-black text-muted-foreground flex items-center gap-2 hover:bg-accent hover:text-foreground transition-all active:scale-95 shadow-sm"
                        >
                            <ArrowUpDown className="h-3 w-3" />
                            Sort Net: {sortOrder === "desc" ? "Highest" : "Lowest"}
                        </button>
                    </div>
                </div>

                {/* Staff Ledger List */}
                {isLoading ? (
                    <div className="p-4"><LoadingShimmer rows={6} rowHeight="h-16" /></div>
                ) : filteredRecords.length === 0 ? (
                    <div className="py-20 text-center bg-white/20 dark:bg-black/10 rounded-[2rem] border border-dashed border-emerald-950/10 dark:border-white/10 p-6 animate-in fade-in">
                        <Banknote className="h-12 w-12 text-emerald-800/30 dark:text-emerald-200/30 mx-auto mb-3" />
                        <p className="text-sm font-extrabold text-emerald-950 dark:text-white">No Payroll Staff Matches</p>
                        <p className="text-xs text-emerald-800/50 dark:text-emerald-200/50 mt-1">Try resetting the filters or modifying your active search query.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRecords.map((record) => {
                            const unpaid = record.status === "Pending";
                            return (
                                <div
                                    key={record.staff_id}
                                    className={cn(
                                        "glass-panel border-white/20 dark:border-white/5 rounded-[2.5rem] p-6 shadow-sm flex flex-col justify-between gap-5 relative text-left card-hover transition-all animate-in fade-in duration-300",
                                        unpaid ? "hover:border-amber-500/20" : "hover:border-emerald-500/20"
                                    )}
                                >
                                    {/* Top Metadata Row */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start gap-2">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-wider border",
                                                record.role === "Supervisor" 
                                                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" 
                                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                            )}>
                                                {record.role} · {record.department}
                                            </span>
                                            <span className={cn(
                                                "px-2.5 py-0.5 rounded border font-extrabold text-[9px] uppercase tracking-wider",
                                                unpaid 
                                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" 
                                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                            )}>
                                                {record.status}
                                            </span>
                                        </div>

                                        {/* Avatar & Personal Info */}
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-sm font-black text-primary border border-primary/20 shrink-0">
                                                {record.staff_name.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-extrabold text-foreground truncate">{record.staff_name}</p>
                                                <p className="text-[10px] text-muted-foreground font-mono truncate">{record.staff_email || "No Email Provided"}</p>
                                            </div>
                                        </div>

                                        {/* Salary Breakdown Summary */}
                                        <div className="grid grid-cols-3 gap-2 bg-emerald-950/[0.02] dark:bg-white/[0.01] p-3 rounded-2xl border border-emerald-950/5 dark:border-white/5 text-[10px] font-semibold text-muted-foreground">
                                            <div>
                                                <span className="opacity-60 block mb-0.5 uppercase tracking-wider text-[8px]">Base</span>
                                                <span className="text-foreground font-bold">{formatCurrency(record.base_salary)}</span>
                                            </div>
                                            <div>
                                                <span className="opacity-60 block mb-0.5 uppercase tracking-wider text-[8px]">Bonus</span>
                                                <span className="text-green-500 font-bold">+{formatCurrency(record.bonus)}</span>
                                            </div>
                                            <div>
                                                <span className="opacity-60 block mb-0.5 uppercase tracking-wider text-[8px]">Deduct</span>
                                                <span className="text-red-500 font-bold">-{formatCurrency(record.deductions)}</span>
                                            </div>
                                        </div>

                                        {/* Net Payable Large Display */}
                                        <div className="flex justify-between items-end pt-2 border-t border-border/30">
                                            <div>
                                                <p className="text-[9px] uppercase tracking-[0.12em] font-extrabold text-muted-foreground">Net Monthly Payable</p>
                                                <p className="text-lg font-black text-foreground mt-0.5">{formatCurrency(record.net_payable)}</p>
                                            </div>
                                            {record.payment_method && (
                                                <div className="text-right text-[10px] text-muted-foreground font-medium flex items-center gap-1 bg-white/40 dark:bg-black/10 px-2.5 py-1 rounded-xl border border-border/50">
                                                    <CreditCard className="h-3.5 w-3.5 text-primary" />
                                                    {record.payment_method}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-2 border-t border-border/40 shrink-0">
                                        <button
                                            onClick={() => handlePayslipClick(record)}
                                            className="p-2.5 rounded-xl border border-border hover:bg-accent text-muted-foreground hover:text-foreground font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0"
                                            title="Print Payslip"
                                        >
                                            <Printer className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleEditClick(record)}
                                            className="flex-1 py-2 px-3 rounded-xl border border-border hover:bg-accent text-foreground/80 hover:text-foreground font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shrink-0 active:scale-95"
                                        >
                                            Adjust / Setup
                                        </button>
                                        <button
                                            onClick={() => handleQuickPayToggle(record)}
                                            disabled={saveRecordMutation.isPending}
                                            className={cn(
                                                "flex-1 py-2 px-3 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shrink-0 shadow-sm active:scale-95 disabled:opacity-50",
                                                unpaid 
                                                    ? "bg-forest hover:bg-forest/90 text-white" 
                                                    : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                            )}
                                        >
                                            {unpaid ? (
                                                <>
                                                    <Check className="h-3.5 w-3.5" />
                                                    Release
                                                </>
                                            ) : (
                                                <>
                                                    <X className="h-3.5 w-3.5" />
                                                    Revert Slip
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 1. EDIT DISBURSEMENT DRAWER */}
                {isEditOpen && selectedRecord && (
                    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div
                            className="absolute inset-0"
                            onClick={() => setIsEditOpen(false)}
                        />
                        <div className="relative w-full max-w-md h-full bg-card border-l border-border shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300 custom-scrollbar">
                            <form onSubmit={handleFormSubmit} className="space-y-6 flex-1 flex flex-col justify-between">
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center border-b border-border pb-4">
                                        <div>
                                            <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                                                <Coins className="h-5 w-5 text-primary animate-pulse" />
                                                Payroll adjustments
                                            </h3>
                                            <p className="text-xs text-muted-foreground font-medium mt-0.5">Configure base salary and monthly additions/subtractions.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditOpen(false)}
                                            className="p-2 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    {/* Staff Detail Header */}
                                    <div className="bg-accent/25 rounded-2xl p-4 border border-border/50 flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-black text-primary border border-primary/20 shrink-0">
                                            {selectedRecord.staff_name.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-foreground truncate">{selectedRecord.staff_name}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono tracking-wide mt-0.5">{selectedRecord.role} · {selectedRecord.department}</p>
                                        </div>
                                    </div>

                                    {/* Numeric Fields */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 block">
                                                Default Base Salary (PKR)
                                                <span className="text-[9px] text-primary lowercase tracking-normal font-semibold block mt-0.5">Adjusting this saves as their permanent baseline.</span>
                                            </label>
                                            <input
                                                type="number"
                                                required
                                                value={formBaseSalary}
                                                onChange={(e) => setFormBaseSalary(Math.max(0, Number(e.target.value)))}
                                                className="pill-input w-full h-11 bg-accent/20 border-border rounded-xl px-4 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary shadow-inner outline-none transition-all"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 block">Bonus / Allowances</label>
                                                <input
                                                    type="number"
                                                    value={formBonus}
                                                    onChange={(e) => setFormBonus(Math.max(0, Number(e.target.value)))}
                                                    className="pill-input w-full h-11 bg-accent/20 border-border rounded-xl px-4 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary shadow-inner outline-none transition-all text-green-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 block">Deductions</label>
                                                <input
                                                    type="number"
                                                    value={formDeductions}
                                                    onChange={(e) => setFormDeductions(Math.max(0, Number(e.target.value)))}
                                                    className="pill-input w-full h-11 bg-accent/20 border-border rounded-xl px-4 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary shadow-inner outline-none transition-all text-red-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Disbursement Info */}
                                    <div className="space-y-4 pt-4 border-t border-border/40">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 block">Payment Status</label>
                                            <div className="flex bg-accent/40 p-1 rounded-xl border border-border/50 w-full">
                                                {["Pending", "Paid"].map((st) => (
                                                    <button
                                                        type="button"
                                                        key={st}
                                                        onClick={() => setFormStatus(st as any)}
                                                        className={cn(
                                                            "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all",
                                                            formStatus === st
                                                                ? st === "Paid" 
                                                                    ? "bg-forest text-white shadow" 
                                                                    : "bg-amber-500 text-white shadow"
                                                                : "text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        {st}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {formStatus === "Paid" && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 block">Payment Method</label>
                                                <select
                                                    value={formPaymentMethod}
                                                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                                                    className="pill-input w-full h-11 bg-accent/20 border-border rounded-xl px-4 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary shadow-inner outline-none transition-all cursor-pointer"
                                                >
                                                    <option value="Bank Transfer" className="text-foreground dark:bg-emerald-950 font-bold">Bank Transfer</option>
                                                    <option value="Cash" className="text-foreground dark:bg-emerald-950 font-bold">Cash</option>
                                                    <option value="Cheque" className="text-foreground dark:bg-emerald-950 font-bold">Cheque</option>
                                                </select>
                                            </div>
                                        )}

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 block">Memo / Payment Remarks</label>
                                            <textarea
                                                value={formRemarks}
                                                onChange={(e) => setFormRemarks(e.target.value)}
                                                placeholder="e.g. Bank processed transaction ID, special allowances reason..."
                                                rows={3}
                                                className="w-full bg-accent/20 border border-border rounded-xl p-3 text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary shadow-inner outline-none transition-all resize-none"
                                            />
                                        </div>

                                        {/* Monthly Disbursement History */}
                                        <div className="pt-4 border-t border-border/40 space-y-3">
                                            <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <History className="h-3.5 w-3.5 text-primary" />
                                                Disbursement History
                                            </h4>
                                            {isHistoryLoading ? (
                                                <div className="text-xs font-bold text-muted-foreground p-3 bg-accent/20 rounded-xl">Loading payment history...</div>
                                            ) : staffHistory.length === 0 ? (
                                                <div className="text-[10px] font-bold text-muted-foreground/60 italic p-3 bg-accent/10 rounded-xl border border-dashed border-border">No past disbursement history found.</div>
                                            ) : (
                                                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {staffHistory.map((hist: any) => (
                                                        <div key={hist.month} className="flex justify-between items-center bg-accent/10 p-2.5 rounded-xl border border-border/40 text-[10px]">
                                                            <div className="space-y-0.5">
                                                                <p className="font-extrabold text-foreground">{hist.month}</p>
                                                                <p className="text-[9px] text-muted-foreground font-semibold">{hist.payment_method || "Direct Release"}</p>
                                                            </div>
                                                            <div className="text-right space-y-0.5">
                                                                <p className="font-black text-foreground">{formatCurrency(hist.net_payable)}</p>
                                                                <span className={cn(
                                                                    "inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                                                    hist.status === "Paid" 
                                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                                )}>
                                                                    {hist.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Math Calc and Drawer Footer */}
                                <div className="space-y-4 pt-6 border-t border-border mt-6 bg-card shrink-0">
                                    <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex justify-between items-center shadow-inner">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-widest font-black text-primary">Revised Salary</p>
                                            <p className="text-xs text-muted-foreground font-semibold mt-0.5">Base + Bonus - Deduct</p>
                                        </div>
                                        <p className="text-xl font-black text-foreground">{formatCurrency(formBaseSalary + formBonus - formDeductions)}</p>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditOpen(false)}
                                            className="flex-1 py-3 rounded-full border border-border hover:bg-accent text-sm font-bold text-foreground transition-all active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saveRecordMutation.isPending}
                                            className="flex-1 py-3 bg-forest hover:bg-forest/90 text-white font-black rounded-full text-sm uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {saveRecordMutation.isPending ? "Saving..." : "Save Slip"}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* 2. PRINTABLE PAYSLIP MODAL */}
                {isPayslipOpen && selectedRecord && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div
                            className="absolute inset-0"
                            onClick={() => setIsPayslipOpen(false)}
                        />
                        <div className="relative w-full max-w-xl bg-card border border-border shadow-2xl rounded-3xl p-6 flex flex-col justify-between overflow-hidden animate-in zoom-in-95 duration-300">
                            
                            {/* Actions Header Bar */}
                            <div className="flex justify-between items-center border-b border-border pb-3 shrink-0 print:hidden mb-4">
                                <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    Employee Payslip Receipt
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => window.print()}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-forest hover:bg-forest/90 text-white font-black rounded-full text-xs uppercase tracking-wider transition-all shadow active:scale-95"
                                    >
                                        <Printer className="h-3.5 w-3.5" /> Print / Save PDF
                                    </button>
                                    <button
                                        onClick={() => setIsPayslipOpen(false)}
                                        className="p-2 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {/* The Real Printable Payslip Page Body */}
                            <div id="payslip-print-area" className="flex-1 space-y-6 text-left p-2 overflow-y-auto max-h-[60vh] custom-scrollbar border border-dashed border-border p-5 rounded-2xl bg-white/40 dark:bg-black/10">
                                
                                {/* Corporate Header */}
                                <div className="flex justify-between items-start border-b border-emerald-900/10 pb-4">
                                    <div>
                                        <h2 className="text-xl font-black text-emerald-950 dark:text-emerald-50 brand-font">AL HUDA LMS</h2>
                                        <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase mt-0.5">Al Huda Quranic Academy</p>
                                    </div>
                                    <div className="text-right">
                                        <h4 className="text-sm font-black text-foreground">SALARY DISBURSEMENT SLIP</h4>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">Month: {selectedRecord.month}</p>
                                    </div>
                                </div>

                                {/* Employee & Document Metadata Grid */}
                                <div className="grid grid-cols-2 gap-4 bg-accent/20 border border-border p-4 rounded-xl text-xs font-semibold text-muted-foreground">
                                    <div className="space-y-1.5">
                                        <p><span className="opacity-60 uppercase text-[9px] tracking-wider block">Employee Name</span> <strong className="text-foreground font-black text-sm">{selectedRecord.staff_name}</strong></p>
                                        <p><span className="opacity-60 uppercase text-[9px] tracking-wider block">Email Address</span> <span className="text-foreground font-bold">{selectedRecord.staff_email || "N/A"}</span></p>
                                    </div>
                                    <div className="space-y-1.5 text-right">
                                        <p><span className="opacity-60 uppercase text-[9px] tracking-wider block">Role / Designation</span> <strong className="text-foreground font-black text-sm">{selectedRecord.role}</strong></p>
                                        <p><span className="opacity-60 uppercase text-[9px] tracking-wider block">Active Department</span> <span className="text-foreground font-bold">{selectedRecord.department}</span></p>
                                    </div>
                                </div>

                                {/* Table Ledger Adjustments */}
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Salary Breakdown Calculations</h4>
                                    <div className="border border-border rounded-xl overflow-hidden bg-background">
                                        <table className="w-full text-left border-collapse text-xs font-semibold">
                                            <thead className="bg-accent/40 text-muted-foreground font-black uppercase text-[9px]">
                                                <tr>
                                                    <th className="px-4 py-2 border-b border-border">Description</th>
                                                    <th className="px-4 py-2 text-right border-b border-border">Amount (PKR)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                <tr>
                                                    <td className="px-4 py-2 text-foreground/80">Monthly Base Salary</td>
                                                    <td className="px-4 py-2 text-right text-foreground font-mono">{formatCurrency(selectedRecord.base_salary)}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2 text-green-500 font-bold">Special Allowances / Bonus</td>
                                                    <td className="px-4 py-2 text-right text-green-500 font-mono font-bold">+{formatCurrency(selectedRecord.bonus)}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2 text-red-500 font-bold">Adjustments / Deductions</td>
                                                    <td className="px-4 py-2 text-right text-red-500 font-mono font-bold">-{formatCurrency(selectedRecord.deductions)}</td>
                                                </tr>
                                                <tr className="bg-accent/10">
                                                    <td className="px-4 py-2.5 text-foreground font-extrabold uppercase text-[10px] tracking-wider">Net Amount Deposited</td>
                                                    <td className="px-4 py-2.5 text-right text-primary font-black text-[13px] font-mono">{formatCurrency(selectedRecord.net_payable)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Payment Settlement Metadata Info */}
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-emerald-900/10">
                                    <div className="space-y-1 text-xs">
                                        <p className="text-muted-foreground"><span className="opacity-60 uppercase text-[9px] block">Disbursement Status</span> <strong className={cn("font-bold text-[10px] uppercase", selectedRecord.status === "Paid" ? "text-emerald-500" : "text-amber-500")}>{selectedRecord.status}</strong></p>
                                        {selectedRecord.payment_method && (
                                            <p className="text-muted-foreground"><span className="opacity-60 uppercase text-[9px] block">Settled via Method</span> <span className="text-foreground font-bold">{selectedRecord.payment_method}</span></p>
                                        )}
                                    </div>
                                    <div className="space-y-1 text-xs text-right">
                                        {selectedRecord.payment_date && (
                                            <p className="text-muted-foreground"><span className="opacity-60 uppercase text-[9px] block">Payment Release Date</span> <span className="text-foreground font-bold">{new Date(selectedRecord.payment_date).toLocaleString()}</span></p>
                                        )}
                                        {selectedRecord.remarks && (
                                            <p className="text-muted-foreground"><span className="opacity-60 uppercase text-[9px] block">Memo Remarks</span> <span className="text-foreground font-bold italic">"{selectedRecord.remarks}"</span></p>
                                        )}
                                    </div>
                                </div>

                                {/* Printable Corporate Signatures Section */}
                                <div className="grid grid-cols-2 gap-12 pt-12 text-center text-[10px] font-black uppercase text-muted-foreground shrink-0 mt-8">
                                    <div>
                                        <div className="h-0.5 bg-muted-foreground/30 mx-auto w-36 mb-1.5" />
                                        <span>Employer Authority Signature</span>
                                    </div>
                                    <div>
                                        <div className="h-0.5 bg-muted-foreground/30 mx-auto w-36 mb-1.5" />
                                        <span>Employee Acknowledgment</span>
                                    </div>
                                </div>
                            </div>

                            {/* Print custom stylesheet to hide header/borders for a perfect invoice page layout */}
                            <style jsx global>{`
                                @media print {
                                    body * {
                                        visibility: hidden;
                                        background: transparent !important;
                                    }
                                    #payslip-print-area, #payslip-print-area * {
                                        visibility: visible;
                                    }
                                    #payslip-print-area {
                                        position: absolute;
                                        left: 0;
                                        top: 0;
                                        width: 100%;
                                        border: none !important;
                                        background: transparent !important;
                                        padding: 0 !important;
                                    }
                                    .custom-scrollbar {
                                        overflow: visible !important;
                                        max-h-none !important;
                                    }
                                }
                            `}</style>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
