# Al Huda LMS Management Platform ✦

A premium, state-of-the-art Learning Management System (LMS) designed for academic oversight, teacher-student interactive homework workflows, real-time messaging, and administrative tools (including payroll, complaints, and student leaves).

Built with modern web standards, the platform features a sleek, responsive dark/light-themed visual layout, fluid animations, and glassmorphic aesthetics.

---

## 🚀 Key Features

### 👥 Role-Based Workflows
* **Admin**:
  - Global oversight of academic and administrative statistics.
  - Interactive **Payroll Tab** to manage and track monthly salary histories for all non-student personnel (Supervisors, Tech Team, Marketing, Finance, Teachers).
  - Centralized **Complaints Manager** to track, prioritize, and resolve feedback.
* **Supervisor**:
  - Departmental roster management for assigned **Teachers** and **Students**.
  - Review system-wide academic performance metrics.
  - Oversee student attendance trackers and resolve missing attendances.
* **Teacher**:
  - **Homework Manager**: Assign custom Quranic recitation, memorization, and ethics tasks.
  - **Recitation Reviewer**: Stream browser-native audio submissions uploaded by students directly within the dashboard, and assign evaluations/remarks.
  - **Student Directory**: Simplified student cards showing only their assigned classroom rosters.
  - Register daily class attendances and generate monthly PDF progress summaries.
* **Student**:
  - View daily study timetables and tasks.
  - **Homework Hub**: Review, complete, and submit homework assignments. Include text comments and upload/record browser-native audio recitations.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router & React Server Components)
- **Database / Backend**: [Supabase](https://supabase.com/) (PostgreSQL with real-time replication, Row-Level Security, and RPC views)
- **State Management / Caching**: [@tanstack/react-query](https://tanstack.com/query) (React Query)
- **Styling**: Vanilla CSS & TailwindCSS
- **Icons**: [Lucide React](https://lucide.dev/) & Material Symbols

---

## ⚡ Performance Optimizations

1. **Consolidated PostgREST Queries**:
   - Reduces supervisor and teacher dashboards from 7-8 sequential database calls to **3 consolidated parallel projections** (Students, Teachers, and Classes), slashing network request times by up to **50%**.
2. **Edge-Safe Session Handling**:
   - Edge-compatible JWT verification and auto-repair middleware handlers.
3. **Advanced Stale Timing**:
   - Centralized React Query caching timing configurations (`STALE_LONG`, `STALE_SHORT`, `STALE_NONE`) matching data volatility to minimize unnecessary database calls.

---

## ⚙️ Getting Started

### 1. Prerequisites
Ensure you have **Node.js** (v18+) and **npm** installed on your system.

### 2. Environment Setup
Create a `.env.local` file in the root directory based on `env.template`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Installation
Install the project dependencies:
```bash
npm install
```

### 4. Running the Development Server
Start the Next.js dev server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more information.
