import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { removeSegmentsBeforeBBCNews } from "@/lib/transcript-cleaner";

interface TranscriptData {
  id: string;
  title: string;
  duration: string;
  language: string;
  transcription_duration: number;
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * Clean transcripts function - shared between GET and POST
 */
async function cleanAllTranscripts() {
  try {
    console.log("\n🧹 Starting bulk transcript cleanup...");
    
    const transcriptsDir = path.join(process.cwd(), "public", "data", "transcripts");
    
    // Read all files in the transcripts directory
    let files: string[];
    try {
      files = await fs.readdir(transcriptsDir);
    } catch (err) {
      console.error("❌ Transcripts directory not found:", err);
      return NextResponse.json(
        { error: "Transcripts directory not found" },
        { status: 404 }
      );
    }

    // Filter for Arabic timestamp JSON files only
    const arabicTranscriptFiles = files.filter(file => 
      file.endsWith("_arabic_timestamps.json")
    );

    console.log(`📊 Found ${arabicTranscriptFiles.length} Arabic transcript files to process\n`);

    const results = {
      processed: 0,
      cleaned: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{
        id: string;
        originalSegments: number;
        cleanedSegments: number;
        removed: number;
        status: "cleaned" | "skipped" | "error";
      }>,
    };

    for (const filename of arabicTranscriptFiles) {
      try {
        const filePath = path.join(transcriptsDir, filename);
        
        // Extract episode ID from filename
        const match = filename.match(/^(.+?)_arabic_timestamps\.json$/);
        if (!match) {
          console.warn(`⚠️  Skipping invalid filename: ${filename}`);
          results.skipped++;
          continue;
        }
        
        const episodeId = match[1];
        console.log(`\n📄 Processing: ${filename} (ID: ${episodeId})`);

        // Read the transcript file
        const fileContents = await fs.readFile(filePath, "utf8");
        const transcriptData: TranscriptData = JSON.parse(fileContents);

        const originalSegmentCount = transcriptData.segments.length;

        // Use the cleaner function which handles first-half logic and both patterns
        const cleanedData = removeSegmentsBeforeBBCNews(transcriptData);
        
        // Check if cleaning actually happened
        if (cleanedData.segments.length === originalSegmentCount) {
          console.log(`   ⏭️  Skipped: No cleaning needed`);
          results.skipped++;
          results.details.push({
            id: episodeId,
            originalSegments: originalSegmentCount,
            cleanedSegments: originalSegmentCount,
            removed: 0,
            status: "skipped",
          });
          results.processed++;
          continue;
        }

        // Get the cutoff start time from the first segment of cleaned data
        const cutoffStartTime = cleanedData.segments[0]?.start || 0;
        const cutoffSegmentIndex = originalSegmentCount - cleanedData.segments.length;
        console.log(`   📍 Using cutoff at segment ${cutoffSegmentIndex}, start time: ${cutoffStartTime.toFixed(1)}s`);

        // Arabic transcript is already cleaned by removeSegmentsBeforeBBCNews
        const cleanedSegmentCount = cleanedData.segments.length;
        const removedCount = originalSegmentCount - cleanedSegmentCount;

        // Update the Arabic transcript file
        await fs.writeFile(
          filePath,
          JSON.stringify(cleanedData, null, 2),
          "utf8"
        );

        // Also update the Arabic plain text file
        const plainTextPath = path.join(transcriptsDir, `${episodeId}_arabic.txt`);
        const cleanedPlainText = cleanedData.segments
          .map(segment => segment.text)
          .join(" ");
        
        await fs.writeFile(plainTextPath, cleanedPlainText, "utf8");

        console.log(`   ✅ Arabic: Removed ${removedCount} segments (${originalSegmentCount} → ${cleanedSegmentCount})`);

        // Now clean the English transcript using the same cutoff start time
        const englishFilePath = path.join(transcriptsDir, `${episodeId}_english_timestamps.json`);
        let englishCleaned = false;
        let englishRemovedCount = 0;
        let englishOriginalCount = 0;

        try {
          // Check if English transcript exists
          const englishFileContents = await fs.readFile(englishFilePath, "utf8");
          const englishTranscriptData: TranscriptData = JSON.parse(englishFileContents);
          
          englishOriginalCount = englishTranscriptData.segments.length;

          // Remove all segments that start before the cutoff time
          const englishCleanedSegments = englishTranscriptData.segments.filter(
            segment => segment.start >= cutoffStartTime
          );

          if (englishCleanedSegments.length < englishOriginalCount) {
            englishRemovedCount = englishOriginalCount - englishCleanedSegments.length;

            // Re-number the English segments
            const renumberedEnglishSegments = englishCleanedSegments.map((segment, index) => ({
              ...segment,
              id: index,
            }));

            // Update the English transcript
            const englishCleanedData: TranscriptData = {
              ...englishTranscriptData,
              segments: renumberedEnglishSegments,
            };

            await fs.writeFile(
              englishFilePath,
              JSON.stringify(englishCleanedData, null, 2),
              "utf8"
            );

            console.log(`   ✅ English: Removed ${englishRemovedCount} segments (${englishOriginalCount} → ${renumberedEnglishSegments.length})`);
            englishCleaned = true;
          } else {
            console.log(`   ℹ️  English: No segments to remove (already clean)`);
          }
        } catch (err) {
          // English transcript doesn't exist or error reading it - that's okay
          console.log(`   ℹ️  English transcript not found or error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        
        results.cleaned++;
        results.details.push({
          id: episodeId,
          originalSegments: originalSegmentCount + (englishCleaned ? englishOriginalCount : 0),
          cleanedSegments: cleanedSegmentCount + (englishCleaned ? (englishOriginalCount - englishRemovedCount) : 0),
          removed: removedCount + englishRemovedCount,
          status: "cleaned",
        });

        results.processed++;

      } catch (err) {
        console.error(`   ❌ Error processing ${filename}:`, err);
        results.errors++;
        results.details.push({
          id: filename,
          originalSegments: 0,
          cleanedSegments: 0,
          removed: 0,
          status: "error",
        });
      }
    }

    console.log("\n🎉 Bulk cleanup complete!");
    console.log(`📊 Summary:`);
    console.log(`   - Processed: ${results.processed} files`);
    console.log(`   - Cleaned: ${results.cleaned} files`);
    console.log(`   - Skipped: ${results.skipped} files`);
    console.log(`   - Errors: ${results.errors} files\n`);

    return NextResponse.json({
      success: true,
      summary: {
        processed: results.processed,
        cleaned: results.cleaned,
        skipped: results.skipped,
        errors: results.errors,
      },
      details: results.details,
    });

  } catch (error) {
    console.error("\n❌ Bulk cleanup error:", error);
    return NextResponse.json(
      {
        error: "Failed to clean transcripts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transcripts/clean-all
 * Cleans all existing Arabic transcript files by removing segments before "BBC News"
 */
export async function GET() {
  return cleanAllTranscripts();
}

/**
 * POST /api/transcripts/clean-all
 * Cleans all existing Arabic transcript files by removing segments before "BBC News"
 */
export async function POST() {
  return cleanAllTranscripts();
}

