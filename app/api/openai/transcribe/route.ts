import { NextResponse } from "next/server";
import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";
import { removeSegmentsBeforeBBCNews } from "@/lib/transcript-cleaner";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/openai/transcribe
 * Transcribes an Arabic podcast episode using OpenAI Whisper
 */
export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Episode ID is required" },
        { status: 400 }
      );
    }

    console.log(`\n🎙️  Starting transcription for episode ID: ${id}`);

    // Load episodes to get the mp3_url
    console.log("📂 Loading episodes from JSON...");
    const episodesPath = path.join(process.cwd(), "public", "data", "latest_episodes.json");
    const episodesData = await fs.readFile(episodesPath, "utf8");
    const episodes = JSON.parse(episodesData);

    // Find the episode
    const episode = episodes.find((ep: any) => ep.id === id);
    if (!episode) {
      console.log(`❌ Episode ${id} not found`);
      return NextResponse.json(
        { error: `Episode with ID "${id}" not found` },
        { status: 404 }
      );
    }

    console.log(`✅ Found episode: ${episode.title_arabic}`);
    console.log(`🔗 MP3 URL: ${episode.mp3_url}`);
    console.log(`⏱️  Duration: ${episode.duration_seconds} seconds`);

    // Download the MP3 file
    console.log("\n📥 Downloading MP3 file...");
    const mp3Response = await fetch(episode.mp3_url);
    
    if (!mp3Response.ok) {
      throw new Error(`Failed to download MP3: ${mp3Response.status} ${mp3Response.statusText}`);
    }

    const mp3Buffer = await mp3Response.arrayBuffer();
    const mp3Size = (mp3Buffer.byteLength / (1024 * 1024)).toFixed(2);
    console.log(`✅ Downloaded MP3 file: ${mp3Size} MB`);

    // Create a temporary file for the MP3
    const tempDir = path.join(process.cwd(), "temp");
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    const tempMp3Path = path.join(tempDir, `${id}_temp.mp3`);
    await fs.writeFile(tempMp3Path, Buffer.from(mp3Buffer));
    console.log(`💾 Saved temporary MP3 to: ${tempMp3Path}`);

    // Transcribe using Whisper with timestamps
    console.log("\n🎯 Sending to OpenAI Whisper API...");
    console.log("⚙️  Model: whisper-1");
    console.log("🌍 Language: Arabic (ar)");
    console.log("⏱️  Requesting segment-level timestamps (sentence-level)");

    const fileBuffer = await fs.readFile(tempMp3Path);
    const audioFile = new File([fileBuffer], `${id}.mp3`, { type: "audio/mpeg" });

    // Get verbose JSON with segment timestamps
    const transcriptionWithTimestamps = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "ar", // Arabic
      response_format: "verbose_json",
      timestamp_granularities: ["segment"], // Sentence-level timestamps
    });

    console.log("✅ Transcription received from Whisper API");
    console.log(`📝 Total segments: ${transcriptionWithTimestamps.segments?.length || 0}`);
    
    // Extract plain text from segments
    const transcription = transcriptionWithTimestamps.segments
      ?.map(segment => segment.text)
      .join(" ") || transcriptionWithTimestamps.text || "";
    
    console.log(`📝 Transcript length: ${transcription.length} characters`);
    console.log(`📄 Preview: ${transcription.substring(0, 100)}...`);
    
    // Log timestamp info
    if (transcriptionWithTimestamps.segments && transcriptionWithTimestamps.segments.length > 0) {
      const firstSegment = transcriptionWithTimestamps.segments[0];
      const lastSegment = transcriptionWithTimestamps.segments[transcriptionWithTimestamps.segments.length - 1];
      console.log(`⏱️  First segment: ${firstSegment.start}s - ${firstSegment.end}s`);
      console.log(`⏱️  Last segment ends at: ${lastSegment.end}s`);
      console.log(`📊 Average segment length: ${(lastSegment.end / transcriptionWithTimestamps.segments.length).toFixed(2)}s`);
    }

    // Clean up temp file
    try {
      await fs.unlink(tempMp3Path);
      console.log("🗑️  Cleaned up temporary MP3 file");
    } catch (err) {
      console.warn("⚠️  Could not delete temp file:", err);
    }

    // Save transcript to public/data/transcripts/{id}_arabic.txt
    console.log("\n💾 Saving transcript files...");
    const transcriptsDir = path.join(process.cwd(), "public", "data", "transcripts");
    
    // Create transcripts directory if it doesn't exist
    try {
      await fs.mkdir(transcriptsDir, { recursive: true });
      console.log("📁 Created transcripts directory");
    } catch (err) {
      // Directory might already exist
    }

    // Save timestamped JSON version
    // Always set language to "arabic" since these are Arabic podcasts
    // (Whisper may auto-detect as "english" due to ads at the beginning)
    let timestampedData = {
      id,
      title: episode.title_arabic,
      duration: episode.duration_seconds,
      language: "arabic", // Hardcoded - these are Arabic podcasts
      transcription_duration: transcriptionWithTimestamps.duration,
      segments: transcriptionWithTimestamps.segments?.map(segment => ({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
      })) || [],
    };

    // Remove segments before "BBC News" appears (removes ads)
    console.log("\n🧹 Cleaning transcript: removing segments before 'BBC News'...");
    timestampedData = removeSegmentsBeforeBBCNews(timestampedData);

    // Update plain text transcript with cleaned segments
    const cleanedTranscription = timestampedData.segments
      .map(segment => segment.text)
      .join(" ");

    // Save cleaned plain text version
    const transcriptPath = path.join(transcriptsDir, `${id}_arabic.txt`);
    await fs.writeFile(transcriptPath, cleanedTranscription, "utf8");
    console.log(`✅ Cleaned plain text saved to: public/data/transcripts/${id}_arabic.txt`);

    // Save cleaned timestamped JSON version
    const timestampPath = path.join(transcriptsDir, `${id}_arabic_timestamps.json`);
    await fs.writeFile(timestampPath, JSON.stringify(timestampedData, null, 2), "utf8");
    console.log(`✅ Cleaned timestamped JSON saved to: public/data/transcripts/${id}_arabic_timestamps.json`);

    console.log("\n🎉 Transcription complete!");
    console.log(`📊 Summary:`);
    console.log(`   - Episode ID: ${id}`);
    console.log(`   - Episode Title: ${episode.title_arabic}`);
    console.log(`   - Duration: ${episode.duration_seconds}s`);
    console.log(`   - Original Transcript Length: ${transcription.length} chars`);
    console.log(`   - Cleaned Transcript Length: ${cleanedTranscription.length} chars`);
    console.log(`   - Original Segments: ${transcriptionWithTimestamps.segments?.length || 0}`);
    console.log(`   - Cleaned Segments: ${timestampedData.segments.length}`);
    console.log(`   - Files: ${id}_arabic.txt, ${id}_arabic_timestamps.json\n`);

    return NextResponse.json({
      success: true,
      id,
      title: episode.title_arabic,
      transcriptLength: cleanedTranscription.length,
      segmentCount: timestampedData.segments.length,
      transcript: cleanedTranscription,
      segments: timestampedData.segments,
      filePath: `public/data/transcripts/${id}_arabic.txt`,
      timestampFilePath: `public/data/transcripts/${id}_arabic_timestamps.json`,
    });

  } catch (error) {
    console.error("\n❌ Transcription error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    return NextResponse.json(
      { 
        error: "Failed to transcribe audio",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

