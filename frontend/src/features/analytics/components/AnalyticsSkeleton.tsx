const Block = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-2xl bg-muted ${className}`} />
);

const AnalyticsSkeleton = () => (
  <div className="space-y-8 pb-20" aria-hidden="true">
    <div className="space-y-2">
      <Block className="h-8 w-56" />
      <Block className="h-4 w-80" />
    </div>
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Block key={index} className="h-24 rounded-none" />
      ))}
    </div>
    <Block className="h-80" />
    <Block className="h-96" />
  </div>
);

export default AnalyticsSkeleton;
