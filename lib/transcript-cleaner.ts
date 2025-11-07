/**
 * Utility functions for cleaning transcript segments
 */

interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface TranscriptData {
  id: string;
  title: string;
  duration: string;
  language: string;
  transcription_duration: number;
  segments: TranscriptSegment[];
}

/**
 * Removes all segments that occur before "BBC News" or "بي بي سي نيوز عربي" appears in the transcript.
 * This removes ad segments at the beginning of podcasts.
 * Only deletes segments if the pattern appears in the first half of the podcast.
 * If multiple instances appear in the first half, uses the last one.
 * 
 * @param transcriptData - The transcript data to clean
 * @returns Cleaned transcript data with segments renumbered and segments before pattern removed
 */
export function removeSegmentsBeforeBBCNews(
  transcriptData: TranscriptData
): TranscriptData {
  // Calculate the midpoint of the podcast (first half cutoff)
  const totalDuration = transcriptData.transcription_duration || 
    (transcriptData.segments.length > 0 
      ? transcriptData.segments[transcriptData.segments.length - 1].end 
      : 0);
  const midpoint = totalDuration / 2;

  // Patterns to search for (both English and Arabic)
  const englishPattern = "bbc news";
  const arabicPattern = "بي بي سي نيوز عربي";

  // Find all segments that contain any of the patterns
  const matchingIndices: number[] = [];
  
  transcriptData.segments.forEach((segment, index) => {
    const segmentTextLower = segment.text.toLowerCase();
    const segmentTextOriginal = segment.text;
    
    // Check for English pattern (case insensitive)
    const hasEnglishPattern = segmentTextLower.includes(englishPattern);
    // Check for Arabic pattern (case sensitive, preserve original)
    const hasArabicPattern = segmentTextOriginal.includes(arabicPattern);
    
    if (hasEnglishPattern || hasArabicPattern) {
      matchingIndices.push(index);
    }
  });

  if (matchingIndices.length === 0) {
    // No pattern found, return original transcript
    console.log("⚠️  'BBC News' pattern not found in transcript, skipping cleanup");
    return transcriptData;
  }

  // Filter to only those in the first half of the podcast
  const firstHalfMatches = matchingIndices.filter((index) => {
    const segment = transcriptData.segments[index];
    return segment.start < midpoint;
  });

  if (firstHalfMatches.length === 0) {
    // Pattern only found in second half, don't delete anything
    console.log("⚠️  'BBC News' pattern only found in second half of podcast, skipping cleanup");
    return transcriptData;
  }

  // Use the last occurrence in the first half (closest to actual content start)
  const cutoffIndex = firstHalfMatches[firstHalfMatches.length - 1];
  const cutoffSegment = transcriptData.segments[cutoffIndex];
  
  console.log(
    `📍 Found ${matchingIndices.length} total pattern match(es), ${firstHalfMatches.length} in first half`
  );
  console.log(
    `   Using segment ${cutoffIndex} (start: ${cutoffSegment.start.toFixed(1)}s) as cutoff`
  );

  // Remove all segments before the cutoff
  const cleanedSegments = transcriptData.segments.slice(cutoffIndex);

  // Re-number segments starting from 0
  const renumberedSegments = cleanedSegments.map((segment, index) => ({
    ...segment,
    id: index,
  }));

  // Calculate new transcription duration (from first segment start to last segment end)
  const firstSegmentStart = renumberedSegments[0]?.start || 0;
  const lastSegmentEnd =
    renumberedSegments[renumberedSegments.length - 1]?.end || 0;
  const newTranscriptionDuration = lastSegmentEnd - firstSegmentStart;

  console.log(
    `🧹 Removed ${cutoffIndex} segments before pattern (${cutoffIndex} → 0)`
  );
  console.log(
    `   Original: ${transcriptData.segments.length} segments → Cleaned: ${renumberedSegments.length} segments`
  );

  return {
    ...transcriptData,
    segments: renumberedSegments,
    transcription_duration: newTranscriptionDuration,
  };
}

