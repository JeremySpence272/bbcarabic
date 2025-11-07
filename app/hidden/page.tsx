"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function HiddenPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setTranscript(null);
    setFileName(null);
    setFileSize(null);

    try {
      console.log(`Starting transcription for file: ${file.name}`);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/whisper/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to transcribe audio");
      }

      console.log("Transcription complete:", data);
      setTranscript(data.transcript);
      setFileName(data.fileName);
      setFileSize(data.fileSize);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
      console.error("Transcription error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Whisper Transcription</CardTitle>
            <CardDescription>
              Upload an MP3 file to get a plain text transcription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div>
              <label
                htmlFor="mp3-upload"
                className="block mb-2 text-sm font-medium"
              >
                Select MP3 File:
              </label>
              <input
                id="mp3-upload"
                type="file"
                accept="audio/mpeg,audio/mp3,.mp3"
                onChange={handleFileUpload}
                disabled={isLoading}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="p-4 bg-blue-100 text-blue-700 rounded-md">
                <strong>🎙️ Transcribing audio...</strong>
                <p className="text-sm mt-1">
                  This may take 1-2 minutes depending on the audio length.
                  Please wait...
                </p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Success State with Transcript */}
            {transcript && (
              <div className="space-y-4">
                <div className="p-4 bg-green-100 text-green-800 rounded-md border border-green-200">
                  <h3 className="text-lg font-semibold mb-2">
                    ✅ Transcription Complete!
                  </h3>
                  <div className="space-y-1 text-sm">
                    {fileName && (
                      <p>
                        <strong>File:</strong> {fileName}
                      </p>
                    )}
                    {fileSize && (
                      <p>
                        <strong>Size:</strong>{" "}
                        {(fileSize / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    )}
                    <p>
                      <strong>Transcript Length:</strong>{" "}
                      {transcript.length.toLocaleString()} characters
                    </p>
                  </div>
                </div>

                {/* Transcript Display */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Transcript</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(transcript);
                          alert("Transcript copied to clipboard!");
                        }}
                      >
                        Copy Transcript
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {transcript}
                      </div>
                    </ScrollArea>
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
