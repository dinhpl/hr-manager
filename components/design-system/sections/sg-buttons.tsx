'use client';

import { DownloadIcon, PlusIcon, TrashIcon } from 'lucide-react';

import { DemoCard, DemoRow, DemoSection } from '@/components/design-system/demo-helpers';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function SgButtons() {
  return (
    <DemoSection title="Button" description="Interactive button với nhiều variant, size và trạng thái.">
      <DemoCard label="Variants">
        <DemoRow>
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
        </DemoRow>
      </DemoCard>

      <DemoCard label="Sizes">
        <DemoRow>
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">
            <PlusIcon />
          </Button>
          <Button size="icon-sm">
            <PlusIcon />
          </Button>
          <Button size="icon-lg">
            <PlusIcon />
          </Button>
        </DemoRow>
      </DemoCard>

      <DemoCard label="With Icons & States">
        <DemoRow>
          <Button>
            <PlusIcon />
            Add Record
          </Button>
          <Button variant="outline">
            <DownloadIcon />
            Export
          </Button>
          <Button variant="destructive">
            <TrashIcon />
            Delete
          </Button>
          <Button disabled>
            <Spinner />
            Loading...
          </Button>
          <Button variant="outline" disabled>
            Disabled
          </Button>
        </DemoRow>
      </DemoCard>
    </DemoSection>
  );
}
