import fs from "node:fs";

export const dynamic = "force-dynamic";

export function GET() {
  const role =
    process.env.NEXT_AGENT === "1"
      ? "agent"
      : process.env.NEXT_E2E === "1"
        ? "e2e"
        : undefined;
  if (!role) return new Response(null, { status: 404 });
  return Response.json(
    {
      role,
      root: fs.realpathSync(process.cwd()),
      runId: process.env.VERIFICATION_RUN_ID,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
