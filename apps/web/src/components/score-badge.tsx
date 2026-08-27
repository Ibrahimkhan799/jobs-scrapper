import { recommendationFromScore, scoreLabel } from '@/lib/match';
import { cn } from '@/lib/utils';

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return (
      <span className="inline-flex h-7 min-w-10 items-center justify-center border border-border px-1.5 text-xs tabular text-muted-foreground">
        —
      </span>
    );
  }
  const rec = recommendationFromScore(score);
  const strong = rec === 'EXCELLENT_MATCH' || rec === 'STRONG_MATCH';
  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-12 items-center justify-center border px-1.5 text-xs font-medium tabular',
        strong ? 'border-score/40 text-score' : 'border-border text-muted-foreground',
      )}
      title={`${scoreLabel(score)} Job Match Score. Not a hiring probability.`}
    >
      {score}
    </span>
  );
}

export function ScoreMeta({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-muted-foreground">Not analyzed</span>;
  return <span className="text-xs text-muted-foreground">{scoreLabel(score)} match</span>;
}
