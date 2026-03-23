import type { Metadata } from 'next';
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { DesignSystemShowcase } from '@/components/design-system/design-system-showcase';

export const metadata: Metadata = {
  title: 'Guild UI | Leave Management System',
  description: 'Trang tham chiếu UI tối giản cho palette màu và reusable components.',
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
