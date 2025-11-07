"use client";

import { useState } from "react";

export default function TranslateFullEpisodeForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [id, setId] = useState<string>("");

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id.trim()) {
      setError("Please enter an episode ID");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log(`Starting full episode translation for ID: ${id}`);

      const response = await fetch("/api/openai/translate-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: id.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.details || "Failed to translate episode"
        );
      }

      console.log("Episode translation complete:", data);
      setResult(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      console.error("Translation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">
        Translate Full Episode Transcript
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Translate an already-transcribed episode from Arabic to English
        (preserving timestamps)
      </p>

      <form onSubmit={handleTranslate} className="space-y-4">
        <div>
          <label htmlFor="translate-episode-id" className="block mb-2">
            Episode ID:
          </label>
          <input
            id="translate-episode-id"
            name="id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="off"
            suppressHydrationWarning
            className="border p-2 rounded w-full"
            placeholder="e.g., p0mczk29"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-gray-300 hover:bg-green-600 transition"
        >
          {isLoading
            ? "Translating... (this may take 1-2 minutes)"
            : "🌐 Translate Episode"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-green-100 text-green-700 rounded">
            <strong>✅ Translation Complete!</strong>
          </div>

          <div className="border p-4 rounded space-y-3">
            <div>
              <h4 className="font-semibold text-sm text-gray-600">
                Episode Title:
              </h4>
              <p className="text-lg">{result.title}</p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-600">
                Segments Translated:
              </h4>
              <p>{result.segmentCount.toLocaleString()} segments</p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-600">
                Total Duration:
              </h4>
              <p>
                {result.duration}s ({Math.floor(result.duration / 60)} minutes)
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-600">Saved to:</h4>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                {result.filePath}
              </p>
            </div>

            <div className="text-xs text-gray-500 mt-3 p-3 bg-blue-50 rounded">
              <p className="font-semibold mb-1">✨ What was created:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>English transcript with all timestamps preserved</li>
                <li>Same segment structure as Arabic version</li>
                <li>Ready for synchronized playback</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="mt-4 p-4 bg-blue-100 text-blue-700 rounded">
          <strong>🌐 Translating transcript segments...</strong>
          <p className="text-sm mt-1">
            Processing segments in batches. Check the console for detailed
            progress updates.
          </p>
          <div className="mt-2 text-xs">
            <p>Expected time: 1-2 minutes for a typical episode</p>
            <p>Batch size: 10 segments at a time</p>
          </div>
        </div>
      )}
    </div>
  );
}
