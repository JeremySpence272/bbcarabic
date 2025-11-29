// app/api/rss/parse/route.ts
// parse the rss feed and return the latest episodes
// only return the new episodes not already in the latest_episodes.json file
// need to extract the following information:
// - title_arabic
// - description_arabic
// - mp3_url
// - published
// - duration_seconds
// - id (the final part of the mp3_url)
// return the new episodes in a json array
// if there are no new episodes, return an empty array
// if there is an error, return an error message

import { NextResponse } from "next/server";
import { fetchRSSFeed, parseRSSFeed } from "@/lib/rss";
import { loadEpisodes } from "@/lib/episodes";
import { Podcast } from "@/types/types";

/**
 * GET /api/rss/parse
 * Parses the RSS feed and returns only new episodes not already in the file
 */
export async function GET() {
  try {
    const rssXML = await fetchRSSFeed();
    const existingEpisodes = (await loadEpisodes()) as Podcast[];
    const newEpisodes = parseRSSFeed(rssXML, existingEpisodes);
    return NextResponse.json(newEpisodes);
  } catch (error) {
    console.error("Error parsing RSS feed:", error);
    return NextResponse.json(
      { error: "Failed to parse RSS feed" },
      { status: 500 }
    );
  }
}


