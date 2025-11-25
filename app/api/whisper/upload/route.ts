import { NextResponse } from "next/server";
import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/whisper/upload
 * Transcribes an uploaded MP3 file using OpenAI Whisper
 */
export async function POST(request: Request) {
  try {
    console.log("\n🎙️  Starting transcription from uploaded file...");

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("audio/") && !file.name.endsWith(".mp3")) {
      return NextResponse.json(
        { error: "File must be an audio file (MP3)" },
        { status: 400 }
      );
    }

    console.log(`📁 File received: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

    // Create temp directory
    const tempDir = path.join(process.cwd(), "temp");
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    // Save uploaded file temporarily
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tempFilePath = path.join(tempDir, `upload_${Date.now()}_${file.name}`);
    await fs.writeFile(tempFilePath, buffer);
    console.log(`💾 Saved temporary file to: ${tempFilePath}`);

    // Transcribe using Whisper
    console.log("\n🎯 Sending to OpenAI Whisper API...");
    console.log("⚙️  Model: whisper-1");
    console.log("📝 Requesting plain text output");

    const fileBuffer = await fs.readFile(tempFilePath);
    const audioFile = new File([fileBuffer], file.name, { type: file.type || "audio/mpeg" });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "text", // Plain text, no timestamps
    });

    console.log("✅ Transcription received from Whisper API");
    console.log(`📝 Transcript length: ${transcription.length} characters`);
    console.log(`📄 Preview: ${transcription.substring(0, 100)}...`);

    // Clean up temp file
    try {
      await fs.unlink(tempFilePath);
      console.log("🗑️  Cleaned up temporary file");
    } catch (err) {
      console.warn("⚠️  Could not delete temp file:", err);
    }

    console.log("\n🎉 Transcription complete!");

    return NextResponse.json({
      success: true,
      transcript: transcription,
      fileName: file.name,
      fileSize: file.size,
    });

  } catch (error) {
    console.error("\n❌ Transcription error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}


