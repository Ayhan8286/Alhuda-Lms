"use client";

import { useActionState, useState } from "react";
import { loginAction } from "./actions";
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  AlertCircle, 
  ShieldCheck, 
  UserCog, 
  Megaphone, 
  Terminal, 
  Wallet,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

// Provide an initial state for the form action
const initialState = { error: "" };

export default function LoginPage() {
  const [roleType, setRoleType] = useState<"admin" | "supervisor" | "marketing" | "finance" | "tech-team" | "teacher" | "student">("admin");
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  const roles = [
    { id: "admin", label: "Admin", icon: ShieldCheck },
    { id: "supervisor", label: "Supervisor", icon: UserCog },
    { id: "teacher", label: "Teacher", icon: GraduationCap },
    { id: "student", label: "Student", icon: BookOpen },
    { id: "marketing", label: "Marketing", icon: Megaphone },
    { id: "tech-team", label: "Tech Team", icon: Terminal },
    { id: "finance", label: "Finance", icon: Wallet },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden bg-[#f4f6f4] dark:bg-[#0c1a0d] p-4">
      {/* Background Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-[120%] -translate-y-1/2 w-[560px] h-[560px] rounded-full bg-primary/[0.06] dark:bg-primary/[0.05] blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 translate-x-[20%] -translate-y-[20%] w-[440px] h-[440px] rounded-full bg-emerald-500/[0.06] dark:bg-emerald-400/[0.04] blur-[100px]" />
      </div>

      <div className="w-full max-w-[480px] relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-16 h-16 flex items-center justify-center mb-4">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-md" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground text-center">AL Huda LMS</h1>
          <p className="text-sm text-muted-foreground font-medium mt-1 text-center">
            Sign in to your account
          </p>
        </div>

        <div className="bg-white dark:bg-[#102212]/80 backdrop-blur-xl border border-slate-200 dark:border-primary/20 rounded-3xl p-8 shadow-2xl shadow-primary/5">
          {/* Role Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-100 dark:bg-black/20 p-1 rounded-2xl mb-8">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setRoleType(role.id as any)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold rounded-xl transition-all duration-200 uppercase tracking-widest",
                  roleType === role.id
                    ? "bg-white dark:bg-primary/20 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white/80"
                )}
              >
                <role.icon className="h-3.5 w-3.5" />
                {role.label}
              </button>
            ))}
          </div>

          <form action={formAction} className="space-y-5">
            <input type="hidden" name="roleType" value={roleType} />
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground px-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type={roleType === "student" ? "text" : "email"}
                  name="email"
                  required
                  placeholder={
                    roleType === "student"
                      ? "student@email.com"
                      : roleType === "admin" 
                        ? "alhudanetwork7860@gmail.com" 
                        : roleType === "teacher" 
                          ? "name.teacher@email.com" 
                          : "super@demo.com"
                  }
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-primary/10 rounded-xl py-3 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-sm font-semibold text-foreground">Password</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-primary/10 rounded-xl py-3 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 ml-1">
                Hint: Password is <span className="font-mono bg-slate-100 dark:bg-black/30 px-1 py-0.5 rounded">{
                  roleType === "admin" 
                    ? "Alhudanetwrok@" 
                    : roleType === "teacher" 
                      ? "teacher@" 
                      : roleType === "student"
                        ? "student@"
                        : "password"
                }</span>
              </p>
            </div>

            {state?.error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">{state.error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(19,236,55,0.2)]"
            >
              {isPending ? "Signing in..." : "Sign in"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
