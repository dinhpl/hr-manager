import * as React from 'react';

import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';

export function DemoSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function DemoCard({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b pb-3">
        <CardDescription className="text-xs font-medium uppercase tracking-widest">
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

export function DemoRow({
  label,
  children,
  vertical,
}: {
  label?: string;
  children: React.ReactNode;
  vertical?: boolean;
}) {
  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      )}
      <div className={vertical ? 'flex flex-col gap-2' : 'flex flex-wrap items-center gap-3'}>
        {children}
      </div>
    </div>
  );
}
