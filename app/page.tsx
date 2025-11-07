"use client";

import { Podcast } from "@/types/types";
import { useEffect, useState } from "react";
import Link from "next/link";
import ParseRSSButton from "@/app/components/ParseRSSButton";
import TranscribeForm from "./components/TranscribeForm";
import TranslateFullEpisodeForm from "./components/TranslateFullEpisodeForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Transcript {
  id: string;
  title: string;
  duration: string;
  language: string;
  filename: string;
  segmentCount: number;
}

export default function Home() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  useEffect(() => {
    const fetchPodcasts = async () => {
      const response = await fetch("/data/latest_episodes.json");
      const data = await response.json();
      setPodcasts(data);
    };
    fetchPodcasts();
  }, []);

  useEffect(() => {
    const fetchTranscripts = async () => {
      try {
        const response = await fetch("/api/transcripts/list");
        const data = await response.json();
        setTranscripts(data);
      } catch (err) {
        console.error("Failed to load transcripts", err);
        setTranscripts([]);
      }
    };
    fetchTranscripts();
  }, []);

  const refreshLists = async () => {
    const response = await fetch("/data/latest_episodes.json");
    const data = await response.json();
    setPodcasts(data);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight">
            BBC Arabic Podcast Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage, transcribe, and translate Arabic news podcasts
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Podcasts Column */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Episodes</CardTitle>
              <CardDescription>
                {podcasts.length} total episodes
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto max-h-[600px]">
              <div className="space-y-3">
                {podcasts.map((podcast) => (
                  <Link key={podcast.mp3_url} href={`/${podcast.id}`}>
                    <div className="group p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {podcast.id}
                        </Badge>
                      </div>
                      <p
                        className="font-medium group-hover:text-primary transition-colors"
                        dir="rtl"
                      >
                        {podcast.title_arabic}
                      </p>
                      {podcast.title_english && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {podcast.title_english}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Transcripts Column */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Transcripts</CardTitle>
              <CardDescription>
                {transcripts.length > 0
                  ? (() => {
                      const uniqueIds = new Set(transcripts.map((t) => t.id));
                      return `${uniqueIds.size} episodes with transcripts`;
                    })()
                  : "No transcripts yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto max-h-[600px]">
              {transcripts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No transcripts available yet. Start by transcribing an
                  episode.
                </p>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    // Group transcripts by episode ID
                    const transcriptMap = new Map<string, Transcript[]>();
                    transcripts.forEach((transcript) => {
                      const existing = transcriptMap.get(transcript.id) || [];
                      existing.push(transcript);
                      transcriptMap.set(transcript.id, existing);
                    });

                    // Convert to array and sort
                    const groupedTranscripts = Array.from(
                      transcriptMap.entries()
                    ).map(([id, transcripts]) => ({
                      id,
                      transcripts,
                      title: transcripts[0]?.title || "Untitled",
                      segmentCount: transcripts[0]?.segmentCount || 0,
                      duration: transcripts[0]?.duration || "0",
                    }));

                    return groupedTranscripts.map((group) => {
                      const hasArabic = group.transcripts.some(
                        (t) => t.language === "arabic"
                      );
                      const hasEnglish = group.transcripts.some(
                        (t) => t.language === "english"
                      );

                      return (
                        <Link key={group.id} href={`/${group.id}`}>
                          <div className="group p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="outline"
                                className="font-mono text-xs"
                              >
                                {group.id}
                              </Badge>
                              {hasArabic && (
                                <Badge variant="default" className="text-xs">
                                  Arabic
                                </Badge>
                              )}
                              {hasEnglish && (
                                <Badge variant="secondary" className="text-xs">
                                  English
                                </Badge>
                              )}
                            </div>
                            <p
                              className="font-medium group-hover:text-primary transition-colors"
                              dir="rtl"
                            >
                              {group.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {group.segmentCount} segments •{" "}
                              {Math.floor(Number(group.duration) / 60)}min
                            </p>
                          </div>
                        </Link>
                      );
                    });
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tools Column */}
          <div className="space-y-6">
            {/* RSS Parser */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">RSS Feed</CardTitle>
                <CardDescription>
                  Fetch latest episodes, translate, and save automatically
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ParseRSSButton refreshLists={refreshLists} />
              </CardContent>
            </Card>

            {/* Transcriber */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transcribe Audio</CardTitle>
                <CardDescription>
                  Generate transcript with Whisper
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TranscribeForm />
              </CardContent>
            </Card>

            {/* Transcript Translator */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Translate Transcript</CardTitle>
                <CardDescription>
                  Translate existing Arabic transcript
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TranslateFullEpisodeForm />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
