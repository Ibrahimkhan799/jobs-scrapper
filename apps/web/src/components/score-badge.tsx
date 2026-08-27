import { recommendationFromScore, scoreLabel } from '@/lib/match';
import { cn } from '@/lib/utils';

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return (
      <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-md border border-border px-1.5 text-xs text-muted-foreground">
        —
      </span>
    );
  }
  const rec = recommendationFromScore(score);
  const tone =
    rec === 'EXCELLENT_MATCH'
      ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
      : rec === 'STRONG_MATCH'
        ? 'text-blue-600 border-blue-500/30 bg-blue-500/10'
        : rec === 'POSSIBLE_MATCH'
          ? 'text-amber-600 border-amber-500/30 bg-amber-500/10'
          : 'text-muted-foreground border-border bg-muted';
  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-12 items-center justify-center rounded-md border px-1.5 text-xs font-semibold tabular',
        tone,
      )}
      title={`${scoreLabel(score)} Job Match Score. Not a hiring probability.`}
    >
      {score}
    </span>
  );
}

export function ScoreMeta({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-muted-foreground">Not analyzed</span>;
  return (
    <span className="text-xs text-muted-foreground">
      {scoreLabel(score)} match
    </span>
  );
}
