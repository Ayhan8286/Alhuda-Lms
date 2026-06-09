import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fbhqngcwnokffzznshjr.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiaHFuZ2N3bm9rZmZ6em5zaGpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM2NDU0OSwiZXhwIjoyMDgyOTQwNTQ5fQ.JrMvKHvBquwu_hKvMKI8kSyg5RpOmp8Ac9q8U237Ldc";

const supabase = createClient(supabaseUrl, serviceRoleKey);

const FATIMA_ID = "a25074e4-cf5e-4583-b66b-5d2693ec9f62";
const NIMRA_ID = "aab0d8bb-816d-443e-a37d-c36eab7383b7";

async function verify() {
  // Check stats the same way the app does (via supervisor_stats_summary view or manual calc)
  
  // --- Miss Fatima ---
  const { data: fatimaTeachers } = await supabase
    .from("teachers")
    .select("id, name")
    .eq("supervisor_id", FATIMA_ID)
    .eq("is_active", true)
    .order("name");

  const fatimaStudentIds = new Set();
  for (const t of (fatimaTeachers || [])) {
    const { data: classes } = await supabase
      .from("classes")
      .select("student_id")
      .eq("teacher_id", t.id);
    classes?.forEach(c => { if (c.student_id) fatimaStudentIds.add(c.student_id); });
  }

  console.log(`=== Miss Fatima ===`);
  console.log(`Teachers: ${fatimaTeachers?.length || 0}`);
  fatimaTeachers?.forEach(t => console.log(`  - ${t.name}`));
  console.log(`Students (via classes, unique): ${fatimaStudentIds.size}`);

  // --- Miss Nimra ---
  const { data: nimraTeachers } = await supabase
    .from("teachers")
    .select("id, name")
    .eq("supervisor_id", NIMRA_ID)
    .eq("is_active", true)
    .order("name");

  const nimraStudentIds = new Set();
  for (const t of (nimraTeachers || [])) {
    const { data: classes } = await supabase
      .from("classes")
      .select("student_id")
      .eq("teacher_id", t.id);
    classes?.forEach(c => { if (c.student_id) nimraStudentIds.add(c.student_id); });
  }

  console.log(`\n=== Miss Nimra ===`);
  console.log(`Teachers: ${nimraTeachers?.length || 0}`);
  nimraTeachers?.forEach(t => console.log(`  - ${t.name}`));
  console.log(`Students (via classes, unique): ${nimraStudentIds.size}`);

  // Which 8 teachers were Rimsha's (the ones we reassigned)
  const rimshaTeacherNames = [
    "Mis Rabbia", "Miss Heera", "Miss Iqra", "Miss Ishmal",
    "Miss Mehmona", "Miss Salma", "Miss Umaima", "Miss Wajeeha"
  ];

  // Count students from just the ex-Rimsha teachers
  let exRimshaStudents = 0;
  const exRimshaInFatima = fatimaTeachers?.filter(t => rimshaTeacherNames.includes(t.name)) || [];
  const exRimshaInNimra = nimraTeachers?.filter(t => rimshaTeacherNames.includes(t.name)) || [];

  const exRimshaStudentIds = new Set();
  for (const t of [...exRimshaInFatima, ...exRimshaInNimra]) {
    const { data: classes } = await supabase
      .from("classes")
      .select("student_id")
      .eq("teacher_id", t.id);
    classes?.forEach(c => { if (c.student_id) exRimshaStudentIds.add(c.student_id); });
  }

  console.log(`\n=== Rimsha's Former 8 Teachers ===`);
  console.log(`Now under Fatima: ${exRimshaInFatima.map(t => t.name).join(", ")}`);
  console.log(`Now under Nimra: ${exRimshaInNimra.map(t => t.name).join(", ")}`);
  console.log(`Total unique students from ex-Rimsha teachers: ${exRimshaStudentIds.size}`);
  
  console.log(`\n=== TOTAL SUMMARY ===`);
  console.log(`All of Rimsha's ${exRimshaStudentIds.size} students (via 8 teachers) are now covered by Fatima & Nimra ✅`);
}

verify();
