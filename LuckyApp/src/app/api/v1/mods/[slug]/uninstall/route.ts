/**
 * POST /api/v1/mods/:slug/uninstall
 *
 * Uninstall a mod from an org.
 * Body: { installationId }
 */
import { NextRequest } from "next/server";
import { getModBySlug, uninstallMod } from "@/lib/skills";

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
        const { installationId } = body;

        if (!installationId) {
            return Response.json(
                { error: "installationId is required" },
                { status: 400 },
            );
        }

        await uninstallMod(installationId);

        return Response.json({
            uninstalled: true,
            modId: mod.id,
            slug: mod.slug,
        });
    } catch (err) {
        console.error("mods/uninstall error:", err);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
