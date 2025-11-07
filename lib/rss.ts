import { Podcast, RawPodcast } from "@/types/types";
import path from "path";
import { promises as fs } from 'fs';

// BBC Arabic Podcast RSS Feed URL
export const BBC_ARABIC_RSS_URL = 'https://podcasts.files.bbci.co.uk/p0h6d6nm.rss';

/**
 * Fetches the latest RSS feed from BBC Arabic Podcast
 * @returns Raw RSS XML string
 */
export async function fetchRSSFeed(): Promise<string> {
  const response = await fetch(BBC_ARABIC_RSS_URL, {
    // Revalidate every 15 minutes
    next: { revalidate: 900 }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Extracts episode ID from mp3 URL
 * Example: "http://...vpid/p0mcfcpy.mp3" -> "p0mcfcpy"
 */
function extractIdFromMp3Url(mp3Url: string): string {
  const match = mp3Url.match(/vpid\/([^.]+)\.mp3/);
  return match ? match[1] : '';
}

/**
 * Extracts text content from CDATA sections
 */
function extractTextFromCDATA(text: string): string {
  // Remove CDATA tags
  let cleaned = text.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  // Decode HTML entities
  cleaned = cleaned
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return cleaned.trim();
}

/**
 * Removes boilerplate footer text from podcast descriptions
 * Strips everything from "استمعوا إلى بودكاست" onwards
 */
function cleanDescription(description: string): string {
  // Pattern to match the standard footer text that appears in all episodes
  // This includes variations like:
  // - استمعوا إلى بودكاست "يستحق الانتباه"
  // - استمعوا إلى بودكاست يستحق الانتباه
  // Use a regex that does not require the /s flag for compatibility.
  // Matches everything from 'استمعوا إلى بودكاست' to the end of the string (including newlines)
  const footerPattern = /استمعوا إلى بودكاست[\s\S]*/;
  
  // Remove the footer and everything after it
  const cleaned = description.replace(footerPattern, '').trim();
  return cleaned;
}

/**
 * Parses RSS feed XML and extracts episode information
 * @param rssXML - Raw RSS XML string
 * @param existingEpisodes - Array of existing episodes to check against
 * @returns Array of new episodes not in existingEpisodes
 */
export function parseRSSFeed(
  rssXML: string,
  existingEpisodes: Podcast[] = []
): RawPodcast[] {
  const episodes: RawPodcast[] = [];
  
  // Extract existing episode IDs for comparison
  const existingIds = new Set(
    existingEpisodes.map(ep => ep.id || extractIdFromMp3Url(ep.mp3_url))
  );

  // Match all <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;

  while (
    (itemMatch = itemRegex.exec(rssXML)) !== null && 
    episodes.length < 25 // Limit to 25 new episodes max
  ) {
    const itemContent = itemMatch[1];

    // Extract title
    const titleMatch = itemContent.match(/<title>(.*?)<\/title>/);
    const title_arabic = titleMatch ? extractTextFromCDATA(titleMatch[1]) : '';

    // Extract description and clean it
    const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);
    const rawDescription = descMatch ? extractTextFromCDATA(descMatch[1]) : '';
    const description_arabic = cleanDescription(rawDescription);

    // Extract mp3 URL and audio type from enclosure
    const enclosureMatch = itemContent.match(/<enclosure\s+url="([^"]+)"[^>]*type="([^"]+)"/);
    const mp3_url = enclosureMatch ? enclosureMatch[1] : '';
    const audio_type = enclosureMatch ? enclosureMatch[2] : 'audio/mpeg';

    // Extract published date
    const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
    const published = pubDateMatch ? pubDateMatch[1].trim() : '';

    // Extract duration
    const durationMatch = itemContent.match(/<itunes:duration>(\d+)<\/itunes:duration>/);
    const duration_seconds = durationMatch ? durationMatch[1] : '';

    // Extract ID from mp3_url
    const id = extractIdFromMp3Url(mp3_url);

    // Only include if all required fields are present
    if (title_arabic && description_arabic && mp3_url && published && duration_seconds && id) {
      // Check if this episode already exists - if so, short-circuit
      // Since RSS feeds are ordered newest-first, all subsequent episodes will also exist
      if (existingIds.has(id)) {
        break; // Stop parsing - we've reached episodes we already have
      }
      
      // Add this new episode
      episodes.push({
        id,
        title_arabic,
        description_arabic,
        mp3_url,
        published,
        duration_seconds,
        audio_type,
      });
    }
  }

  return episodes;
}
