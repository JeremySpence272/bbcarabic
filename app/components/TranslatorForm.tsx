"use client";

import { useState } from "react";
import { translateToEnglish } from "@/lib/openai";
import { RawPodcast, Podcast } from "@/types/types";

export default function TranslatorForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translatedData, setTranslatedData] = useState<Podcast[] | null>(null);
  const [id, setId] = useState<string>("");

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id.trim()) {
      setError("Please enter an episode ID");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTranslatedData(null);

    try {
      // Fetch the episode from latest_episodes.json
      const response = await fetch("/data/latest_episodes.json");
      const allEpisodes: RawPodcast[] = await response.json();

      // Find the episode by ID
      const episode = allEpisodes.find((ep) => ep.id === id.trim());

      if (!episode) {
        throw new Error(`Episode with ID "${id}" not found`);
      }

      console.log("Found episode:", episode.title_arabic);

      // Translate the episode (includes diacritics)
      const translatedEpisodes = await translateToEnglish([episode]);

      // Update the episode in the JSON file
      const updateResponse = await fetch("/api/episodes/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ episodes: translatedEpisodes }),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update episode in JSON file");
      }

      console.log("Episode updated in JSON file");

      setTranslatedData(translatedEpisodes);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      console.error("Translation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">Translate Episode</h2>

      <form onSubmit={handleTranslate} className="space-y-4">
        <div>
          <label htmlFor="id" className="block mb-2">
            Episode ID (e.g., p0mdfhwv):
          </label>
          <input
            id="id"
            name="id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="off"
            suppressHydrationWarning
            className="border p-2 rounded w-full"
            placeholder="Enter episode ID"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
        >
          {isLoading ? "Translating & Adding Diacritics..." : "Translate"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {translatedData && translatedData.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-bold">Translation Results:</h3>

          {translatedData.map((episode, index) => (
            <div key={index} className="border p-4 rounded space-y-3">
              <div>
                <h4 className="font-semibold text-sm text-gray-600">
                  Original Arabic Title:
                </h4>
                <p className="text-lg">{episode.title_arabic}</p>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-600">
                  Arabic Title with Diacritics:
                </h4>
                <p className="text-lg text-blue-600">
                  {episode.title_arabic_diacritics}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-600">
                  English Translation:
                </h4>
                <p className="text-lg text-green-600">
                  {episode.title_english}
                </p>
              </div>

              <hr className="my-3" />

              <div>
                <h4 className="font-semibold text-sm text-gray-600">
                  Original Arabic Description:
                </h4>
                <p className="text-sm">{episode.description_arabic}</p>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-600">
                  Arabic Description with Diacritics:
                </h4>
                <p className="text-sm text-blue-600">
                  {episode.description_arabic_diacritics}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-sm text-gray-600">
                  English Description:
                </h4>
                <p className="text-sm text-green-600">
                  {episode.description_english}
                </p>
              </div>

              <div className="text-xs text-gray-500 mt-3">
                <p>
                  <strong>Episode ID:</strong> {episode.id}
                </p>
                <p>
                  <strong>Published:</strong> {episode.published}
                </p>
                <p>
                  <strong>Duration:</strong> {episode.duration_seconds} seconds
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
