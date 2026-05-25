/**
 * Inline SVG accent charts used in blog articles.
 * Editorial style (charcoal + gold), no external dependency.
 */

type ChartKind = "garthe-2011" | "whtr-scale" | "anabolic-window";

export function AccentChart({ kind }: { kind: ChartKind }) {
  if (kind === "garthe-2011") return <GartheChart />;
  if (kind === "whtr-scale") return <WhtrChart />;
  if (kind === "anabolic-window") return <AnabolicWindowChart />;
  return null;
}

/* ------------------------------------------------------------- */
/* Garthe 2011 — bar chart comparing slow vs fast weight loss     */
/* ------------------------------------------------------------- */
function GartheChart() {
  const metrics = [
    {
      label: "Masse grasse perdue",
      slow: 5.6,
      fast: 3.0,
      unit: "%",
      direction: "down" as const,
    },
    {
      label: "Masse maigre gagnée",
      slow: 2.1,
      fast: 0,
      unit: "%",
      direction: "up" as const,
    },
    {
      label: "Force au DC",
      slow: 11.9,
      fast: 0,
      unit: "%",
      direction: "up" as const,
    },
  ];
  const max = Math.max(...metrics.flatMap((m) => [m.slow, m.fast]));

  return (
    <figure className="my-2 p-6 sm:p-8 rounded-sm border border-[--color-nd-stroke] bg-[--color-nd-black-soft]">
      <figcaption className="mb-6 text-[11px] uppercase tracking-[0.18em] text-[--color-nd-muted]">
        <span className="text-[--color-nd-gold] font-semibold">Garthe 2011</span>
        {" · "}Comparaison perte lente (0,7 %/sem) vs rapide (1,4 %/sem) chez 24 athlètes élite
      </figcaption>

      <div className="space-y-5">
        {metrics.map((m) => (
          <div key={m.label} className="space-y-2">
            <div className="flex justify-between items-baseline text-sm">
              <span className="font-serif text-[--color-nd-white]">
                {m.label}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[--color-nd-muted]">
                {m.direction === "up" ? "Plus c'est haut, mieux c'est" : "Plus c'est haut, mieux c'est"}
              </span>
            </div>
            <div className="space-y-1.5">
              <BarRow
                label="Lent (0,7 %/sem)"
                value={m.slow}
                max={max}
                unit={m.unit}
                color="gold"
              />
              <BarRow
                label="Rapide (1,4 %/sem)"
                value={m.fast}
                max={max}
                unit={m.unit}
                color="muted"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 pt-4 border-t border-[--color-nd-stroke] text-xs text-[--color-nd-muted] leading-relaxed">
        Verdict : aller deux fois plus vite n&apos;a pas fait perdre deux fois plus de gras.
        Ça a fait perdre <strong className="text-[--color-nd-white]">moins</strong> de gras et stagner la performance.
      </p>
    </figure>
  );
}

function BarRow({
  label,
  value,
  max,
  unit,
  color,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: "gold" | "muted";
}) {
  const pct = max === 0 ? 0 : (value / max) * 100;
  const barColor = color === "gold" ? "var(--color-nd-gold)" : "var(--color-nd-stroke)";
  const textColor = color === "gold" ? "var(--color-nd-gold)" : "var(--color-nd-muted)";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[--color-nd-white-dim] w-32 sm:w-36 flex-shrink-0">
        {label}
      </span>
      <div className="flex-1 h-6 bg-[--color-nd-black] rounded-sm overflow-hidden relative">
        <div
          className="h-full transition-all duration-1000 ease-out"
          style={{ width: `${Math.max(pct, value === 0 ? 0 : 2)}%`, backgroundColor: barColor }}
        />
      </div>
      <span
        className="text-sm font-semibold tabular-nums w-12 text-right"
        style={{ color: textColor }}
      >
        {value > 0 ? "+" : ""}
        {value}
        {unit}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- */
/* WHtR — visual scale of waist-to-height ratio                   */
/* ------------------------------------------------------------- */
function WhtrChart() {
  const bands = [
    { range: "< 0.43", label: "Sous-poids / sec", color: "var(--color-nd-stroke)" },
    { range: "0.43 – 0.49", label: "Optimal santé", color: "var(--color-nd-gold)" },
    { range: "0.50 – 0.57", label: "À surveiller", color: "#7a6515" },
    { range: "0.58 – 0.62", label: "Obésité viscérale", color: "#5a4a10" },
    { range: "> 0.63", label: "Sévère, consulte", color: "#3a3009" },
  ];

  return (
    <figure className="my-2 p-6 sm:p-8 rounded-sm border border-[--color-nd-stroke] bg-[--color-nd-black-soft]">
      <figcaption className="mb-6 text-[11px] uppercase tracking-[0.18em] text-[--color-nd-muted]">
        <span className="text-[--color-nd-gold] font-semibold">Ashwell 2012</span>
        {" · "}WHtR = tour de taille (cm) ÷ taille (cm)
      </figcaption>

      <div className="space-y-2">
        {bands.map((b) => (
          <div key={b.range} className="flex items-center gap-4">
            <span
              className="text-xs font-mono tabular-nums w-24 sm:w-32 flex-shrink-0 font-bold"
              style={{ color: b.color }}
            >
              {b.range}
            </span>
            <div className="flex-1 h-8 rounded-sm" style={{ backgroundColor: b.color }} />
            <span className="text-xs text-[--color-nd-white-dim] w-32 sm:w-44 flex-shrink-0 text-right">
              {b.label}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-6 pt-4 border-t border-[--color-nd-stroke] text-xs text-[--color-nd-muted] leading-relaxed">
        Règle de poche : <strong className="text-[--color-nd-white]">ton tour de taille
        doit être inférieur à la moitié de ta taille</strong>. Plus simple,
        plus prédictif que l&apos;IMC.
      </p>
    </figure>
  );
}

/* ------------------------------------------------------------- */
/* Anabolic window — timeline shattering the "30 min" myth        */
/* ------------------------------------------------------------- */
function AnabolicWindowChart() {
  return (
    <figure className="my-2 p-6 sm:p-8 rounded-sm border border-[--color-nd-stroke] bg-[--color-nd-black-soft]">
      <figcaption className="mb-6 text-[11px] uppercase tracking-[0.18em] text-[--color-nd-muted]">
        <span className="text-[--color-nd-gold] font-semibold">Jäger 2017 — ISSN</span>
        {" · "}Sensibilité anabolique post-entraînement
      </figcaption>

      <div className="relative pl-8 pr-2 py-2">
        {/* Timeline axis */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-[--color-nd-stroke]" />

        {/* 0–30 min — the "sacred window" of myth */}
        <div className="relative mb-8">
          <div className="absolute -left-7 top-2 h-3 w-3 rounded-full bg-[--color-nd-stroke] border-2 border-[--color-nd-black-soft]" />
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-[--color-nd-muted] line-through">
              0 – 30 min (le mythe)
            </div>
            <div className="font-serif text-base text-[--color-nd-white-dim] italic">
              « Sinon tes protéines sont perdues. » <span className="text-[--color-nd-muted]">— faux.</span>
            </div>
          </div>
        </div>

        {/* 0–24h — the real anabolic window */}
        <div className="relative">
          <div className="absolute -left-7 top-2 h-3 w-3 rounded-full bg-[--color-nd-gold] shadow-[0_0_12px_var(--color-nd-gold)]" />
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-[--color-nd-gold] font-bold">
              0 – 24 h (la réalité)
            </div>
            <div className="font-serif text-base text-[--color-nd-white]">
              Le muscle reste sensible aux apports protéiques pendant au moins
              <strong className="text-[--color-nd-gold]"> 24 heures</strong> post-effort.
            </div>
            <div className="text-xs text-[--color-nd-white-dim] leading-relaxed">
              Ce qui compte : <strong className="text-[--color-nd-white]">total quotidien</strong>{" "}
              (2,3 – 3,1 g / kg LBM) et{" "}
              <strong className="text-[--color-nd-white]">répartition</strong> (4 – 6 prises de
              0,25 – 0,40 g/kg).
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
