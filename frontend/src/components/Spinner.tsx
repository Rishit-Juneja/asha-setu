import { Loader2 } from "lucide-react";
import { cn } from "../utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin", className)} />;
}

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-moss">
      <Spinner className="size-7 text-pine" />
      <p className="text-sm font-semibold">{label}…</p>
    </div>
  );
}
