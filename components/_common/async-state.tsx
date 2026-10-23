"use client";

import type { ReactNode } from "react";
import Button from "@/components/_ui/button";
import { cn } from "@/lib/utils";
import AlertIcon from "@/public/assets/images/companies/sidebar/alert-triangle.svg";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <p className="lead-style text-foreground font-medium">{title}</p>
      {description && <p className="caption-style text-subtle max-w-[32em]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

export function ErrorState({
  title = "Não foi possível carregar os dados",
  description,
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <AlertIcon aria-hidden className="text-danger size-5" />
      <p className="lead-style text-foreground font-medium">{title}</p>
      {description && <p className="caption-style text-subtle max-w-[32em]">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="md" className="mt-2" onClick={onRetry} disabled={retrying}>
          {retrying ? "A tentar…" : "Tentar novamente"}
        </Button>
      )}
    </div>
  );
}

type QueryLike<T> = {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching?: boolean;
  error: unknown;
  refetch: () => unknown;
};

type AsyncStateProps<T> = {
  query: QueryLike<T>;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: EmptyStateProps;
  errorDescription?: (error: unknown) => string;
  errorTitle?: string;
};

export default function AsyncState<T>({
  query,
  skeleton,
  children,
  isEmpty,
  empty,
  errorDescription,
  errorTitle,
}: AsyncStateProps<T>) {
  if (query.isPending) {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">A carregar…</span>
        {skeleton}
      </div>
    );
  }
  if (query.isError || query.data === undefined) {
    return (
      <ErrorState
        title={errorTitle}
        description={errorDescription?.(query.error)}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (isEmpty?.(query.data)) {
    return <EmptyState title={empty?.title ?? "Sem resultados"} description={empty?.description} action={empty?.action} />;
  }
  return <>{children(query.data)}</>;
}
