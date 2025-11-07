"use client";

import { useState } from "react";

export default function TranscribeForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [id, setId] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<any>(null);

  const handleTranscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id.trim()) {
      setError("Please enter an episode ID");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log(`Starting transcription for ID: ${id}`);

      const response = await fetch("/api/openai/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: id.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to transcribe");
      }

      console.log("Transcription complete:", data);
      setResult(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      console.error("Transcription error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslateTranscript = async () => {
    if (!result?.id) {
      setError("No transcription to translate");
      return;
    }

    setIsTranslating(true);
    setError(null);
    setTranslationResult(null);

    try {
      console.log(`Starting transcript translation for ID: ${result.id}`);

      const response = await fetch("/api/openai/translate-transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: result.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.details || "Failed to translate transcript"
        );
      }

      console.log("Transcript translation complete:", data);
      setTranslationResult(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred during translation"
      );
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">Transcribe Episode</h2>

      <form onSubmit={handleTranscribe} className="space-y-4">
        <div>
          <label htmlFor="transcribe-id" className="block mb-2">
            Episode ID:
          </label>
          <input
            id="transcribe-id"
            name="id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="off"
            suppressHydrationWarning
            className="border p-2 rounded w-full"
            placeholder="e.g., p0mdfhwv"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="bg-purple-500 text-white px-4 py-2 rounded disabled:bg-gray-300 hover:bg-purple-600 transition"
        >
          {isLoading
            ? "Transcribing... (this may take a minute)"
            : "Transcribe Audio"}
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
            <strong>✅ Transcription Complete!</strong>
          </div>

          <div className="border p-4 rounded space-y-3">
            <div>
              <h4 className="font-semibold text-sm text-gray-600">
                Episode Title:
              </h4>
              <p className="text-lg">{result.title}</p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-600">Saved to:</h4>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                {result.filePath}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-600">
                Transcript Length:
              </h4>
              <p>{result.transcriptLength.toLocaleString()} characters</p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-600">Segments:</h4>
              <p>
                {result.segmentCount} sentence-level segments with timestamps
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Saved to: {result.timestampFilePath}
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-600">
                Transcript Preview:
              </h4>
              <div className="bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">
                  {result.transcript.substring(0, 500)}
                  {result.transcript.length > 500 && "..."}
                </p>
              </div>
            </div>

            {result.segments && result.segments.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-600">
                  Sample Timestamped Segments:
                </h4>
                <div className="bg-gray-50 p-3 rounded max-h-60 overflow-y-auto space-y-2">
                  {result.segments.slice(0, 5).map((segment: any) => (
                    <div key={segment.id} className="text-xs border-b pb-2">
                      <span className="font-mono text-blue-600">
                        [{segment.start.toFixed(2)}s - {segment.end.toFixed(2)}
                        s]
                      </span>
                      <p className="mt-1">{segment.text}</p>
                    </div>
                  ))}
                  {result.segments.length > 5 && (
                    <p className="text-xs text-gray-500 italic">
                      ... and {result.segments.length - 5} more segments
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result.transcript);
                  alert("Transcript copied to clipboard!");
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
              >
                Copy Full Transcript
              </button>

              <button
                onClick={() => {
                  const jsonData = JSON.stringify(result.segments, null, 2);
                  navigator.clipboard.writeText(jsonData);
                  alert("Timestamped segments copied to clipboard!");
                }}
                className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition"
              >
                Copy Timestamps JSON
              </button>

              <button
                onClick={handleTranslateTranscript}
                disabled={isTranslating}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition disabled:bg-gray-300"
              >
                {isTranslating
                  ? "Translating Transcript..."
                  : "🌐 Translate to English"}
              </button>
            </div>
          </div>
        </div>
      )}

      {translationResult && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="text-lg font-bold text-green-800 mb-2">
            ✅ Translation Complete!
          </h3>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Segments Translated:</strong>{" "}
              {translationResult.segmentCount}
            </p>
            <p>
              <strong>Duration:</strong> {translationResult.duration}s
            </p>
            <p>
              <strong>Saved to:</strong>
            </p>
            <p className="font-mono text-xs bg-white p-2 rounded">
              {translationResult.filePath}
            </p>
            <p className="text-green-700 mt-2">
              Your transcript has been translated to English with all timestamps
              preserved!
            </p>
          </div>
        </div>
      )}

      {isTranslating && (
        <div className="mt-4 p-4 bg-blue-100 text-blue-700 rounded">
          <strong>🌐 Translating transcript segments...</strong>
          <p className="text-sm mt-1">
            Processing segments in batches. This may take 1-2 minutes. Check the
            console for progress updates.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="mt-4 p-4 bg-blue-100 text-blue-700 rounded">
          <strong>🎙️ Transcribing audio...</strong>
          <p className="text-sm mt-1">
            This may take 1-2 minutes depending on the audio length. Check the
            console for progress updates.
          </p>
        </div>
      )}
    </div>
  );
}
