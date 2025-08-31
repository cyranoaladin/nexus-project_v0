"use client";

export default function OffersPanel({ offers }: { offers: { primary: string; alternatives: string[]; reasoning: string } }) {
  return (
    <div className="space-y-1 text-sm">
      <div><span className="font-semibold">Offre principale: </span>{offers.primary}</div>
      <div><span className="font-semibold">Alternatives: </span>{offers.alternatives?.join(", ") || "—"}</div>
      <div className="text-gray-600">{offers.reasoning}</div>
    </div>
  );
}
