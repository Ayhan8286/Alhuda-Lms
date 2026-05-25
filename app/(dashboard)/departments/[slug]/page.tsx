"use client";

import { use, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepartmentManagement } from "@/components/departments/DepartmentManagement";
import { StudentManagement } from "@/components/students/StudentManagement";
import { ShieldCheck, Megaphone, Cpu, Banknote, GraduationCap, Users } from "lucide-react";

type DepartmentSlug = "supervisor" | "marketing" | "tech-team" | "finance" | "teacher" | "students";

const slugToDept: Record<string, "Supervisor" | "Marketing" | "Tech Team" | "Finance" | "Teacher" | "Students"> = {
    "supervisor": "Supervisor",
    "marketing": "Marketing",
    "tech-team": "Tech Team",
    "finance": "Finance",
    "teacher": "Teacher",
    "students": "Students"
};

const getCookie = (name: string) => {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

export default function DepartmentPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const pathname = usePathname();
    const currentSlug = resolvedParams.slug as DepartmentSlug;
    
    const [role, setRole] = useState("admin");

    useEffect(() => {
        setRole(getCookie("auth_role") || "admin");
    }, []);

    const isSupervisor = role === "supervisor";

    // Ensure we handle invalid slugs by defaulting or redirecting
    const activeTab = slugToDept[currentSlug] && (!isSupervisor || currentSlug === "teacher" || currentSlug === "students") 
        ? currentSlug 
        : (isSupervisor ? "teacher" : "supervisor");

    useEffect(() => {
        if (role === "supervisor" && currentSlug !== "teacher" && currentSlug !== "students") {
            router.replace("/departments/teacher");
        }
    }, [role, currentSlug, router]);

    const handleTabChange = (value: string) => {
        router.push(`/departments/${value}`);
    };

    return (
        <div className="flex-1 overflow-y-auto flex flex-col relative min-h-screen">
            <div className="organic-blob bg-primary-container/10 w-[600px] h-[600px] -top-48 -left-24 fixed blur-[120px]"></div>
            <div className="organic-blob bg-tertiary-container/10 w-[500px] h-[500px] bottom-0 right-0 fixed blur-[100px]"></div>

            <div className="p-4 md:p-8 flex flex-col gap-8 max-w-7xl mx-auto w-full relative z-10">
                {role !== "teacher" && (
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-foreground mb-2">
                            Departments
                            <span className="text-primary ml-3">✦</span>
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium max-w-2xl">
                            Manage leadership hierarchies and monitor departmental growth across the entire ecosystem.
                        </p>
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-8">
                    {role !== "teacher" && (
                        <TabsList className="bg-white/5 border border-white/10 p-1.5 rounded-2xl h-auto flex flex-wrap md:flex-nowrap gap-1 backdrop-blur-md">
                            {!isSupervisor && (
                                <>
                                    <TabsTrigger value="supervisor" className="rounded-xl py-3 px-6 data-[state=active]:bg-forest data-[state=active]:text-white transition-all duration-300">
                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                        Supervisors
                                    </TabsTrigger>
                                    <TabsTrigger value="marketing" className="rounded-xl py-3 px-6 data-[state=active]:bg-forest data-[state=active]:text-white transition-all duration-300">
                                        <Megaphone className="h-4 w-4 mr-2" />
                                        Marketing
                                    </TabsTrigger>
                                    <TabsTrigger value="tech-team" className="rounded-xl py-3 px-6 data-[state=active]:bg-forest data-[state=active]:text-white transition-all duration-300">
                                        <Cpu className="h-4 w-4 mr-2" />
                                        Tech Team
                                    </TabsTrigger>
                                    <TabsTrigger value="finance" className="rounded-xl py-3 px-6 data-[state=active]:bg-forest data-[state=active]:text-white transition-all duration-300">
                                        <Banknote className="h-4 w-4 mr-2" />
                                        Finance
                                    </TabsTrigger>
                                </>
                            )}
                            <TabsTrigger value="teacher" className="rounded-xl py-3 px-6 data-[state=active]:bg-forest data-[state=active]:text-white transition-all duration-300">
                                <GraduationCap className="h-4 w-4 mr-2" />
                                {isSupervisor ? "Assigned Teachers" : "Teachers"}
                            </TabsTrigger>
                            <TabsTrigger value="students" className="rounded-xl py-3 px-6 data-[state=active]:bg-forest data-[state=active]:text-white transition-all duration-300">
                                <Users className="h-4 w-4 mr-2" />
                                {isSupervisor ? "Assigned Students" : "Students"}
                            </TabsTrigger>
                        </TabsList>
                    )}

                    <div className="mt-8">
                        {activeTab === "students" ? (
                            <StudentManagement />
                        ) : (
                            <DepartmentManagement department={slugToDept[activeTab] as any} />
                        )}
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
