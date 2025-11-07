import { Podcast, RawPodcast } from "@/types/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ParseRSSButton({
  refreshLists,
}: {
  refreshLists: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const handleParseAndTranslate = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setProgress(null);

    try {
      // Step 1: Parse RSS feed
      setProgress("📥 Fetching RSS feed and parsing new episodes...");
      const parseResponse = await fetch("/api/rss/parse");
      if (!parseResponse.ok) {
        throw new Error("Failed to parse RSS feed");
      }
      const newEpisodes: RawPodcast[] = await parseResponse.json();

      if (newEpisodes.length === 0) {
        setSuccess("No new episodes found!");
        setIsLoading(false);
        return;
      }

      setProgress(
        `✅ Found ${newEpisodes.length} new episodes. Translating...`
      );

      // Step 2: Translate episodes
      const translateResponse = await fetch("/api/openai/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ episodes: newEpisodes }),
      });

      if (!translateResponse.ok) {
        throw new Error("Failed to translate episodes");
      }
      const translatedEpisodes: Podcast[] = await translateResponse.json();

      setProgress(
        `✅ Translation complete. Saving ${translatedEpisodes.length} episodes...`
      );

      // Step 3: Write translated episodes to file
      const writeResponse = await fetch("/api/rss/write", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(translatedEpisodes),
      });

      if (!writeResponse.ok) {
        throw new Error("Failed to save episodes");
      }

      const writeData = await writeResponse.json();
      setSuccess(
        `✅ Successfully added ${translatedEpisodes.length} new episodes with translations!`
      );
      setProgress(null);

      // Refresh the lists
      refreshLists();
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleParseAndTranslate}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? "Processing..." : "Parse & Translate RSS Feed"}
      </Button>
      {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
    </div>
  );
}
