interface ProgressBarProps {
  current: number;
  total: number;
}

export const ProgressBar = ({ current, total }: ProgressBarProps) => {
  const pct = Math.round((current / total) * 100);

  return (
    <div className="w-full max-w-lg mx-auto space-y-1.5">
      <div className="flex justify-between text-xs font-body text-muted-foreground">
        <span>
          {current} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-forest to-gold transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
