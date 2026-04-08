import type { Metadata } from 'next';

import { StyleGuideShowcase } from '@/components/design-system/style-guide-showcase';

export const metadata: Metadata = {
  title: 'Style Guide | HR Management System',
  description: 'Demo toàn bộ UI components đang có trong components/ui.',
};

export default function StyleGuidePage() {
  return <StyleGuideShowcase />;
}
