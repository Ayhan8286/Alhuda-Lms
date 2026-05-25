import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import fs from "fs";
import path from "path";

// Define standard paths
const PAYROLL_FILE = path.join(process.cwd(), "data", "payroll.json");
const CONFIG_FILE = path.join(process.cwd(), "data", "salary_config.json");

// Helper function to read a JSON file safely
function readJSON(file: string, fallback: any) {
    try {
        if (!fs.existsSync(file)) {
            // Ensure parent directory exists
            const dir = path.dirname(file);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
            return fallback;
        }
        const raw = fs.readFileSync(file, "utf8");
        return JSON.parse(raw);
    } catch (e) {
        console.error(`Error reading ${file}:`, e);
        return fallback;
    }
}

// Helper to write JSON file safely
function writeJSON(file: string, data: any) {
    try {
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
        console.error(`Error writing ${file}:`, e);
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get("staffId");

        // 1. If staffId is provided, fetch their complete payment history from local JSON
        if (staffId) {
            const payroll = readJSON(PAYROLL_FILE, []);
            const history = payroll
                .filter((r: any) => r.staff_id === staffId)
                .sort((a: any, b: any) => b.month.localeCompare(a.month));
            return NextResponse.json({ success: true, history });
        }

        const month = searchParams.get("month") || new Date().toISOString().slice(0, 7); // Default to YYYY-MM

        // 2. Fetch supervisors & teachers from Supabase
        const { data: supervisorsRaw, error: supErr } = await supabase
            .from("supervisors")
            .select("id, name, email, department");
        if (supErr) throw supErr;
        const supervisors = supervisorsRaw || [];

        const { data: teachersRaw, error: teachErr } = await supabase
            .from("teachers")
            .select("id, staff_id, name, email, department");
        if (teachErr) throw teachErr;
        const teachers = teachersRaw || [];

        // 2. Read local data files
        const payroll = readJSON(PAYROLL_FILE, []);
        const baseConfigs = readJSON(CONFIG_FILE, {});

        // 3. Create map of existing payroll records for this month
        const payrollMap = new Map();
        payroll.forEach((record: any) => {
            if (record.month === month) {
                payrollMap.set(record.staff_id, record);
            }
        });

        // 4. Combine staff and construct final payroll list
        const records: any[] = [];

        // Add supervisors
        supervisors.forEach((sup: any) => {
            const existing = payrollMap.get(sup.id);
            if (existing) {
                records.push(existing);
            } else {
                const baseSalary = baseConfigs[sup.id] || 0;
                records.push({
                    id: `pay-${sup.id}-${month}`,
                    staff_id: sup.id,
                    staff_name: sup.name,
                    staff_email: sup.email,
                    role: "Supervisor",
                    department: sup.department || "Supervisor",
                    month,
                    base_salary: baseSalary,
                    bonus: 0,
                    deductions: 0,
                    net_payable: baseSalary,
                    status: "Pending",
                    payment_date: null,
                    payment_method: null,
                    remarks: null
                });
            }
        });

        // Add teachers
        teachers.forEach((teacher: any) => {
            const existing = payrollMap.get(teacher.id);
            if (existing) {
                records.push(existing);
            } else {
                const baseSalary = baseConfigs[teacher.id] || 0;
                records.push({
                    id: `pay-${teacher.id}-${month}`,
                    staff_id: teacher.id,
                    staff_name: teacher.name,
                    staff_email: teacher.email,
                    role: "Teacher",
                    department: "Teacher",
                    month,
                    base_salary: baseSalary,
                    bonus: 0,
                    deductions: 0,
                    net_payable: baseSalary,
                    status: "Pending",
                    payment_date: null,
                    payment_method: null,
                    remarks: null
                });
            }
        });

        return NextResponse.json({ success: true, month, records });
    } catch (error: any) {
        console.error("GET payroll error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === "save_record") {
            const { record } = body;
            if (!record || !record.staff_id || !record.month) {
                return NextResponse.json({ success: false, error: "Invalid record data" }, { status: 400 });
            }

            const payroll = readJSON(PAYROLL_FILE, []);

            // Recalculate net payable inside API for security and consistency
            const base = Number(record.base_salary) || 0;
            const bonus = Number(record.bonus) || 0;
            const deductions = Number(record.deductions) || 0;
            const net_payable = base + bonus - deductions;

            const updatedRecord = {
                ...record,
                base_salary: base,
                bonus,
                deductions,
                net_payable,
                payment_date: record.status === "Paid" ? (record.payment_date || new Date().toISOString()) : null
            };

            const index = payroll.findIndex((r: any) => r.staff_id === record.staff_id && r.month === record.month);
            if (index !== -1) {
                payroll[index] = updatedRecord;
            } else {
                payroll.push(updatedRecord);
            }

            writeJSON(PAYROLL_FILE, payroll);
            return NextResponse.json({ success: true, record: updatedRecord });
        }

        if (action === "save_config") {
            const { staff_id, base_salary, month } = body;
            if (!staff_id) {
                return NextResponse.json({ success: false, error: "Missing staff ID" }, { status: 400 });
            }

            const configs = readJSON(CONFIG_FILE, {});
            const salary = Number(base_salary) || 0;
            configs[staff_id] = salary;
            writeJSON(CONFIG_FILE, configs);

            // If a payroll record already exists for this staff in the current active month, update it too!
            if (month) {
                const payroll = readJSON(PAYROLL_FILE, []);
                const index = payroll.findIndex((r: any) => r.staff_id === staff_id && r.month === month);
                if (index !== -1 && payroll[index].status === "Pending") {
                    payroll[index].base_salary = salary;
                    payroll[index].net_payable = salary + (payroll[index].bonus || 0) - (payroll[index].deductions || 0);
                    writeJSON(PAYROLL_FILE, payroll);
                }
            }

            return NextResponse.json({ success: true, base_salary: salary });
        }

        if (action === "mark_all_paid") {
            const { month, records: currentRecords } = body;
            if (!month || !Array.isArray(currentRecords)) {
                return NextResponse.json({ success: false, error: "Missing month or records list" }, { status: 400 });
            }

            const payroll = readJSON(PAYROLL_FILE, []);
            const now = new Date().toISOString();

            currentRecords.forEach((current: any) => {
                const base = Number(current.base_salary) || 0;
                const bonus = Number(current.bonus) || 0;
                const deductions = Number(current.deductions) || 0;
                const net = base + bonus - deductions;

                const index = payroll.findIndex((r: any) => r.staff_id === current.staff_id && r.month === month);
                const updated = {
                    ...current,
                    base_salary: base,
                    bonus,
                    deductions,
                    net_payable: net,
                    status: "Paid",
                    payment_date: now,
                    payment_method: current.payment_method || "Bank Transfer",
                    remarks: current.remarks || "Batch paid by Admin"
                };

                if (index !== -1) {
                    payroll[index] = updated;
                } else {
                    payroll.push(updated);
                }
            });

            writeJSON(PAYROLL_FILE, payroll);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        console.error("POST payroll error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
