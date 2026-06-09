import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fbhqngcwnokffzznshjr.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiaHFuZ2N3bm9rZmZ6em5zaGpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM2NDU0OSwiZXhwIjoyMDgyOTQwNTQ5fQ.JrMvKHvBquwu_hKvMKI8kSyg5RpOmp8Ac9q8U237Ldc";

const supabase = createClient(supabaseUrl, serviceRoleKey);

const RIMSHA_ID = "faf1a674-840b-4fc5-9ba7-710cea59063d";
const FATIMA_ID = "a25074e4-cf5e-4583-b66b-5d2693ec9f62";
const NIMRA_ID = "aab0d8bb-816d-443e-a37d-c36eab7383b7";

async function run() {
  // Step 1: Reassign students under Rimsha to Fatima and Nimra
  console.log("=== Step 1: Find all students under Rimsha Ilyas ===");
  
  const { data: students, error: studErr } = await supabase
    .from("students")
    .select("id, full_name, supervisor_id")
    .eq("supervisor_id", RIMSHA_ID)
    .order("full_name");

  if (studErr) {
    console.error("Error fetching students:", studErr);
    return;
  }

  console.log(`Found ${students.length} students under Rimsha:`);
  students.forEach((s, i) => console.log(`  ${i + 1}. ${s.full_name}`));

  if (students.length > 0) {
    const midpoint = Math.ceil(students.length / 2);
    const fatimaStudents = students.slice(0, midpoint);
    const nimraStudents = students.slice(midpoint);

    console.log(`\n  -> Miss Fatima (${fatimaStudents.length} students)`);
    console.log(`  -> Miss Nimra (${nimraStudents.length} students)`);

    // Reassign to Fatima
    if (fatimaStudents.length > 0) {
      const { error } = await supabase
        .from("students")
        .update({ supervisor_id: FATIMA_ID })
        .in("id", fatimaStudents.map(s => s.id));

      if (error) {
        console.error("Error reassigning students to Fatima:", error);
        return;
      }
      console.log(`✅ Reassigned ${fatimaStudents.length} students to Miss Fatima`);
    }

    // Reassign to Nimra
    if (nimraStudents.length > 0) {
      const { error } = await supabase
        .from("students")
        .update({ supervisor_id: NIMRA_ID })
        .in("id", nimraStudents.map(s => s.id));

      if (error) {
        console.error("Error reassigning students to Nimra:", error);
        return;
      }
      console.log(`✅ Reassigned ${nimraStudents.length} students to Miss Nimra`);
    }
  }

  // Step 2: Check for any other references to Rimsha
  console.log(`\n=== Step 2: Check for remaining references ===`);
  
  // Check teachers (should be 0 from previous run)
  const { data: remainingTeachers } = await supabase
    .from("teachers")
    .select("id, name")
    .eq("supervisor_id", RIMSHA_ID);
  console.log(`Teachers still under Rimsha: ${remainingTeachers?.length || 0}`);

  // Check students
  const { data: remainingStudents } = await supabase
    .from("students")
    .select("id")
    .eq("supervisor_id", RIMSHA_ID);
  console.log(`Students still under Rimsha: ${remainingStudents?.length || 0}`);

  // Step 3: Delete Rimsha from supervisors
  console.log(`\n=== Step 3: Deleting Rimsha Ilyas from supervisors ===`);
  const { error: delErr } = await supabase
    .from("supervisors")
    .delete()
    .eq("id", RIMSHA_ID);

  if (delErr) {
    console.error("Error deleting Rimsha:", delErr);
    return;
  }
  console.log("✅ Rimsha Ilyas deleted from supervisors table");

  // Verification
  console.log(`\n=== Final Verification ===`);
  
  const { data: fatimaTeachers } = await supabase
    .from("teachers")
    .select("id, name")
    .eq("supervisor_id", FATIMA_ID)
    .order("name");
  
  const { data: nimraTeachers } = await supabase
    .from("teachers")
    .select("id, name")
    .eq("supervisor_id", NIMRA_ID)
    .order("name");

  const { data: fatimaStudents } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("supervisor_id", FATIMA_ID);
  
  const { data: nimraStudentsAfter } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("supervisor_id", NIMRA_ID);

  console.log(`\nMiss Fatima: ${fatimaTeachers?.length || 0} teachers, ${fatimaStudents?.length || 0} students`);
  fatimaTeachers?.forEach(t => console.log(`  [T] ${t.name}`));
  
  console.log(`\nMiss Nimra: ${nimraTeachers?.length || 0} teachers, ${nimraStudentsAfter?.length || 0} students`);
  nimraTeachers?.forEach(t => console.log(`  [T] ${t.name}`));

  const { data: rimshaCheck } = await supabase
    .from("supervisors")
    .select("id")
    .eq("id", RIMSHA_ID);
  
  console.log(`\nRimsha entry exists: ${(rimshaCheck?.length || 0) > 0 ? '❌ YES (problem!)' : '✅ NO (deleted)'}`);
}

run();
