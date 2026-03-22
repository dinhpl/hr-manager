import type { Metadata } from 'next';
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { DesignSystemShowcase } from '@/components/design-system/design-system-showcase';

export const metadata: Metadata = {
  title: 'UI Guidelines | Leave Management System',
  description: 'UI playground và design system showcase cho frontend của Leave Management System.',
};

function getAvailableUiComponents() {
  const uiDirectory = path.join(process.cwd(), 'components', 'ui');

  return readdirSync(uiDirectory)
    .filter((fileName) => fileName.endsWith('.tsx'))
    .map((fileName) => fileName.replace(/\.tsx$/, ''))
    .sort((left, right) => left.localeCompare(right));
}

export default function GuildUiPage() {
  const availableComponents = getAvailableUiComponents();

  return <DesignSystemShowcase availableComponents={availableComponents} />;
}
