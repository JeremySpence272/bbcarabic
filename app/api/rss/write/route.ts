import { NextResponse } from "next/server";
import { RawPodcast, Podcast } from "@/types/types";
import { addEpisodes, loadEpisodes } from "@/lib/episodes";

/**
 * POST /api/rss/write
 * Adds new episodes to the episodes file (prepends them, newest first)
 */
export async function POST(request: Request) {
  try {
    const newEpisodes: (RawPodcast | Podcast)[] = await request.json();

    if (!Array.isArray(newEpisodes) || newEpisodes.length === 0) {
      return NextResponse.json(
        { error: "No episodes provided" },
        { status: 400 }
      );
    }

    await addEpisodes(newEpisodes);
    const allEpisodes = await loadEpisodes();

    return NextResponse.json({
      message: `Successfully added ${newEpisodes.length} new episodes`,
      totalEpisodes: allEpisodes.length,
    });
  } catch (error) {
    console.error("Error writing episodes:", error);
    return NextResponse.json(
      { error: "Failed to write episodes to file" },
      { status: 500 }
    );
  }
}