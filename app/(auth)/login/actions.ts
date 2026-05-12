"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function loginAction(prevState: any, formData: FormData) {
  // Clear any existing session before trying to log in
  await supabase.auth.signOut();

  const rawEmail = formData.get("email") as string;
  const email = rawEmail?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const roleType = formData.get("roleType") as "admin" | "supervisor" | "marketing" | "finance" | "tech-team" | "teacher";

  if (!email || !password || !roleType) {
    return { error: "Please provide all required fields." };
  }

  const cookieStore = await cookies();

  if (roleType === "admin") {
    // ... (existing admin logic)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return { error: error?.message || "Invalid credentials" };
    }

    // Check if this user is a supervisor (should not login as admin)
    const { data: supervisorMatch } = await supabaseAdmin
      .from("supervisors")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (supervisorMatch) {
      await supabase.auth.signOut();
      return { error: "Access Denied: You are registered as Staff, not an Admin." };
    }

    // Set Admin cookies
    cookieStore.set("auth_role", "admin", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    if (data.session) {
      cookieStore.set("supabase_access_token", data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: data.session.expires_in,
        path: "/",
      });

      // Also set a non-httpOnly admin_id for UI visibility
      cookieStore.set("admin_id", data.user.id, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    revalidatePath("/", "layout");
    redirect("/");
  } else if (roleType === "teacher") {
    // Teacher login uses 'teachers' table
    const { data: teacher, error } = await supabaseAdmin
      .from("teachers")
      .select("id, name, email, password")
      .ilike("email", email)
      .maybeSingle();

    if (error || !teacher || teacher.password !== password) {
      return { error: "Invalid login credentials for Teacher." };
    }

    // Set Teacher Auth cookies
    cookieStore.set("auth_role", "teacher", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    cookieStore.set("teacher_id", teacher.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    revalidatePath("/", "layout");
    redirect("/");
  } else {
    // Supervisor/Staff login uses Database Table lookup
    const { data: staff, error } = await supabaseAdmin
      .from("supervisors")
      .select("id, email, password, department")
      .ilike("email", email)
      .maybeSingle();

    if (error || !staff || staff.password !== password) {
      return { error: "Invalid login credentials." };
    }

    // Validate that the chosen tab matches the user's department
    const userDept = (staff.department || "Supervisor").toLowerCase().replace(' ', '-');
    if (roleType !== "supervisor" && roleType !== userDept) {
        return { error: `Your account is registered under the ${staff.department} department. Please use the ${staff.department} tab.` };
    }

    // Set Base Auth cookies
    cookieStore.set("auth_role", "supervisor", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    cookieStore.set("supervisor_id", staff.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    // Set Department cookie (default to 'Supervisor' if not set)
    cookieStore.set("dept_role", staff.department || "Supervisor", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    revalidatePath("/", "layout");
    
    // Redirect to /tasks if specialized staff, otherwise to home dashboard
    if (staff.department && staff.department !== 'Supervisor') {
        redirect("/tasks");
    } else {
        redirect("/");
    }
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_role");
  cookieStore.delete("supabase_access_token");
  cookieStore.delete("supervisor_id");
  cookieStore.delete("teacher_id");
  cookieStore.delete("admin_id");
  cookieStore.delete("dept_role");
  await supabase.auth.signOut();
  redirect("/login");
}
