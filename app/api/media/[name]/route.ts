import { ownerRoute } from "../../../../lib/authorization";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { mediaRoot } from "../../../../lib/services/media";

export const dynamic = "force-dynamic";

// Serves runtime-generated draft images from the shared media volume. Files
// under public/ written at runtime are not guaranteed to be served by the
// Next production server, so all generated media flows through this route.
async function handleGET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Strict filename shape rejects path traversal before any filesystem access.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(name)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const root = mediaRoot();
  const filePath = resolve(join(root, name));
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let data: Buffer;
  try {
    data = readFileSync(filePath);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": "image/png",
      "content-length": String(data.length),
      // Short max-age: re-rendered drafts reuse the same filename.
      "cache-control": "public, max-age=300"
    }
  });
}

export const GET = ownerRoute(handleGET);
