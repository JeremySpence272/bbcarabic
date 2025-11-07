import { NextResponse } from "next/server";
import { Podcast } from "@/types/types";
import { promises as fs } from "fs";
import path from "path";

/**
 * POST /api/episodes/update
 * Updates episodes in the latest_episodes.json file
 * Merges new data with existing episodes based on ID
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

    const filePath = path.join(process.cwd(), "public", "data", "latest_episodes.json");
    
    // Load existing episodes
    let allEpisodes: Podcast[] = [];
    try {
      const fileContents = await fs.readFile(filePath, "utf8");
      allEpisodes = JSON.parse(fileContents);
    } catch (err) {
      console.warn("No existing episodes file found");
      return NextResponse.json(
        { error: "Episodes file not found" },
        { status: 404 }
      );
    }

    // Create a map of updated episodes by ID
    const updatedEpisodesMap = new Map(
      episodes.map((ep: Podcast) => [ep.id, ep])
    );

    // Update existing episodes with new data
    allEpisodes = allEpisodes.map((episode) => {
      if (updatedEpisodesMap.has(episode.id)) {
        // Merge the updated data with existing episode
        return { ...episode, ...updatedEpisodesMap.get(episode.id) };
      }
      return episode;
    });

    // Write back to file
    await fs.writeFile(filePath, JSON.stringify(allEpisodes, null, 2), "utf8");

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${episodes.length} episodes`,
      updatedIds: episodes.map((ep: Podcast) => ep.id),
    });
  } catch (error) {
    console.error("Error updating episodes:", error);
    return NextResponse.json(
      { error: "Failed to update episodes" },
      { status: 500 }
    );
  }
}

