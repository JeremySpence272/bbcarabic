import { NextResponse } from "next/server";
import { RawPodcast, Podcast } from "@/types/types";
import { promises as fs } from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const newEpisodes: (RawPodcast | Podcast)[] = await request.json();
    const filePath = path.join(process.cwd(), "public", "data", "latest_episodes.json");
    
    // Load existing episodes
    let existingEpisodes: (RawPodcast | Podcast)[] = [];
    try {
      const fileContents = await fs.readFile(filePath, "utf8");
      existingEpisodes = JSON.parse(fileContents);
    } catch (err) {
      console.warn("No existing episodes file found, creating new one");
    }
    
    // Prepend new episodes to the existing ones (newest first)
    const updatedEpisodes = [...newEpisodes, ...existingEpisodes];
    
    // Write back to file
    await fs.writeFile(filePath, JSON.stringify(updatedEpisodes, null, 2), "utf8");
    
    return NextResponse.json({ 
      message: `Successfully added ${newEpisodes.length} new episodes`,
      totalEpisodes: updatedEpisodes.length
    });
  } catch (error) {
    console.error("Error writing episodes:", error);
    return NextResponse.json(
      { error: "Failed to write episodes to file" },
      { status: 500 }
    );
  }
}