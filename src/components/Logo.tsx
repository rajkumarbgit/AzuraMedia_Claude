export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <Image src="/logo.png" alt="AzuraMedia" width={size} height={size} />
      <span className="font-bold text-lg tracking-tight">AzuraMedia</span>
    </div>
  );
}
