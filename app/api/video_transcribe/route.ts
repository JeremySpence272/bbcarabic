import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import YTDlpWrap from "yt-dlp-wrap";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper to clean up temp files
const cleanupFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Failed to cleanup file ${filePath}:`, error);
  }
};

/**
 * POST /api/video_transcribe
 * Downloads YouTube video and sends to Python transcription API
 */
export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const body = await request.json();
    const { youtube_url } = body;

    if (!youtube_url) {
      return NextResponse.json(
        { error: "YouTube URL is required" },
        { status: 400 }
      );
    }

    // Basic YouTube URL validation
    if (!youtube_url || (!youtube_url.includes("youtube.com") && !youtube_url.includes("youtu.be"))) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    console.log(`Downloading YouTube video: ${youtube_url}`);

    // Initialize yt-dlp-wrap
    // yt-dlp-wrap will auto-download the binary on first use
    const ytDlpWrap = new YTDlpWrap();
    
    // Ensure binary has execute permissions if it exists
    try {
      const binaryPath = ytDlpWrap.getBinaryPath();
      if (binaryPath && fs.existsSync(binaryPath)) {
        // Make sure binary is executable (chmod +x)
        fs.chmodSync(binaryPath, 0o755); // rwxr-xr-x
      }
    } catch (error: any) {
      console.warn("Could not set binary permissions:", error.message);
      // Continue anyway - binary might auto-download on first use
    }
    
    // Get video info first to extract title
    let videoInfo;
    try {
      videoInfo = await ytDlpWrap.getVideoInfo(youtube_url);
    } catch (error: any) {
      console.error("Error getting video info:", error);
      throw new Error(`Failed to get video info: ${error.message || "Unknown error"}`);
    }

    const title = videoInfo.title || videoInfo.fulltitle || "youtube_video";
    
    // Clean filename (without extension - yt-dlp will add it)
    const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase().substring(0, 50);
    const fileBase = `${safeTitle}_${Date.now()}`;
    const outputTemplate = path.join(UPLOADS_DIR, `${fileBase}.%(ext)s`);

    // Download video as MP4 (best quality with audio)
    console.log(`Downloading to: ${outputTemplate}`);
    
    try {
      await ytDlpWrap.execPromise([
        youtube_url,
        "-f", "best[ext=mp4]/best", // Prefer mp4, fallback to best available
        "-o", outputTemplate,
        "--no-playlist",
        "--quiet",
        "--no-warnings",
      ]);
    } catch (error: any) {
      console.error("Download error:", error);
      throw new Error(`Failed to download video: ${error.message || "Unknown error"}`);
    }
    
    // Find the downloaded file (yt-dlp may use different extension)
    const downloadedFiles = fs.readdirSync(UPLOADS_DIR).filter(f => f.startsWith(fileBase));
    if (downloadedFiles.length === 0) {
      throw new Error("Downloaded file was not created");
    }
    
    // Use the first matching file
    tempFilePath = path.join(UPLOADS_DIR, downloadedFiles[0]);
    const filename = downloadedFiles[0];
    
    console.log(`Downloaded video: ${tempFilePath}`);

    // Create FormData for Python API
    // Read file buffer and create FormData with File object
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    // Create FormData with File (available in Node.js 18+)
    const formData = new FormData();
    const fileBlob = new Blob([fileBuffer], { type: "video/mp4" });
    
    // Use File constructor (available in Node.js 20.5+)
    // Fallback to Blob if File is not available
    if (typeof File !== 'undefined') {
      const file = new File([fileBlob], filename, { type: "video/mp4" });
      formData.append("file", file);
    } else {
      // Fallback: append Blob directly (may need boundary header)
      formData.append("file", fileBlob, filename);
    }

    // Upload to Python transcription API
    // Use a longer timeout for file upload (large files can take time)
    console.log(`Uploading to Python API: ${PYTHON_API_URL}/transcribe`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for upload + initial response
    
    let transcribeResponse;
    try {
      transcribeResponse = await fetch(`${PYTHON_API_URL}/transcribe`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
        // Don't set Content-Type header - fetch will set it with boundary automatically
      });
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error("Request timeout: The Python API took too long to respond. It may be downloading the Whisper model. Please try again in a moment.");
      }
      throw error;
    }

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error("Python API error:", errorText);
      throw new Error(`Python API error: ${transcribeResponse.status} - ${errorText}`);
    }

    const transcribeData = await transcribeResponse.json();
    console.log("Transcription started:", transcribeData);

    // Cleanup temp file
    cleanupFile(tempFilePath);
    tempFilePath = null;

    return NextResponse.json(transcribeData);
  } catch (error: any) {
    console.error("Error in video_transcribe:", error);

    // Cleanup temp file on error
    if (tempFilePath) {
      cleanupFile(tempFilePath);
    }

    return NextResponse.json(
      {
        error: error.message || "Failed to process YouTube video",
      },
      { status: 500 }
    );
  }
}


