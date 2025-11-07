import { NextResponse } from 'next/server';
import { fetchRSSFeed } from '@/lib/rss';

/**
 * GET /api/rss/fetch
 * Fetches the latest RSS feed from BBC Arabic Podcast
 */
export async function GET() {
  try {
    const rssXML = await fetchRSSFeed();
    
    // Return raw XML with appropriate headers
    return new NextResponse(rssXML, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800'
      }
    });
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feed' },
      { status: 500 }
    );
  }
}

