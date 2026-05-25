import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Path to persistent homework JSON file
const dataDir = path.join(process.cwd(), "data");
const homeworkFilePath = path.join(dataDir, "homework.json");
const uploadDir = path.join(process.cwd(), "public", "uploads", "homework");

// Helper to ensure files and directories exist
function ensureDataFile() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(homeworkFilePath)) {
        fs.writeFileSync(homeworkFilePath, "[]", "utf-8");
    }
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
}

// Read homework list from file
function readHomeworkData(): any[] {
    ensureDataFile();
    try {
        const fileContent = fs.readFileSync(homeworkFilePath, "utf-8");
        return JSON.parse(fileContent);
    } catch (e) {
        console.error("Error reading homework JSON file:", e);
        return [];
    }
}

// Write homework list to file
function writeHomeworkData(data: any[]) {
    ensureDataFile();
    try {
        fs.writeFileSync(homeworkFilePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
        console.error("Error writing homework JSON file:", e);
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const teacherId = searchParams.get("teacherId");

    const allHomework = readHomeworkData();

    let filtered = allHomework;
    if (studentId) {
        filtered = filtered.filter(hw => hw.student_id === studentId);
    }
    if (teacherId) {
        filtered = filtered.filter(hw => hw.teacher_id === teacherId);
    }

    // Sort: assigned first (nearest deadline), then submitted, then graded
    filtered.sort((a, b) => {
        if (a.status === b.status) {
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        const statusWeight: Record<string, number> = { assigned: 0, submitted: 1, graded: 2 };
        return (statusWeight[a.status] ?? 0) - (statusWeight[b.status] ?? 0);
    });

    return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
    const contentType = req.headers.get("content-type") || "";

    try {
        if (contentType.includes("application/json")) {
            const body = await req.json();
            const { action } = body;

            if (action === "create") {
                const { title, description, deadline, teacherId, teacherName, students, courseName } = body;

                if (!title || !deadline || !teacherId || !students || !Array.isArray(students)) {
                    return NextResponse.json({ error: "Missing required fields for assigning homework" }, { status: 400 });
                }

                const allHomework = readHomeworkData();
                const newAssignments: any[] = [];

                students.forEach((student: { id: string; name: string }) => {
                    const hwId = `hw-${crypto.randomUUID()}`;
                    newAssignments.push({
                        id: hwId,
                        title,
                        description,
                        deadline,
                        teacher_id: teacherId,
                        teacher_name: teacherName || "Teacher",
                        student_id: student.id,
                        student_name: student.name,
                        course_name: courseName || "Quranic Studies",
                        status: "assigned",
                        submission_text: null,
                        submission_audio_url: null,
                        submission_date: null,
                        grade: null,
                        teacher_remarks: null,
                        graded_date: null
                    });
                });

                writeHomeworkData([...allHomework, ...newAssignments]);
                return NextResponse.json({ success: true, count: newAssignments.length });
            }

            if (action === "grade") {
                const { homeworkId, grade, teacherRemarks } = body;

                if (!homeworkId || !grade) {
                    return NextResponse.json({ error: "Missing required grading fields" }, { status: 400 });
                }

                const allHomework = readHomeworkData();
                const index = allHomework.findIndex(hw => hw.id === homeworkId);

                if (index === -1) {
                    return NextResponse.json({ error: "Homework assignment not found" }, { status: 404 });
                }

                allHomework[index] = {
                    ...allHomework[index],
                    grade,
                    teacher_remarks: teacherRemarks || null,
                    graded_date: new Date().toISOString(),
                    status: "graded"
                };

                writeHomeworkData(allHomework);
                return NextResponse.json({ success: true, homework: allHomework[index] });
            }

            return NextResponse.json({ error: "Invalid action for JSON content" }, { status: 400 });
        }

        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const action = formData.get("action");

            if (action === "submit") {
                const homeworkId = formData.get("homeworkId") as string;
                const submissionText = (formData.get("submissionText") as string) || "";
                const audioFile = formData.get("audioFile") as File | null;

                if (!homeworkId) {
                    return NextResponse.json({ error: "Missing homeworkId for submission" }, { status: 400 });
                }

                const allHomework = readHomeworkData();
                const index = allHomework.findIndex(hw => hw.id === homeworkId);

                if (index === -1) {
                    return NextResponse.json({ error: "Homework assignment not found" }, { status: 404 });
                }

                let audioUrl: string | null = allHomework[index].submission_audio_url || null;

                if (audioFile) {
                    ensureDataFile();
                    const bytes = await audioFile.arrayBuffer();
                    const buffer = Buffer.from(bytes);
                    
                    // Sanitize file extension, default to .mp3
                    let ext = path.extname(audioFile.name || "");
                    if (!ext && audioFile.type) {
                        const mimeType = audioFile.type.split("/")[1] || "";
                        if (mimeType.includes("webm")) ext = ".webm";
                        else if (mimeType.includes("wav")) ext = ".wav";
                        else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) ext = ".mp3";
                        else if (mimeType.includes("ogg")) ext = ".ogg";
                        else if (mimeType.includes("m4a") || mimeType.includes("x-m4a")) ext = ".m4a";
                    }
                    if (!ext) ext = ".mp3";

                    const filename = `homework_${homeworkId}_recitation_${Date.now()}${ext}`;
                    const filePath = path.join(uploadDir, filename);

                    // Write binary file to public assets folder
                    fs.writeFileSync(filePath, buffer);
                    audioUrl = `/uploads/homework/${filename}`;
                }

                allHomework[index] = {
                    ...allHomework[index],
                    submission_text: submissionText,
                    submission_audio_url: audioUrl,
                    submission_date: new Date().toISOString(),
                    status: "submitted"
                };

                writeHomeworkData(allHomework);
                return NextResponse.json({ success: true, homework: allHomework[index] });
            }

            return NextResponse.json({ error: "Invalid action for multipart content" }, { status: 400 });
        }

        return NextResponse.json({ error: "Unsupported media content type" }, { status: 415 });
    } catch (error: any) {
        console.error("Error in homework API:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
