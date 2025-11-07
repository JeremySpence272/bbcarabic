import { NextResponse } from "next/server";
import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface TranscriptData {
  id: string;
  title: string;
  duration: string;
  language: string;
  transcription_duration: number;
  segments: Segment[];
}

/**
 * POST /api/openai/translate-transcript
 * Translates Arabic transcript segments to English while preserving timestamps
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

    console.log(`\n🌐 Starting transcript translation for episode ID: ${id}`);

    // Load the Arabic timestamps JSON
    console.log("📂 Loading Arabic transcript with timestamps...");
    const transcriptsDir = path.join(process.cwd(), "public", "data", "transcripts");
    const arabicTranscriptPath = path.join(transcriptsDir, `${id}_arabic_timestamps.json`);
    
    let transcriptData: TranscriptData;
    try {
      const fileContents = await fs.readFile(arabicTranscriptPath, "utf8");
      transcriptData = JSON.parse(fileContents);
    } catch (err) {
      console.log(`❌ Arabic transcript not found: ${arabicTranscriptPath}`);
      return NextResponse.json(
        { error: `Arabic transcript with ID "${id}" not found. Please transcribe it first.` },
        { status: 404 }
      );
    }

    console.log(`✅ Loaded Arabic transcript: ${transcriptData.title}`);
    console.log(`📊 Total segments to translate: ${transcriptData.segments.length}`);
    console.log(`⏱️  Total duration: ${transcriptData.transcription_duration}s`);

    // Translate segments in batches
    const BATCH_SIZE = 10; // Can process more segments at once since they're shorter
    const totalBatches = Math.ceil(transcriptData.segments.length / BATCH_SIZE);
    const translatedSegments: Segment[] = [];

    console.log(`\n🔄 Starting translation in ${totalBatches} batches...`);

    for (let i = 0; i < transcriptData.segments.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batch = transcriptData.segments.slice(i, i + BATCH_SIZE);
      
      console.log(`\n   📦 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} segments...`);
      console.log(`      Time range: ${batch[0].start.toFixed(1)}s - ${batch[batch.length - 1].end.toFixed(1)}s`);
      console.log(`      First segment: "${batch[0].text.substring(0, 50)}..."`);

      const translated = await translateSegmentBatch(batch, batchNum, totalBatches);
      translatedSegments.push(...translated);

      console.log(`   ✓ Batch ${batchNum}/${totalBatches} complete`);
    }

    console.log(`\n✅ All ${translatedSegments.length} segments translated!`);

    // Create the English transcript data with same metadata
    const englishTranscriptData: TranscriptData = {
      ...transcriptData,
      language: "en",
      segments: translatedSegments,
    };

    // Save the English timestamps JSON
    console.log("\n💾 Saving English transcript with timestamps...");
    const englishTranscriptPath = path.join(transcriptsDir, `${id}_english_timestamps.json`);
    await fs.writeFile(
      englishTranscriptPath,
      JSON.stringify(englishTranscriptData, null, 2),
      "utf8"
    );
    console.log(`✅ English transcript saved to: public/data/transcripts/${id}_english_timestamps.json`);

    console.log("\n🎉 Translation complete!");
    console.log(`📊 Summary:`);
    console.log(`   - Episode ID: ${id}`);
    console.log(`   - Episode Title: ${transcriptData.title}`);
    console.log(`   - Segments Translated: ${translatedSegments.length}`);
    console.log(`   - Total Duration: ${transcriptData.transcription_duration}s`);
    console.log(`   - Output File: ${id}_english_timestamps.json\n`);

    return NextResponse.json({
      success: true,
      id,
      title: transcriptData.title,
      segmentCount: translatedSegments.length,
      duration: transcriptData.transcription_duration,
      filePath: `public/data/transcripts/${id}_english_timestamps.json`,
    });

  } catch (error) {
    console.error("\n❌ Translation error:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    return NextResponse.json(
      { 
        error: "Failed to translate transcript",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * Translates a batch of segments using OpenAI
 */
async function translateSegmentBatch(
  segments: Segment[],
  batchNum: number,
  totalBatches: number
): Promise<Segment[]> {
  // Prepare the segments for translation (only the text)
  const textsToTranslate = segments.map((segment, idx) => ({
    segment_id: idx,
    text: segment.text.trim(),
  }));

  const dataJson = JSON.stringify(textsToTranslate, null, 2);
  console.log(`      📝 Characters to translate: ${dataJson.length}`);

  const prompt = `Translate these Arabic podcast transcript segments to English. These are timestamped segments from a BBC Arabic news podcast.
Maintain the natural flow and context. Translate contextually, not just word-for-word.
Each segment should be translated independently but keep in mind they are sequential parts of the same conversation.

Return a JSON array with the same structure, adding an "english_text" field to each segment.

Input:
${dataJson}

Return ONLY a valid JSON array with each object having: segment_id, text, english_text`;

  try {
    console.log("      📡 Sending to OpenAI...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional Arabic to English translator specializing in news and media. Return only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    console.log(`      ✓ Received response`);

    const result = response.choices[0].message.content?.trim();
    if (!result) {
      throw new Error("OpenAI response was empty.");
    }
    const parsed = JSON.parse(result);

    // Extract the translated items from the response
    const translatedItems = Array.isArray(parsed) ? parsed :
      parsed.translations || parsed.segments || parsed.items || parsed.data || (Object.values(parsed)[0] as any);

    if (!translatedItems || translatedItems.length === 0) {
      console.warn(`      ⚠️  No translations found in response, keeping original text`);
      return segments;
    }

    console.log(`      Extracted ${translatedItems.length} translated segments`);
    if (translatedItems[0] && 'english_text' in translatedItems[0]) {
      console.log(`      Sample translation: "${translatedItems[0].english_text.substring(0, 60)}..."`);
    }

    // Map the translations back to the segments with preserved metadata
    const resultSegments: Segment[] = segments.map((segment, idx) => {
      const translation = translatedItems.find((t: any) => t.segment_id === idx);
      return {
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: translation?.english_text || segment.text, // Use English text or fallback to Arabic
      };
    });

    return resultSegments;

  } catch (e) {
    console.error(`      ❌ Error translating batch: ${e}`);
    console.warn(`      ⚠️  Keeping original Arabic text for this batch`);
    // Return original segments if translation fails
    return segments;
  }
}

