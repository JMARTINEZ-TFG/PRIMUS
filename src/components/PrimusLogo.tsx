export function PrimusLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src="/favicon.svg" alt="Primus" className="h-8 w-8 shrink-0" />
      {/* Con el menú lateral colapsado solo se ve el ícono */}
      <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
        <span className="text-base font-bold tracking-tight">Primus</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Optimización Financiera
        </span>
      </div>
    </div>
  );
}
