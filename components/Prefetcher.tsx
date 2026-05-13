"use client";

/**
 * Prefetcher — mounts invisibly in the root layout and silently
 * warms the React Query cache for every tab's data.
 *
 * This means by the time a user clicks a sidebar link, the data
 * is already in memory and the page shows instantly.
 */

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getTeachers, getTeachersBySupervisor, getAllClasses, getAllTeacherAvailability } from "@/lib/api/classes";
import { getStudents, getStudentsBySupervisor } from "@/lib/api/students";
import { getSupervisors } from "@/lib/api/supervisors";
import { getComplaints } from "@/lib/api/complaints";
import { getPlatforms } from "@/lib/api/platforms";

export function Prefetcher() {
    const [mounted, setMounted] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        // Stagger the prefetches so they don't all fire at once and
        // compete with the initial dashboard render.

        // Detect role and id from cookies
        const cookies = document.cookie.split("; ");
        const role = cookies.find(c => c.trim().startsWith("auth_role="))?.split("=")[1] || "admin";
        const supervisorId = cookies.find(c => c.trim().startsWith("supervisor_id="))?.split("=")[1];

        const isSupervisor = role === "supervisor" && !!supervisorId;

        // Tier 1: Primary tabs
        if (isSupervisor && supervisorId) {
            queryClient.prefetchQuery({ queryKey: ["teachers", "supervisor", supervisorId], queryFn: () => getTeachersBySupervisor(supervisorId) });
            queryClient.prefetchQuery({ queryKey: ["students", "supervisor", supervisorId], queryFn: () => getStudentsBySupervisor(supervisorId) });
        } else {
            queryClient.prefetchQuery({ queryKey: ["teachers"], queryFn: getTeachers });
            queryClient.prefetchQuery({ queryKey: ["students"], queryFn: () => getStudents() });
        }

        // Tier 2: Secondary tabs
        const t1 = setTimeout(() => {
            // Only admins see the full supervisors/complaints list
            if (!isSupervisor) {
                queryClient.prefetchQuery({ queryKey: ["supervisors"], queryFn: () => getSupervisors() });
                queryClient.prefetchQuery({ queryKey: ["complaints"], queryFn: getComplaints });
            }
        }, 800);

        // Tier 3: Supporting data
        const t2 = setTimeout(() => {
            queryClient.prefetchQuery({ queryKey: ["allClasses"], queryFn: getAllClasses });
            queryClient.prefetchQuery({ queryKey: ["allAvailability"], queryFn: getAllTeacherAvailability });
            queryClient.prefetchQuery({ queryKey: ["platforms"], queryFn: getPlatforms });
        }, 1800);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
        // Only run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Renders nothing — purely a side-effect component
    return null;
}
