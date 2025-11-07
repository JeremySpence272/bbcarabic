import { NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TextToProcess {
  title: string;
  description: string;
}

interface ProcessedItem {
  title: string;
  description: string;
  title_diacritics: string;
  description_diacritics: string;
}

interface DiacriticsResponse {
  diacriticTitle: string;
  diacriticDescription: string;
}

/**
 * POST /api/openai/diacritics
 * Adds Arabic diacritics (tashkeel) to text in batches
 */
export async function POST(request: Request) {
  try {
    const { textToProcess } = await request.json();

    if (!textToProcess || !Array.isArray(textToProcess) || textToProcess.length === 0) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    console.log(`\n🔄 Adding diacritics to ${textToProcess.length} items in batches of 3...`);

    // Process in batches of 3
    const BATCH_SIZE = 3;
    const allProcessed: DiacriticsResponse[] = [];
    const totalBatches = Math.ceil(textToProcess.length / BATCH_SIZE);

    for (let i = 0; i < textToProcess.length; i += BATCH_SIZE) {
      const batchItems = textToProcess.slice(i, i + BATCH_SIZE);
      const batchIndex = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`\n   📦 Batch ${batchIndex}/${totalBatches}: Processing ${batchItems.length} items...`);

      const processedBatch = await addDiacriticsBatch(batchItems);
      allProcessed.push(...processedBatch);

      console.log(`   ✓ Batch ${batchIndex}/${totalBatches} complete`);
    }

    console.log(`\n✅ Successfully added diacritics to all ${allProcessed.length} items!`);

    return NextResponse.json({ episodes: allProcessed });
  } catch (error) {
    console.error("Diacritics error:", error);
    return NextResponse.json(
      { error: "Failed to add diacritics" },
      { status: 500 }
    );
  }
}

/**
 * Add diacritics to a single batch
 */
async function addDiacriticsBatch(items: TextToProcess[]): Promise<DiacriticsResponse[]> {
  console.log(`      First item title: ${items[0].title.substring(0, 80)}...`);

  // Prepare data for processing
  const dataToProcess = items.map((item) => ({
    title: item.title,
    description: item.description,
  }));

  const dataJson = JSON.stringify(dataToProcess, null, 2);
  console.log(`      Characters to process: ${dataJson.length}`);

  const prompt = `Add proper Arabic diacritics (tashkeel/harakat) to the following text.
Add fatha (َ), kasra (ِ), damma (ُ), sukun (ْ), shadda (ّ), and tanween marks where appropriate. You don't need to add it to every single character. Just where needed to be able to phonetically sound out the correct pronunciation.
Ensure the diacritization is grammatically correct and helps with proper pronunciation.
These are BBC Arabic news podcast episode titles and descriptions.

Return a JSON array with the same structure, adding "title_diacritics" and "description_diacritics" fields.

Input:
${dataJson}

Return ONLY a valid JSON array with each object having: title, description, title_diacritics, description_diacritics`;

  try {
    console.log("      📡 Sending to OpenAI...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert in Arabic diacritics (tashkeel). Add proper diacritical marks to Arabic text for news and media content. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2, // Lower temperature for more consistent diacritization
      response_format: { type: "json_object" },
    });

    console.log("      ✓ Received response");

    // Parse response
    const result = response.choices[0].message.content?.trim() || "{}";
    const parsed = JSON.parse(result);

    // Handle different response formats
    let processedItems: ProcessedItem[] = [];
    if (Array.isArray(parsed)) {
      processedItems = parsed;
    } else if (typeof parsed === "object") {
      // Try to extract the array from common keys
      processedItems =
        parsed.items ||
        parsed.data ||
        parsed.results ||
        (Object.keys(parsed).length > 0 ? Object.values(parsed)[0] : []);
    }

    console.log(`      Extracted ${processedItems.length} items`);

    if (processedItems.length > 0 && processedItems[0].title_diacritics) {
      console.log(`      Sample: ${processedItems[0].title_diacritics.substring(0, 60)}...`);
    }

    // Map to the response format expected by openai.ts
    const resultItems: DiacriticsResponse[] = items.map((item, i) => {
      if (i < processedItems.length) {
        return {
          diacriticTitle: processedItems[i].title_diacritics || "",
          diacriticDescription: processedItems[i].description_diacritics || "",
        };
      } else {
        console.log(`      ⚠️  Item ${i + 1}: No diacritics found`);
        return {
          diacriticTitle: "",
          diacriticDescription: "",
        };
      }
    });

    return resultItems;
  } catch (error) {
    console.error("      ❌ Error:", error);
    // Return items without diacritics on error
    return items.map(() => ({
      diacriticTitle: "",
      diacriticDescription: "",
    }));
  }
}

