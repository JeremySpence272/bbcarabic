import { NextRequest, NextResponse } from "next/server";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

/**
 * GET /api/video_transcribe/[file_id]/result
 * Proxy result request to Python API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file_id: string }> }
) {
  try {
    const { file_id } = await params;

    if (!file_id) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    const apiUrl = `${PYTHON_API_URL}/transcribe/${file_id}/result`;

    console.log(`Proxying result request to: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Python API error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: errorText || "Failed to fetch result" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error proxying result request:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to proxy request",
      },
      { status: 500 }
    );
  }
}

