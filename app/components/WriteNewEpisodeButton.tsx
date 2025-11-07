import { useRouter } from "next/navigation";
import { RawPodcast } from "@/types/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function WriteNewEpisodeButton({
  newEpisodes,
  refreshLists,
}: {
  newEpisodes: RawPodcast[];
  refreshLists: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWrite = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rss/write", {
        method: "POST",
        body: JSON.stringify(newEpisodes),
      });
      if (!response.ok) {
        throw new Error("Failed to write new episodes to file");
      }
      const data = await response.json();
      console.log(data);
      refreshLists();
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="space-y-2">
      <Button onClick={handleWrite} disabled={isLoading} className="w-full">
        {isLoading ? "Saving..." : `Save ${newEpisodes.length} Episodes`}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
