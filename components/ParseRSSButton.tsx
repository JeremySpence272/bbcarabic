import { RawPodcast } from "@/types/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ParseRSSButton({
  refreshLists,
}: {
  refreshLists: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);

  const handleParse = async () => {
    setIsLoading(true);
    setProgress(null);
    setProgressPercent(0);

    try {
      // Parse RSS feed
      setProgress("Fetching RSS feed...");
      setProgressPercent(25);
      const parseResponse = await fetch("/api/rss/parse");
      if (!parseResponse.ok) {
        throw new Error("Failed to parse RSS feed");
      }
      const newEpisodes: RawPodcast[] = await parseResponse.json();

      if (newEpisodes.length === 0) {
        setProgress("No new episodes found");
        setProgressPercent(100);
        setTimeout(() => {
          setIsLoading(false);
          setProgress(null);
          setProgressPercent(0);
        }, 1500);
        return;
      }

      setProgress(`Found ${newEpisodes.length} new episodes. Saving...`);
      setProgressPercent(75);

      // Write episodes to file
      const writeResponse = await fetch("/api/rss/write", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newEpisodes),
      });

      if (!writeResponse.ok) {
        throw new Error("Failed to save episodes");
      }

      setProgress(`Added ${newEpisodes.length} episodes!`);
      setProgressPercent(100);

      // Refresh the lists
      refreshLists();

      setTimeout(() => {
        setIsLoading(false);
        setProgress(null);
        setProgressPercent(0);
      }, 1500);
    } catch (error) {
      setProgress(error instanceof Error ? error.message : "An error occurred");
      setProgressPercent(0);
      setIsLoading(false);
      setTimeout(() => {
        setProgress(null);
      }, 3000);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleParse} disabled={isLoading} size="sm">
        {isLoading ? "Processing..." : "Parse RSS Feed"}
      </Button>
      {isLoading && progress && (
        <div className="flex-1 min-w-[200px] max-w-[300px]">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{progress}</p>
        </div>
      )}
      {!isLoading && progress && (
        <p className="text-sm text-muted-foreground">{progress}</p>
      )}
    </div>
  );
}
