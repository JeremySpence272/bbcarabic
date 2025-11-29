"use client";

import { Podcast } from "@/types/types";
import { useEffect, useState } from "react";
import Link from "next/link";
import ParseRSSButton from "@/components/ParseRSSButton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [transcriptsMap, setTranscriptsMap] = useState<Map<string, boolean>>(
    new Map()
  );

  useEffect(() => {
    const fetchPodcasts = async () => {
      const response = await fetch("/data/latest_episodes.json");
      const data = await response.json();
      setPodcasts(data);
    };
    fetchPodcasts();
  }, []);

  // Check for transcripts (new format: _final.json)
  useEffect(() => {
    const checkTranscripts = async () => {
      const map = new Map<string, boolean>();
      await Promise.all(
        podcasts.map(async (podcast) => {
          try {
            const response = await fetch(
              `/data/transcripts/${podcast.id}_final.json`
            );
            map.set(podcast.id, response.ok);
          } catch {
            map.set(podcast.id, false);
          }
        })
      );
      setTranscriptsMap(map);
    };

    if (podcasts.length > 0) {
      checkTranscripts();
    }
  }, [podcasts]);

  const refreshLists = async () => {
    const response = await fetch("/data/latest_episodes.json");
    const data = await response.json();
    setPodcasts(data);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">BBC Arabic</h1>
              <p className="font-signature-lateef text-3xl text-muted-foreground mt-0.5">
                مِن إِنشاء جيرمي سبنس
              </p>
            </div>
            <ParseRSSButton refreshLists={refreshLists} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {podcasts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No episodes found. Parse RSS feed to get started.
                </p>
              ) : (
                podcasts.map((podcast) => {
                  const hasTranscript = transcriptsMap.get(podcast.id) || false;
                  return (
                    <Link key={podcast.mp3_url} href={`/${podcast.id}`}>
                      <div className="group p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            {podcast.id}
                          </Badge>
                          {hasTranscript && (
                            <Badge
                              variant="default"
                              className="text-xs bg-green-600 hover:bg-green-700"
                            >
                              Transcribed
                            </Badge>
                          )}
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
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
