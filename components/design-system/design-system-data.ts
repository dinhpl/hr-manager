export type ColorToken = {
  name: string;
  variable: string;
  value: string;
  category: string;
  description: string;
};

export type TypographyToken = {
  name: string;
  sample: string;
  className: string;
  size: string;
  weight: string;
  lineHeight: string;
  note: string;
};

export type MetricToken = {
  name: string;
  value: string;
  previewClassName: string;
  description: string;
};

export const colorTokens: ColorToken[] = [
  {
    name: 'Primary',
    variable: '--primary',
    value: '#1DB87A',
    category: 'Brand',
    description: 'CTA chính, trạng thái active, điểm nhấn thương hiệu.',
  },
  {
    name: 'Secondary',
    variable: '--secondary',
    value: '#D3F2E7',
    category: 'Brand',
    description: 'Bề mặt nhấn nhẹ, chip phụ, khu vực hỗ trợ.',
  },
  {
    name: 'Foreground',
    variable: '--foreground',
    value: '#203430',
    category: 'Neutral',
    description: 'Màu chữ chính trên nền sáng.',
  },
  {
    name: 'Background',
    variable: '--background',
    value: '#F7F7F7',
    category: 'Neutral',
    description: 'Canvas nền mặc định của ứng dụng.',
  },
  {
    name: 'Card',
    variable: '--card',
    value: '#FFFFFF',
    category: 'Surface',
    description: 'Bề mặt card, dialog, container nổi.',
  },
  {
    name: 'Muted',
    variable: '--muted',
    value: '#F0F4F2',
    category: 'Neutral',
    description: 'Nền phụ cho trạng thái nhẹ và section phân tách.',
  },
  {
    name: 'Muted Foreground',
    variable: '--muted-foreground',
    value: '#6B7F78',
    category: 'Neutral',
    description: 'Chữ phụ, hint text, caption.',
  },
  {
    name: 'Accent',
    variable: '--accent',
    value: '#D3F2E7',
    category: 'Brand',
    description: 'Hover/selected states và interactive surfaces.',
  },
  {
    name: 'Destructive',
    variable: '--destructive',
    value: '#EF4444',
    category: 'Status',
    description: 'Xóa, lỗi nghiêm trọng, hành động nguy hiểm.',
  },
  {
    name: 'Border',
    variable: '--border',
    value: '#E2EDE9',
    category: 'Neutral',
    description: 'Viền input, card và vùng phân tách.',
  },
  {
    name: 'Input',
    variable: '--input',
    value: '#E2EDE9',
    category: 'Neutral',
    description: 'Viền và nền input theo theme.',
  },
  {
    name: 'Ring',
    variable: '--ring',
    value: '#1DB87A',
    category: 'Status',
    description: 'Focus ring cho accessibility.',
  },
  {
    name: 'Sidebar',
    variable: '--sidebar',
    value: '#FFFFFF',
    category: 'Surface',
    description: 'Nền vùng điều hướng trái.',
  },
  {
    name: 'Sidebar Primary',
    variable: '--sidebar-primary',
    value: '#1DB87A',
    category: 'Brand',
    description: 'Điểm nhấn chính trong sidebar.',
  },
  {
    name: 'Chart 1',
    variable: '--chart-1',
    value: '#1DB87A',
    category: 'Chart',
    description: 'Tone dữ liệu chính cho biểu đồ.',
  },
  {
    name: 'Chart 2',
    variable: '--chart-2',
    value: '#0E474E',
    category: 'Chart',
    description: 'Tone dữ liệu phụ đậm.',
  },
  {
    name: 'Chart 3',
    variable: '--chart-3',
    value: '#D3F2E7',
    category: 'Chart',
    description: 'Tone nền nhạt cho series phụ.',
  },
  {
    name: 'Chart 4',
    variable: '--chart-4',
    value: '#6EE7B7',
    category: 'Chart',
    description: 'Tone tăng trưởng / success.',
  },
  {
    name: 'Chart 5',
    variable: '--chart-5',
    value: '#A7F3D0',
    category: 'Chart',
    description: 'Tone hỗ trợ, vùng fill nhẹ.',
  },
  {
    name: 'Jade',
    variable: '--jade',
    value: '#1DB87A',
    category: 'Brand Alias',
    description: 'Alias brand trực tiếp cho các trường hợp custom.',
  },
  {
    name: 'Eagle Green',
    variable: '--eagle-green',
    value: '#0E474E',
    category: 'Brand Alias',
    description: 'Alias nền đậm và hero gradients.',
  },
  {
    name: 'Aero Blue',
    variable: '--aero-blue',
    value: '#D3F2E7',
    category: 'Brand Alias',
    description: 'Alias nền sáng mang tính thương hiệu.',
  },
];

export const typographyTokens: TypographyToken[] = [
  {
    name: 'Display',
    sample: 'Leave Management System',
    className: 'text-4xl font-bold tracking-tight md:text-5xl',
    size: '36-48px',
    weight: '700',
    lineHeight: '1.0-1.1',
    note: 'Dùng cho hero hoặc page title đặc biệt.',
  },
  {
    name: 'Heading 1',
    sample: 'UI Guidelines / Design System',
    className: 'text-3xl font-semibold tracking-tight',
    size: '30px',
    weight: '600',
    lineHeight: '1.15',
    note: 'Page heading cấp cao nhất.',
  },
  {
    name: 'Heading 2',
    sample: 'Components Playground',
    className: 'text-2xl font-semibold tracking-tight',
    size: '24px',
    weight: '600',
    lineHeight: '1.2',
    note: 'Section heading cho block lớn.',
  },
  {
    name: 'Heading 3',
    sample: 'Form Controls',
    className: 'text-xl font-semibold',
    size: '20px',
    weight: '600',
    lineHeight: '1.3',
    note: 'Subsection heading.',
  },
  {
    name: 'Body Large',
    sample: 'Thiết kế nhất quán giúp team build nhanh và ít drift UI.',
    className: 'text-base font-normal leading-7',
    size: '16px',
    weight: '400',
    lineHeight: '1.75',
    note: 'Mô tả dài, intro copy, empty-state detail.',
  },
  {
    name: 'Body',
    sample: 'Đây là kiểu chữ mặc định của phần lớn nội dung.',
    className: 'text-sm font-normal leading-6',
    size: '14px',
    weight: '400',
    lineHeight: '1.5',
    note: 'Default cho form text và bảng thông tin.',
  },
  {
    name: 'Label',
    sample: 'Employee status',
    className: 'text-sm font-medium leading-none',
    size: '14px',
    weight: '500',
    lineHeight: '1',
    note: 'Label của field và item controls.',
  },
  {
    name: 'Caption',
    sample: 'Last synced 2 minutes ago',
    className: 'text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground',
    size: '12px',
    weight: '500',
    lineHeight: '1.3',
    note: 'Metadata, eyebrow, secondary context.',
  },
];

export const spacingTokens: MetricToken[] = [
  {
    name: '4',
    value: '0.25rem / 4px',
    previewClassName: 'h-1 w-1',
    description: 'Micro spacing giữa icon và text nhỏ.',
  },
  {
    name: '8',
    value: '0.5rem / 8px',
    previewClassName: 'h-2 w-2',
    description: 'Gap phổ biến cho controls compact.',
  },
  {
    name: '12',
    value: '0.75rem / 12px',
    previewClassName: 'h-3 w-3',
    description: 'Padding nội bộ cho cell và card nhỏ.',
  },
  {
    name: '16',
    value: '1rem / 16px',
    previewClassName: 'h-4 w-4',
    description: 'Khoảng cách tiêu chuẩn của form và content block.',
  },
  {
    name: '20',
    value: '1.25rem / 20px',
    previewClassName: 'h-5 w-5',
    description: 'Section spacing cho card overview.',
  },
  {
    name: '24',
    value: '1.5rem / 24px',
    previewClassName: 'h-6 w-6',
    description: 'Padding card, dialog content.',
  },
  {
    name: '32',
    value: '2rem / 32px',
    previewClassName: 'h-8 w-8',
    description: 'Khoảng cách giữa các section lớn.',
  },
];

export const radiusTokens: MetricToken[] = [
  {
    name: 'radius-sm',
    value: '0.5rem / 8px',
    previewClassName: 'rounded-sm',
    description: 'Chip nhỏ, tag gọn, states compact.',
  },
  {
    name: 'radius-md',
    value: '0.625rem / 10px',
    previewClassName: 'rounded-md',
    description: 'Input, button, controls mặc định.',
  },
  {
    name: 'radius-lg',
    value: '0.75rem / 12px',
    previewClassName: 'rounded-lg',
    description: 'Card nhỏ và panel thông dụng.',
  },
  {
    name: 'radius-xl',
    value: '1rem / 16px',
    previewClassName: 'rounded-xl',
    description: 'Surface lớn, metric cards, blocks chính.',
  },
  {
    name: 'full',
    value: '9999px',
    previewClassName: 'rounded-full',
    description: 'Pill badge, avatar, status dots.',
  },
];

export const shadowTokens: MetricToken[] = [
  {
    name: 'shadow-xs',
    value: 'Subtle control shadow',
    previewClassName: 'shadow-xs',
    description: 'Buttons, inputs, checkbox, switch.',
  },
  {
    name: 'shadow-sm',
    value: 'Small surface elevation',
    previewClassName: 'shadow-sm',
    description: 'Card mặc định và tab active.',
  },
  {
    name: 'shadow-md',
    value: 'Floating panel elevation',
    previewClassName: 'shadow-md',
    description: 'Popover, dropdown, expanded surfaces.',
  },
  {
    name: 'shadow-lg',
    value: 'Dialog / overlay elevation',
    previewClassName: 'shadow-lg',
    description: 'Modal, sheet, emphasized cards.',
  },
  {
    name: 'shadow-xl',
    value: 'High emphasis',
    previewClassName: 'shadow-xl',
    description: 'Chart card hoặc hero surfaces.',
  },
  {
    name: 'shadow-2xl',
    value: 'Maximum emphasis',
    previewClassName: 'shadow-2xl',
    description: 'Large modals và special marketing surfaces.',
  },
];
