import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Exclude static files, api routes, Next.js internals, and _next from middleware
  if (
    pathname.startsWith("/_next") || 
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    /\.(.*)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const roleCookie = request.cookies.get("auth_role");
  const isAuthenticated = !!roleCookie;

  // --- Session Repair logic (Fixes old browser states automatically) ---
  let response = NextResponse.next();
  if (isAuthenticated && roleCookie?.value === "admin") {
      const token = request.cookies.get("supabase_access_token")?.value;
      const adminId = request.cookies.get("admin_id")?.value;

      if (token && !adminId) {
          try {
              // Decode JWT payload without Buffer (Edge-safe)
              const payloadPart = token.split('.')[1];
              const payload = JSON.parse(atob(payloadPart));
              if (payload.sub) {
                  response.cookies.set("admin_id", payload.sub, {
                      httpOnly: false,
                      secure: process.env.NODE_ENV === "production",
                      maxAge: 60 * 60 * 24 * 7,
                      path: "/",
                  });
              }
          } catch (e) {
              console.error("Middleware: Session repair failed", e);
          }
      }
  }
  // ----------------------------------------------------------------------

  // 2. Auth & Redirect Logic
  // If user is trying to access login page
  if (pathname === "/login") {
    if (isAuthenticated && request.method === "GET") {
      const isSupervisor = roleCookie?.value === "supervisor";
      const supervisorId = request.cookies.get("supervisor_id")?.value;
      const deptRole = request.cookies.get("dept_role")?.value?.toLowerCase()?.replace(' ', '-');
      
      let redirectRes;
      if (isSupervisor && supervisorId) {
        if (deptRole === 'supervisor' || deptRole === 'tech' || deptRole === 'marketing') {
            redirectRes = NextResponse.redirect(new URL(`/`, request.url));
        } else {
            redirectRes = NextResponse.redirect(new URL(`/tasks`, request.url));
        }
      } else {
        redirectRes = NextResponse.redirect(new URL("/", request.url));
      }

      // Copy repair cookies to redirect response
      response.cookies.getAll().forEach(c => redirectRes.cookies.set(c.name, c.value, c));
      return redirectRes;
    }
    return response;
  }

  // If user is trying to access any other page but is not authenticated
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  
  // Optional: Route protections
  if (roleCookie?.value === "supervisor") {
    const supervisorId = request.cookies.get("supervisor_id")?.value;
    const deptRole = request.cookies.get("dept_role")?.value?.toLowerCase()?.replace(' ', '-');

    const isAllowedPath = 
      pathname === "/login" ||
      pathname === "/tasks" ||
      pathname.startsWith("/messages") ||
      pathname.startsWith(`/departments/${deptRole}/`) ||
      ((deptRole === 'supervisor' || deptRole === 'tech' || deptRole === 'marketing') && (
        pathname === "/" ||
        pathname === "/departments/teacher" ||
        pathname === "/departments/students" ||
        pathname === `/supervisors/${supervisorId}` ||
        pathname.startsWith("/students") ||
        pathname.startsWith("/attendance") ||
        pathname.startsWith("/teachers/") ||
        pathname.startsWith("/timetable") ||
        pathname === "/reports"
      ));
    
    if (!isAllowedPath) {
       let redirectUrl;
       if (deptRole === 'supervisor') {
           redirectUrl = `/supervisors/${supervisorId}`;
       } else {
           redirectUrl = `/tasks`;
       }
       const supervisorRedirect = NextResponse.redirect(new URL(redirectUrl, request.url));
       response.cookies.getAll().forEach(c => supervisorRedirect.cookies.set(c.name, c.value, c));
       return supervisorRedirect;
    }
  }

  if (roleCookie?.value === "teacher") {
    const teacherId = request.cookies.get("teacher_id")?.value;
    const isAllowedPath = 
      pathname === "/login" ||
      pathname === "/" ||
      pathname === "/timetable" ||
      pathname.startsWith("/online-class") ||
      pathname.startsWith("/messages") ||
      pathname.startsWith("/attendance") ||
      pathname === "/reports" ||
      pathname === "/departments/students" ||
      pathname.startsWith("/homework") ||
      pathname.startsWith("/teachers/") ||
      pathname.startsWith("/students"); // Teachers might need to see student details

    if (!isAllowedPath) {
       const teacherRedirect = NextResponse.redirect(new URL("/", request.url));
       response.cookies.getAll().forEach(c => teacherRedirect.cookies.set(c.name, c.value, c));
       return teacherRedirect;
    }
  }

  if (roleCookie?.value === "student") {
    const isAllowedPath = 
      pathname === "/login" ||
      pathname === "/" ||
      pathname.startsWith("/online-class") ||
      pathname.startsWith("/messages") ||
      pathname.startsWith("/homework");

    if (!isAllowedPath) {
       const studentRedirect = NextResponse.redirect(new URL("/", request.url));
       response.cookies.getAll().forEach(c => studentRedirect.cookies.set(c.name, c.value, c));
       return studentRedirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
