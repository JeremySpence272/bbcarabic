import { NextResponse } from "next/server";
import OpenAI from "openai";
import { RawPodcast, Podcast
 } from "@/types/types";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TranslateItem {
  title: string;
  description: string;
}

interface TranslatedItem extends TranslateItem {
  title_en: string;
  description_en: string;
}

/**
 * POST /api/openai/translate
 * Translates Arabic podcast episodes to English in batches
 */
export async function POST(request: Request) {
  try {
    const { episodes } = await request.json();

    if (!episodes || !Array.isArray(episodes) || episodes.length === 0) {
      return NextResponse.json(
        { error: "No episodes provided" },
        { status: 400 }
      );
    }

    console.log(`\n🔄 Starting translation of ${episodes.length} items in batches of 3...`);

    // Translate in batches of 3
    const BATCH_SIZE = 3;
    const allTranslated: RawPodcast[] = [];
    const totalBatches = Math.ceil(episodes.length / BATCH_SIZE);

    for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
      const batchEpisodes = episodes.slice(i, i + BATCH_SIZE);
      const batchIndex = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`\n   📦 Batch ${batchIndex}/${totalBatches}: Processing ${batchEpisodes.length} items...`);

      const translatedBatch = await translateBatch(batchEpisodes);
      allTranslated.push(...translatedBatch);

      console.log(`   ✓ Batch ${batchIndex}/${totalBatches} complete`);
    }

    console.log(`\n✅ Successfully translated all ${allTranslated.length} items!`);

    return NextResponse.json(allTranslated);
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Failed to translate episodes" },
      { status: 500 }
    );
  }
}

/**
 * Translate a single batch of episodes
 */
async function translateBatch(episodes: RawPodcast[]): Promise<RawPodcast[]> {
  console.log(`      First item title: ${episodes[0].title_arabic.substring(0, 80)}...`);

  // Prepare data for translation
  const dataToTranslate: TranslateItem[] = episodes.map((ep) => ({
    title: ep.title_arabic,
    description: ep.description_arabic,
  }));

  const dataJson = JSON.stringify(dataToTranslate, null, 2);
  console.log(`      Characters to translate: ${dataJson.length}`);

  const prompt = `Translate these Arabic podcast episode titles and descriptions to English. Make sure that you translate contextually to maintain the same meaning of the arabic text, not just word for word translations.
Return a JSON array with the same structure, adding "title_en" and "description_en" fields.
Maintain context and natural readability. These are BBC Arabic news podcast episodes.

Input:
${dataJson}

Return ONLY a valid JSON array with each object having: title, description, title_en, description_en`;

  try {
    console.log("      📡 Sending to OpenAI...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional Arabic to English translator specializing in news and media. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    console.log("      ✓ Received response");

    // Parse response
    const result = response.choices[0].message.content?.trim() || "{}";
    const parsed = JSON.parse(result);

    // Handle different response formats
    let translatedItems: TranslatedItem[] = [];
    if (Array.isArray(parsed)) {
      translatedItems = parsed;
    } else if (typeof parsed === "object") {
      // Try to extract the array from common keys
      translatedItems =
        parsed.translations ||
        parsed.items ||
        parsed.episodes ||
        parsed.data ||
        (Object.keys(parsed).length > 0 ? Object.values(parsed)[0] : []);
    }

    console.log(`      Extracted ${translatedItems.length} items`);

    if (translatedItems.length > 0 && translatedItems[0].title_en) {
      console.log(`      Sample: ${translatedItems[0].title_en.substring(0, 60)}...`);
    }

    // Merge translations back into original episodes
    const resultEpisodes: RawPodcast[] = episodes.map((episode, i) => {
      if (i < translatedItems.length) {
        return {
          ...episode,
          title_english: translatedItems[i].title_en || "",
          description_english: translatedItems[i].description_en || "",
        };
      } else {
        console.log(`      ⚠️  Item ${i + 1}: No translation found`);
        return {
          ...episode,
          title_english: "",
          description_english: "",
        };
      }
    });

    return resultEpisodes;
  } catch (error) {
    console.error("      ❌ Error:", error);
    // Return episodes without translation on error
    return episodes.map((ep) => ({
      ...ep,
      title_english: "",
      description_english: "",
    }));
  }
}

