"use client";

import { useState } from "react";
import { translateToEnglish } from "@/lib/openai";
import { RawPodcast, Podcast } from "@/types/types";

export default function TranslateAllButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleTranslateAll = async () => {
    setIsLoading(true);
    setError(null);
    setProgress(null);
    setResult(null);

    try {
      setProgress("Loading episodes...");

      // Fetch all episodes from latest_episodes.json
      const response = await fetch("/data/latest_episodes.json");
      const allEpisodes: (RawPodcast | Podcast)[] = await response.json();

      // Filter for episodes without title_english
      const untranslatedEpisodes = allEpisodes.filter(
        (ep): ep is RawPodcast => !("title_english" in ep) || !ep.title_english
      );

      if (untranslatedEpisodes.length === 0) {
        setResult("All episodes are already translated!");
        return;
      }

      setProgress(
        `Found ${untranslatedEpisodes.length} untranslated episodes. Preparing to translate...`
      );
      console.log(`Translating ${untranslatedEpisodes.length} episodes...`);

      // Process in batches of 3 to show progress
      const BATCH_SIZE = 3;
      const totalBatches = Math.ceil(untranslatedEpisodes.length / BATCH_SIZE);
      const allTranslated: Podcast[] = [];

      for (let i = 0; i < untranslatedEpisodes.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const batch = untranslatedEpisodes.slice(i, i + BATCH_SIZE);

        setProgress(
          `📝 Translating batch ${batchNum}/${totalBatches} (${batch.length} episodes)...\n` +
            `Episode titles: ${batch
              .map((ep) => ep.title_arabic.substring(0, 40) + "...")
              .join(" | ")}`
        );

        // Translate this batch (includes both translation and diacritics)
        const translated = await translateToEnglish(batch);
        allTranslated.push(...translated);

        setProgress(
          `✅ Completed batch ${batchNum}/${totalBatches}\n` +
            `Progress: ${allTranslated.length}/${untranslatedEpisodes.length} episodes translated`
        );

        // Small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < untranslatedEpisodes.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setProgress(
        `🎉 All ${allTranslated.length} episodes translated! Now updating JSON file...`
      );

      // Update the episodes in the JSON file
      setProgress("💾 Saving translations to JSON file...");

      const updateResponse = await fetch("/api/episodes/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ episodes: allTranslated }),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update episodes in JSON file");
      }

      const updateResult = await updateResponse.json();
      console.log("Update result:", updateResult);

      setResult(
        `✅ Successfully translated and updated ${allTranslated.length} episodes!\n` +
          `📊 Total batches processed: ${totalBatches}\n` +
          `🌐 English translations added\n` +
          `📝 Arabic diacritics added`
      );
      setProgress(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      console.error("Translation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded bg-gray-50">
      <h3 className="text-lg font-bold mb-2">Batch Translation</h3>
      <p className="text-sm text-gray-600 mb-4">
        Translate all episodes that don't have English translations yet.
      </p>

      <button
        onClick={handleTranslateAll}
        disabled={isLoading}
        className="bg-green-500 text-white px-6 py-3 rounded font-semibold disabled:bg-gray-300 hover:bg-green-600 transition"
      >
        {isLoading ? "Translating..." : "Translate All Untranslated Episodes"}
      </button>

      {progress && (
        <div className="mt-4 p-3 bg-blue-100 text-blue-700 rounded">
          <strong>Progress:</strong>
          <div className="whitespace-pre-line mt-1">{progress}</div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded font-semibold">
          <div className="whitespace-pre-line">{result}</div>
        </div>
      )}
    </div>
  );
}
