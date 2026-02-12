import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log incoming webhook for debugging
    console.log("Farcaster webhook received:", JSON.stringify(body, null, 2));

    // Handle different event types
    const { event } = body;
    
    switch (event) {
      case "frame_added":
        console.log("Frame was added to a cast");
        break;
      case "frame_removed":
        console.log("Frame was removed from a cast");
        break;
      case "notifications_enabled":
        console.log("User enabled notifications");
        break;
      case "notifications_disabled":
        console.log("User disabled notifications");
        break;
      default:
        console.log("Unknown event type:", event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "DynamicSwap Farcaster Webhook Endpoint",
  });
}
