import { promises as fs } from "fs";
import path from "path";
import { Podcast, RawPodcast } from "@/types/types";

const EPISODES_FILE_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  "latest_episodes.json"
);

/**
 * Load episodes from the JSON file
 */
export async function loadEpisodes(): Promise<(Podcast | RawPodcast)[]> {
  try {
    const fileContents = await fs.readFile(EPISODES_FILE_PATH, "utf8");
    return JSON.parse(fileContents);
  } catch (err) {
    // File doesn't exist yet, return empty array
    return [];
  }
}

/**
 * Save episodes to the JSON file
 */
export async function saveEpisodes(
  episodes: (Podcast | RawPodcast)[]
): Promise<void> {
  await fs.writeFile(
    EPISODES_FILE_PATH,
    JSON.stringify(episodes, null, 2),
    "utf8"
  );
}

/**
 * Add new episodes to the file (prepends them, newest first)
 */
export async function addEpisodes(
  newEpisodes: (Podcast | RawPodcast)[]
): Promise<void> {
  const existing = await loadEpisodes();
  const updated = [...newEpisodes, ...existing];
  await saveEpisodes(updated);
}

