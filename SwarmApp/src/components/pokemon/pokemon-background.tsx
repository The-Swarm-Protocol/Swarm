/** PokemonBackground — Dark trainer-themed background with subtle pokeball pattern. */
"use client";

export function PokemonBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Background handled by .skin-pokemon body CSS */}
      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)",
        }}
      />
      {/* Faint pokeball watermark */}
      <div
        className="absolute opacity-[0.02]"
        style={{
          width: "400px",
          height: "400px",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "linear-gradient(180deg, #ee1515 0%, #ee1515 48%, #1a1a1a 48%, #1a1a1a 52%, #ffffff 52%, #ffffff 100%)",
          border: "4px solid #1a1a1a",
        }}
      />
    </div>
  );
}
