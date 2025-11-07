import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface TranscriptInfo {
  id: string;
  title: string;
  duration: string;
  language: string;
  filename: string;
  segmentCount: number;
}

/**
 * GET /api/transcripts/list
 * Returns a list of all available transcripts with metadata
 */
export async function GET() {
  try {
    const transcriptsDir = path.join(process.cwd(), "public", "data", "transcripts");
    
    console.log("📂 Reading transcripts directory...");
    
    // Read all files in the transcripts directory
    let files: string[];
    try {
      files = await fs.readdir(transcriptsDir);
    } catch (err) {
      console.log("⚠️  Transcripts directory not found");
      return NextResponse.json([]);
    }

    // Filter for timestamp JSON files
    const timestampFiles = files.filter(file => file.endsWith("_timestamps.json"));
    console.log(`📊 Found ${timestampFiles.length} transcript files`);

    // Load metadata from each file
    const transcripts: TranscriptInfo[] = [];

    for (const filename of timestampFiles) {
      try {
        const filePath = path.join(transcriptsDir, filename);
        const fileContents = await fs.readFile(filePath, "utf8");
        const data = JSON.parse(fileContents);

        // Extract ID and language from filename
        const match = filename.match(/^(.+?)_(arabic|english)_timestamps\.json$/);
        if (!match) continue;

        const id = match[1];
        const language = match[2];

        transcripts.push({
          id,
          title: data.title || "Untitled",
          duration: data.duration || data.transcription_duration?.toString() || "0",
          language,
          filename,
          segmentCount: data.segments?.length || 0,
        });

        console.log(`  ✓ Loaded: ${filename} (${data.segments?.length || 0} segments)`);
      } catch (err) {
        console.warn(`  ⚠️  Could not load ${filename}:`, err);
      }
    }

    // Sort by ID and language
    transcripts.sort((a, b) => {
      if (a.id !== b.id) return a.id.localeCompare(b.id);
      return a.language.localeCompare(b.language);
    });

    console.log(`✅ Returning ${transcripts.length} transcripts\n`);

    return NextResponse.json(transcripts);
  } catch (error) {
    console.error("❌ Error listing transcripts:", error);
    return NextResponse.json(
      { error: "Failed to list transcripts" },
      { status: 500 }
    );
  }
}

