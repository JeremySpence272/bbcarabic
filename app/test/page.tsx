"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TranscriptionStatus {
  file_id?: string;
  status: "idle" | "processing" | "completed" | "error";
  message?: string;
  result?: any;
}

export default function TestPage() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [transcription, setTranscription] = useState<TranscriptionStatus>({
    status: "idle",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!youtubeUrl.trim()) {
      alert("Please enter a YouTube URL");
      return;
    }

    // Basic YouTube URL validation
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(youtubeUrl)) {
      alert("Please enter a valid YouTube URL");
      return;
    }

    setIsProcessing(true);
    setTranscription({
      status: "processing",
      message: "Starting transcription...",
    });

    try {
      const response = await fetch("/api/video_transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ youtube_url: youtubeUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to transcribe video");
      }

      const data = await response.json();

      setTranscription({
        file_id: data.file_id,
        status: "processing",
        message: "Transcription started. Polling for results...",
      });

      // Poll for results
      await pollForResults(data.file_id);
    } catch (error: any) {
      console.error("Transcription error:", error);
      setTranscription({
        status: "error",
        message: error.message || "An error occurred during transcription",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const pollForResults = async (fileId: string) => {
    const maxAttempts = 300; // 5 minutes max (1 second intervals)
    let attempts = 0;

    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        setTranscription({
          file_id: fileId,
          status: "error",
          message: "Transcription timed out after 5 minutes",
        });
        return;
      }

      attempts++;

      try {
        const statusResponse = await fetch(
          `/api/video_transcribe/${fileId}/status`
        );

        if (!statusResponse.ok) {
          throw new Error("Failed to fetch status");
        }

        const status = await statusResponse.json();

        if (status.status === "completed") {
          // Fetch the result
          const resultResponse = await fetch(
            `/api/video_transcribe/${fileId}/result`
          );
          if (resultResponse.ok) {
            const result = await resultResponse.json();
            setTranscription({
              file_id: fileId,
              status: "completed",
              message: "Transcription completed successfully!",
              result: result,
            });
          } else {
            throw new Error("Failed to fetch result");
          }
        } else if (status.status === "error") {
          setTranscription({
            file_id: fileId,
            status: "error",
            message: status.error || status.message || "Transcription failed",
          });
        } else {
          // Still processing, update message and poll again
          setTranscription({
            file_id: fileId,
            status: "processing",
            message: status.message || "Processing...",
          });
          setTimeout(poll, 2000); // Poll every 2 seconds
        }
      } catch (error: any) {
        console.error("Polling error:", error);
        setTranscription({
          file_id: fileId,
          status: "error",
          message: error.message || "Error checking status",
        });
      }
    };

    // Start polling
    setTimeout(poll, 2000); // First poll after 2 seconds
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>YouTube Video Transcription Test</CardTitle>
            <CardDescription>
              Enter a YouTube video URL to transcribe and translate to Arabic
              with English translations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="youtube-url">YouTube Video URL</Label>
                <Input
                  id="youtube-url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              <Button
                type="submit"
                disabled={isProcessing || !youtubeUrl.trim()}
              >
                {isProcessing ? "Processing..." : "Transcribe Video"}
              </Button>
            </form>

            {/* Status Display */}
            {transcription.status !== "idle" && (
              <div className="mt-6 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="font-semibold">Status: </span>
                      <span
                        className={
                          transcription.status === "completed"
                            ? "text-green-600"
                            : transcription.status === "error"
                            ? "text-red-600"
                            : "text-blue-600"
                        }
                      >
                        {transcription.status}
                      </span>
                    </div>

                    {transcription.file_id && (
                      <div>
                        <span className="font-semibold">File ID: </span>
                        <span className="font-mono text-sm">
                          {transcription.file_id}
                        </span>
                      </div>
                    )}

                    {transcription.message && (
                      <div>
                        <span className="font-semibold">Message: </span>
                        <span>{transcription.message}</span>
                      </div>
                    )}

                    {transcription.status === "completed" &&
                      transcription.result && (
                        <div className="mt-4 pt-4 border-t">
                          <h3 className="font-semibold mb-2">
                            Transcript Preview:
                          </h3>
                          <div className="max-h-96 overflow-y-auto space-y-2">
                            {transcription.result.segments
                              ?.slice(0, 5)
                              .map((segment: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-2 bg-muted rounded text-sm"
                                >
                                  <div className="text-xs text-muted-foreground mb-1">
                                    {segment.start?.toFixed(2)}s -{" "}
                                    {segment.end?.toFixed(2)}s
                                  </div>
                                  {segment.text_ar && (
                                    <div className="mb-1" dir="rtl">
                                      {segment.text_ar}
                                    </div>
                                  )}
                                  {segment.text_en && (
                                    <div className="text-muted-foreground">
                                      {segment.text_en}
                                    </div>
                                  )}
                                </div>
                              ))}
                            {transcription.result.segments?.length > 5 && (
                              <div className="text-xs text-muted-foreground text-center py-2">
                                ... and{" "}
                                {transcription.result.segments.length - 5} more
                                segments
                              </div>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Total segments:{" "}
                            {transcription.result.segments?.length || 0}
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
