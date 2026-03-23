'use client';

import { useMemo } from 'react';

import { colorTokens } from '@/components/design-system/design-system-data';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type DesignSystemShowcaseProps = {
  availableComponents: string[];
};

type ComponentGroup = {
  title: string;
  items: string[];
};

const componentGroupLabels = [
  {
    title: 'Forms & Inputs',
    match: /(input|select|checkbox|radio|switch|slider|form|field|textarea|date|time|otp)/,
  },
  {
    title: 'Feedback & Status',
    match: /(toast|sonner|alert|badge|progress|skeleton|spinner|empty)/,
  },
  {
    title: 'Data Display',
    match:
      /(table|card|chart|avatar|calendar|carousel|accordion|tabs|tooltip|hover-card|separator|scroll-area)/,
  },
  {
    title: 'Navigation & Overlay',
    match:
      /(dialog|drawer|sheet|popover|dropdown|context-menu|menubar|navigation-menu|breadcrumb|pagination|sidebar|command)/,
  },
];

function categorizeComponents(components: string[]): ComponentGroup[] {
  const matched = new Set<string>();

  const groups = componentGroupLabels.map(({ title, match }) => {
    const items = components.filter((component) => match.test(component));
    items.forEach((component) => matched.add(component));
    return { title, items };
  });

  const remaining = components.filter((component) => !matched.has(component));
  if (remaining.length > 0) {
    groups.push({ title: 'Utilities', items: remaining });
  }

  return groups.filter((group) => group.items.length > 0);
}

export function DesignSystemShowcase({ availableComponents }: DesignSystemShowcaseProps) {
  const groupedComponents = useMemo(
    () => categorizeComponents(availableComponents),
    [availableComponents],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-3">
          <Badge variant="outline" className="w-fit">
            /guild-ui
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Guild UI</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Trang tham chiếu tối giản cho frontend. Chỉ giữ lại palette màu và danh sách component
              có thể tái sử dụng từ `components/ui`.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Colors</h2>
            <p className="text-sm text-muted-foreground">
              Token màu đang dùng thực tế trong ứng dụng.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {colorTokens.map((token) => (
              <Card key={token.variable} className="gap-4">
                <CardHeader className="gap-2 border-b">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-sm">{token.name}</CardTitle>
                      <CardDescription>{token.category}</CardDescription>
                    </div>
                    <Badge variant="secondary">{token.variable}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div
                    className="h-20 rounded-lg border border-border"
                    style={{ backgroundColor: `var(${token.variable})` }}
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{token.value}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{token.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Reusable Components</h2>
            <p className="text-sm text-muted-foreground">
              Danh sách này được đọc trực tiếp từ `components/ui` để luôn bám theo code hiện tại.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {groupedComponents.map((group) => (
              <Card key={group.title} className="gap-4">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center justify-between gap-3 text-base">
                    <span>{group.title}</span>
                    <Badge variant="outline">{group.items.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <Badge key={item} variant="secondary" className="font-normal">
                      {item}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
