"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Podcast } from "@/types/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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

export default function EpisodePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [episode, setEpisode] = useState<Podcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arabicTranscript, setArabicTranscript] =
    useState<TranscriptData | null>(null);
  const [englishTranscript, setEnglishTranscript] =
    useState<TranscriptData | null>(null);
  const [currentSegmentId, setCurrentSegmentId] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [showEnglish, setShowEnglish] = useState<boolean>(true);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Calculate first segment start time (for display offset)
  const firstSegmentStartTime = arabicTranscript?.segments[0]?.start || 0;

  // Load start time from localStorage on mount (keyed by episode ID)
  useEffect(() => {
    if (id) {
      const savedStartTime = localStorage.getItem(`start_time_${id}`);
      if (savedStartTime) {
        setStartTime(parseFloat(savedStartTime));
      }
    }
  }, [id]);

  useEffect(() => {
    const fetchEpisode = async () => {
      try {
        setLoading(true);
        const response = await fetch("/data/latest_episodes.json");
        const allEpisodes: Podcast[] = await response.json();

        const foundEpisode = allEpisodes.find((ep) => ep.id === id);

        if (!foundEpisode) {
          setError(`Episode with ID "${id}" not found`);
          setEpisode(null);
        } else {
          setEpisode(foundEpisode);
          setError(null);
        }
      } catch (err) {
        setError("Failed to load episode data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchEpisode();
    }
  }, [id]);

  // Load transcripts
  useEffect(() => {
    const fetchTranscripts = async () => {
      if (!id) return;

      try {
        // Try to load transcript in new format (_final.json with both Arabic and English)
        const transcriptRes = await fetch(`/data/transcripts/${id}_final.json`);
        if (transcriptRes.ok) {
          const transcriptData = await transcriptRes.json();

          // Extract Arabic segments
          const arabicSegments =
            transcriptData.segments?.map((seg: any) => ({
              id: seg.id,
              start: seg.start,
              end: seg.end,
              text: seg.text_ar || seg.text_ar_raw || seg.text || "",
            })) || [];

          // Extract English segments
          const englishSegments =
            transcriptData.segments?.map((seg: any) => ({
              id: seg.id,
              start: seg.start,
              end: seg.end,
              text: seg.text_en || "",
            })) || [];

          if (arabicSegments.length > 0) {
            setArabicTranscript({
              id: transcriptData.file_id || id,
              title: transcriptData.source_file || "",
              duration: transcriptData.duration?.toString() || "0",
              language: transcriptData.language || "ar",
              transcription_duration:
                transcriptData.metadata?.processing_time?.total || 0,
              segments: arabicSegments,
            });
            console.log(
              `✅ Loaded Arabic transcript: ${arabicSegments.length} segments`
            );
          }

          if (englishSegments.length > 0) {
            setEnglishTranscript({
              id: transcriptData.file_id || id,
              title: transcriptData.source_file || "",
              duration: transcriptData.duration?.toString() || "0",
              language: "en",
              transcription_duration:
                transcriptData.metadata?.processing_time?.total || 0,
              segments: englishSegments,
            });
            console.log(
              `✅ Loaded English transcript: ${englishSegments.length} segments`
            );
          }
        } else {
          console.log("❌ Transcript not found (404)");
        }
      } catch (err) {
        console.log("❌ Transcript not available:", err);
      }
    };

    fetchTranscripts();
  }, [id]);

  // Sync audio with transcript
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !arabicTranscript) return;

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;

      // Calculate transcript time: audio time minus user-entered start time
      const transcriptTime = currentTime - startTime;

      // Find segment where: segment.start - firstSegment.start = transcriptTime
      // This means: segment.start = transcriptTime + firstSegment.start
      const targetSegmentStart = transcriptTime + firstSegmentStartTime;

      // Find the segment that contains this time
      const segment = arabicTranscript.segments.find(
        (seg) =>
          targetSegmentStart >= seg.start && targetSegmentStart <= seg.end
      );

      // Debug logging
      if (currentTime > 0 && currentTime < 5) {
        console.log(
          `Audio: ${currentTime.toFixed(2)}s, Start: ${startTime.toFixed(
            2
          )}s, Transcript: ${transcriptTime.toFixed(
            2
          )}s, Target: ${targetSegmentStart.toFixed(2)}s, Segment: ${
            segment?.id
          }`
        );
      }

      if (segment && segment.id !== currentSegmentId) {
        console.log(
          `Switching to segment ${
            segment.id
          } (transcript time: ${transcriptTime.toFixed(2)}s)`
        );
        setCurrentSegmentId(segment.id);

        // Auto-scroll to position active segment at the TOP of the container
        const container = document.getElementById("transcript-container");
        const element = document.getElementById(`segment-${segment.id}`);

        if (container && element) {
          // Get the parent of the ScrollArea content (the viewport)
          const viewport = container.querySelector(
            "[data-radix-scroll-area-viewport]"
          );
          const scrollContainer = viewport || container;

          // Calculate position to place element at top with some padding
          const scrollTop = element.offsetTop - 20; // 20px padding from top

          if (scrollContainer instanceof HTMLElement) {
            scrollContainer.scrollTo({
              top: scrollTop,
              behavior: "smooth",
            });
          }
        }
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
  }, [arabicTranscript, currentSegmentId, startTime, firstSegmentStartTime]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Loading Episode</CardTitle>
            <CardDescription>ID: {id}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse text-muted-foreground">
                Loading...
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error || "Episode not found"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")} className="w-full">
              ← Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Button
                variant="ghost"
                onClick={() => router.push("/")}
                className="mb-2"
              >
                ← Back to Home
              </Button>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {episode.id}
                </Badge>
                {arabicTranscript && (
                  <Badge variant="secondary">Transcribed</Badge>
                )}
                {episode.title_english && (
                  <Badge variant="secondary">Translated</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Audio Player Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Audio Player</CardTitle>
            <CardDescription>
              {Math.floor(Number(episode.duration_seconds) / 60)}:
              {String(Number(episode.duration_seconds) % 60).padStart(2, "0")} •
              Published {new Date(episode.published).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <audio
              ref={audioRef}
              controls
              className="w-full"
              style={{
                height: "54px",
                outline: "none",
              }}
            >
              <source
                src={episode.mp3_url}
                type={episode.audio_type || "audio/mpeg"}
              />
              Your browser does not support the audio element.
            </audio>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="start-time" className="text-sm">
                  Start Time (seconds)
                </Label>
                <Input
                  id="start-time"
                  type="number"
                  step="0.1"
                  value={startTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const newStartTime = parseFloat(e.target.value) || 0;
                    setStartTime(newStartTime);
                    // Save to localStorage keyed by episode ID
                    if (id) {
                      localStorage.setItem(
                        `start_time_${id}`,
                        newStartTime.toString()
                      );
                    }
                  }}
                  className="mt-1"
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Synchronized Transcript Section */}
        {arabicTranscript && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Synchronized Transcript</CardTitle>
                  <CardDescription>
                    {arabicTranscript.segments.length} segments •{" "}
                    {englishTranscript
                      ? "Arabic and English available"
                      : "Arabic only"}
                  </CardDescription>
                </div>
                {englishTranscript && (
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="show-english"
                      className="text-sm cursor-pointer"
                    >
                      Show English
                    </Label>
                    <Switch
                      id="show-english"
                      checked={showEnglish}
                      onCheckedChange={setShowEnglish}
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Fixed height scrollable container */}
              <ScrollArea
                id="transcript-container"
                className="h-[70vh] w-full rounded-md border p-4"
                style={{ scrollBehavior: "smooth" }}
              >
                <div className="space-y-3 pr-4">
                  {arabicTranscript.segments.map((segment) => {
                    const isActive = segment.id === currentSegmentId;
                    const englishSegment = englishTranscript?.segments.find(
                      (s) => s.id === segment.id
                    );

                    return (
                      <div
                        key={segment.id}
                        id={`segment-${segment.id}`}
                        className={`p-4 rounded-lg border-l-4 transition-all cursor-pointer ${
                          isActive
                            ? "bg-primary/10 border-primary shadow-sm"
                            : "bg-muted/30 border-muted hover:border-primary/50"
                        }`}
                        onClick={() => {
                          if (audioRef.current) {
                            // Calculate display time: segment.start - firstSegment.start
                            const displayTime =
                              segment.start - firstSegmentStartTime;
                            // Set audio to: startTime + displayTime
                            audioRef.current.currentTime =
                              startTime + displayTime;
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs min-w-[65px]"
                          >
                            {(() => {
                              // Display time starts at 0: segment.start - firstSegment.start
                              const displayTime =
                                segment.start - firstSegmentStartTime;
                              return `${Math.floor(displayTime / 60)}:${String(
                                Math.floor(displayTime % 60)
                              ).padStart(2, "0")}`;
                            })()}
                          </Badge>
                          <div className="flex-1 space-y-3">
                            <p
                              className={`leading-relaxed ${
                                isActive
                                  ? "font-semibold text-foreground"
                                  : "text-foreground/90"
                              }`}
                              dir="rtl"
                            >
                              {segment.text}
                            </p>
                            {englishSegment && showEnglish && (
                              <p className="text-base leading-relaxed text-muted-foreground text-right">
                                {englishSegment.text}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Titles Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Episode Titles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Arabic Title */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="default">Arabic</Badge>
              </div>
              <p className="font-semibold" dir="rtl">
                {episode.title_arabic}
              </p>
            </div>

            {episode.title_arabic_diacritics && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary">Arabic + Diacritics</Badge>
                  </div>
                  <p className="font-semibold text-primary/80" dir="rtl">
                    {episode.title_arabic_diacritics}
                  </p>
                </div>
              </>
            )}

            {episode.title_english && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline">English</Badge>
                  </div>
                  <p className="text-xl font-semibold">
                    {episode.title_english}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Descriptions Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Episode Description</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Arabic Description */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="default">Arabic</Badge>
              </div>
              <p className="leading-relaxed" dir="rtl">
                {episode.description_arabic}
              </p>
            </div>

            {episode.description_arabic_diacritics && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary">Arabic + Diacritics</Badge>
                  </div>
                  <p className="leading-relaxed text-primary/80" dir="rtl">
                    {episode.description_arabic_diacritics}
                  </p>
                </div>
              </>
            )}

            {episode.description_english && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline">English</Badge>
                  </div>
                  <p className="text-base leading-relaxed">
                    {episode.description_english}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Metadata Section */}
        <Card>
          <CardHeader>
            <CardTitle>Episode Information</CardTitle>
            <CardDescription>Technical details and metadata</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Episode ID
                </p>
                <Badge variant="outline" className="font-mono">
                  {episode.id}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Audio Type
                </p>
                <p className="text-sm">{episode.audio_type || "audio/mpeg"}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Published Date
                </p>
                <p className="text-sm">
                  {new Date(episode.published).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Duration
                </p>
                <p className="text-sm">
                  {Math.floor(Number(episode.duration_seconds) / 60)}:
                  {String(Number(episode.duration_seconds) % 60).padStart(
                    2,
                    "0"
                  )}
                  ({episode.duration_seconds} seconds)
                </p>
              </div>

              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  MP3 URL
                </p>
                <a
                  href={episode.mp3_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline break-all font-mono bg-muted px-2 py-1 rounded block"
                >
                  {episode.mp3_url}
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
