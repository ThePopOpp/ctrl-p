import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const size = Math.min(512, Math.max(64, Number(searchParams.get("size") || 256)));
  const fgColor = searchParams.get("fg") || "#000000";
  const bgColor = searchParams.get("bg") || "#ffffff";

  if (!url) {
    return NextResponse.json({ error: "url parameter is required." }, { status: 400 });
  }

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(url);
    new URL(decodedUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url parameter." }, { status: 400 });
  }

  const buffer = await QRCode.toBuffer(decodedUrl, {
    type: "png",
    width: size,
    margin: 1,
    color: {
      dark: fgColor,
      light: bgColor,
    },
    errorCorrectionLevel: "M",
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
