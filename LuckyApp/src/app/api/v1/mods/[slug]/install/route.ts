/**
 * POST /api/v1/mods/:slug/install
 *
 * Install a mod for an org.
 * Body: { orgId, installedBy, enabledCapabilities? }
 */
import { NextRequest } from "next/server";
import { getModBySlug, installMod } from "@/lib/skills";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const mod = getModBySlug(slug);

    if (!mod) {
        return Response.json({ error: "Mod not found" }, { status: 404 });
    }

    try {
        const body = await req.json();
        const { orgId, installedBy, enabledCapabilities } = body;

        if (!orgId || !installedBy) {
            return Response.json(
                { error: "orgId and installedBy are required" },
                { status: 400 },
            );
        }

        const installationId = await installMod(
            mod.id,
            orgId,
            installedBy,
            enabledCapabilities,
        );

        return Response.json({
            installed: true,
            installationId,
            modId: mod.id,
            slug: mod.slug,
            enabledCapabilities: enabledCapabilities ?? mod.capabilities,
        });
    } catch (err) {
        console.error("mods/install error:", err);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
