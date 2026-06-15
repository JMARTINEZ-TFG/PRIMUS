export function PrimusLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
        <span className="text-sm font-bold text-primary-foreground">P</span>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-background" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-base font-bold tracking-tight">Primus</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Optimización Financiera
        </span>
      </div>
    </div>
  );
}
