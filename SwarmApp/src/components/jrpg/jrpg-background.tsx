/** JrpgBackground — Dark fantasy starfield background replacing the standard DashboardBackground. */
"use client";

export function JrpgBackground() {
  return (
    <>
      {/* Starfield is handled by .skin-jrpg body CSS in globals.css */}
      {/* This component adds additional layered effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Subtle vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
          }}
        />
        {/* Faint horizontal scanlines for retro feel */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)",
            backgroundSize: "100% 4px",
          }}
        />
      </div>
    </>
  );
}
