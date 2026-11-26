import { CloudOff } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-raised", className)} />;
}

export function SkeletonList({ rows = 5, className = "h-9" }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Memuat" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}

interface EmptyProps {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, children, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-base font-semibold">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState
        icon={<CloudOff size={28} />}
        title="Belum berhasil dimuat"
        action={
          <Button variant="soft" onClick={onRetry}>
            Coba lagi
          </Button>
        }
      >
        {errorMessage(error)}
      </EmptyState>
    </div>
  );
}
