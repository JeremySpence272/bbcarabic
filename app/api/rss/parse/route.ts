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

import { NextResponse } from 'next/server';
import { fetchRSSFeed, parseRSSFeed } from '@/lib/rss';
import { Podcast } from '@/types/types';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Fetch the RSS feed
    const rssXML = await fetchRSSFeed();
    
    // Load existing episodes from JSON file
    let existingEpisodes: Podcast[] = [];
    try {
      const filePath = path.join(process.cwd(), 'public', 'data', 'latest_episodes.json');
      const fileContents = await fs.readFile(filePath, 'utf8');
      existingEpisodes = JSON.parse(fileContents);
    } catch (err) {
      console.warn('Could not load existing episodes:', err);
      // Continue with empty array if file doesn't exist
    }
    
    // Parse RSS and get only new episodes
    const newEpisodes = parseRSSFeed(rssXML, existingEpisodes);
    
    return NextResponse.json(newEpisodes);
  } catch (error) {
    console.error('Error parsing RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to parse RSS feed' },
      { status: 500 }
    );
  }
}


