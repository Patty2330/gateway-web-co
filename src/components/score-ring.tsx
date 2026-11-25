export function ScoreRing({ score }: { score: number }) {
  const tone = score >= 75 ? "#1f4d3a" : score >= 50 ? "#8a5a12" : "#8d2c2c";
  return (
    <div
      className="grid h-40 w-40 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${tone} ${Math.max(0, Math.min(100, score)) * 3.6}deg, #e7dfd2 0deg)` }}
      aria-hidden
    >
      <div className="grid h-[7.5rem] w-[7.5rem] place-items-center rounded-full bg-card text-center shadow-sm">
        <div>
          <div className="font-serif text-5xl leading-none text-foreground">{score}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            out of 100
          </div>
        </div>
      </div>
    </div>
  );
}
