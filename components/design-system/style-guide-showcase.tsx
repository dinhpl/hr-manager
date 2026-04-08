'use client';

import { colorTokens } from '@/components/design-system/design-system-data';
import { SgButtons } from '@/components/design-system/sections/sg-buttons';
import { SgDisplay } from '@/components/design-system/sections/sg-display';
import { SgFeedback } from '@/components/design-system/sections/sg-feedback';
import { SgInputs } from '@/components/design-system/sections/sg-inputs';
import { SgOverlay } from '@/components/design-system/sections/sg-overlay';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function StyleGuideShowcase() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <section className="space-y-3">
          <Badge variant="outline" className="w-fit">
            /style-guide
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Style Guide</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Demo toàn bộ component trong{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                components/ui
              </code>
              . Bao gồm palette màu, typography, và interactive components.
            </p>
          </div>
        </section>

        <Separator />

        {/* Colors */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Colors</h2>
            <p className="text-sm text-muted-foreground">Token màu đang dùng trong ứng dụng.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {colorTokens.map((token) => (
              <Card key={token.variable} className="gap-3">
                <CardHeader className="gap-2 border-b pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-sm">{token.name}</CardTitle>
                      <CardDescription>{token.category}</CardDescription>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {token.variable}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div
                    className="h-14 rounded-md border"
                    style={{ backgroundColor: `var(${token.variable})` }}
                  />
                  <p className="text-xs text-muted-foreground">{token.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />
        <SgButtons />

        <Separator />
        <SgInputs />

        <Separator />
        <SgFeedback />

        <Separator />
        <SgDisplay />

        <Separator />
        <SgOverlay />
      </div>
    </div>
  );
}
