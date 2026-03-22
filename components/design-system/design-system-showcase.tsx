'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Component, Layers3, PaintBucket, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  colorTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  typographyTokens,
} from '@/components/design-system/design-system-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type DesignSystemShowcaseProps = {
  availableComponents: string[];
};

type ComponentGroup = {
  title: string;
  items: string[];
};

const buttonVariants = ['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'] as const;
const buttonSizes = ['sm', 'default', 'lg'] as const;
const badgeVariants = ['default', 'secondary', 'outline', 'destructive'] as const;

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

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border bg-[#10231f] p-4 text-xs leading-6 text-[#d9f8ed]">
      <code>{code}</code>
    </pre>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ShowcaseCard({
  title,
  description,
  preview,
  code,
}: {
  title: string;
  description: string;
  preview: React.ReactNode;
  code: string;
}) {
  return (
    <Card className="border-border/80 gap-4 bg-card/95">
      <CardHeader className="gap-3 border-b">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-sm leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
          {preview}
        </div>
        <CodeBlock code={code} />
      </CardContent>
    </Card>
  );
}

function MetricSwatch({
  name,
  value,
  description,
  previewClassName,
}: {
  name: string;
  value: string;
  description: string;
  previewClassName: string;
}) {
  return (
    <Card className="gap-4">
      <CardHeader className="gap-2 border-b">
        <CardTitle className="text-sm">{name}</CardTitle>
        <CardDescription>{value}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex min-h-24 items-center justify-center rounded-xl border bg-background">
          <div
            className={`bg-primary/15 ${previewClassName} min-h-5 min-w-5 border border-primary/20`}
          />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function categorizeComponents(components: string[]): ComponentGroup[] {
  const matched = new Set<string>();

  const groups = componentGroupLabels.map(({ title, match }) => {
    const items = components.filter((component) => match.test(component));
    items.forEach((component) => matched.add(component));
    return { title, items };
  });

  const remaining = components.filter((component) => !matched.has(component));
  if (remaining.length > 0) {
    groups.push({ title: 'Utilities & Other Primitives', items: remaining });
  }

  return groups.filter((group) => group.items.length > 0);
}

export function DesignSystemShowcase({ availableComponents }: DesignSystemShowcaseProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('hr');
  const groupedComponents = useMemo(
    () => categorizeComponents(availableComponents),
    [availableComponents],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(29,184,122,0.14),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(247,247,247,1))]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-lg backdrop-blur">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:px-10 lg:py-10">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Route /guild-ui
                </Badge>
                <Badge variant="outline">Frontend UI Standard</Badge>
                <Badge variant="outline">Storybook-ready structure</Badge>
              </div>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                  UI Guidelines / Design System Playground
                </h1>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                  Màn này tổng hợp design tokens, inventory của thư viện UI hiện có và playground
                  tương tác cho các trạng thái phổ biến. Đây là điểm tham chiếu để team dùng lại
                  component thống nhất, giảm drift style và tạo nền cho Storybook sau này.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="gap-3 bg-background/70">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <PaintBucket className="size-4 text-primary" />
                      Token source of truth
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-6 text-muted-foreground">
                    `app/globals.css` đang là nguồn token thực tế của frontend.
                  </CardContent>
                </Card>
                <Card className="gap-3 bg-background/70">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Component className="size-4 text-primary" />
                      UI primitives inventory
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-6 text-muted-foreground">
                    {availableComponents.length} component primitives đang có trong `components/ui`.
                  </CardContent>
                </Card>
                <Card className="gap-3 bg-background/70">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Wand2 className="size-4 text-primary" />
                      Main drift found
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm leading-6 text-muted-foreground">
                    Một số màn như login còn dùng inline style, chưa bám trọn bộ primitives hiện có.
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="gap-4 border-primary/15 bg-[linear-gradient(180deg,rgba(211,242,231,0.65),rgba(255,255,255,0.95))]">
              <CardHeader className="border-b">
                <CardTitle className="text-lg">Review snapshot</CardTitle>
                <CardDescription>Các điểm nổi bật sau khi rà frontend hiện tại.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-6 text-[#33514b]">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
                  <p>
                    Core UI primitives đã khá đầy đủ: button, form controls, overlay, feedback, data
                    display.
                  </p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
                  <p>
                    Tokens màu và radius đã được chuẩn hóa theo CSS variables, đủ để scale tiếp.
                  </p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
                  <p>
                    Thiếu một showcase tập trung nên dev khó biết variant nào là chuẩn để tái sử
                    dụng.
                  </p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
                  <p>
                    Module `components/design-system` mới giúp tách riêng tài liệu UI khỏi business
                    pages.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="inventory" className="space-y-6">
          <SectionTitle
            eyebrow="Inventory"
            title="Current UI component registry"
            description="Danh sách được lấy từ thư mục `components/ui` để tránh tài liệu lỗi thời khi team thêm hoặc đổi component."
          />
          <div className="grid gap-6 lg:grid-cols-2">
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
                    <Badge
                      key={item}
                      variant="secondary"
                      className="bg-secondary/50 text-secondary-foreground"
                    >
                      {item}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="tokens" className="space-y-6">
          <SectionTitle
            eyebrow="Tokens"
            title="Color, typography, spacing, radius and shadow"
            description="Các token dưới đây bám theo palette và scale đang dùng thực tế trong frontend. Đây là nơi team có thể đối chiếu trước khi viết style mới."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {colorTokens.map((token) => (
              <Card key={token.variable} className="gap-4">
                <CardHeader className="gap-2 border-b">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm">{token.name}</CardTitle>
                      <CardDescription>{token.category}</CardDescription>
                    </div>
                    <Badge variant="outline">{token.variable}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="h-24 rounded-xl border border-border/80"
                    style={{ backgroundColor: `var(${token.variable})` }}
                  />
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-foreground">{token.value}</p>
                    <p className="leading-6 text-muted-foreground">{token.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="gap-5">
              <CardHeader className="border-b">
                <CardTitle>Typography scale</CardTitle>
                <CardDescription>Inter đang là font sans thực tế của app layout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {typographyTokens.map((token) => (
                  <div key={token.name} className="rounded-xl border bg-background/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className={token.className}>{token.sample}</p>
                        <p className="text-sm text-muted-foreground">{token.note}</p>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>{token.size}</p>
                        <p>{token.weight}</p>
                        <p>{token.lineHeight}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card className="gap-4">
                <CardHeader className="border-b">
                  <CardTitle>Spacing scale</CardTitle>
                  <CardDescription>
                    Những bước spacing đang xuất hiện nhiều nhất trong codebase.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {spacingTokens.map((token) => (
                    <MetricSwatch key={token.name} {...token} />
                  ))}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="gap-4">
                  <CardHeader className="border-b">
                    <CardTitle>Border radius</CardTitle>
                    <CardDescription>
                      Shape language đang dùng cho controls và surfaces.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {radiusTokens.map((token) => (
                      <MetricSwatch key={token.name} {...token} />
                    ))}
                  </CardContent>
                </Card>

                <Card className="gap-4">
                  <CardHeader className="border-b">
                    <CardTitle>Shadow system</CardTitle>
                    <CardDescription>
                      Tailwind shadow levels đang được dùng thực tế trong UI.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {shadowTokens.map((token) => (
                      <Card key={token.name} className="gap-4 bg-background/80">
                        <CardContent className="space-y-4 pt-6">
                          <div
                            className={`rounded-xl border bg-card p-6 ${token.previewClassName}`}
                          >
                            <p className="text-sm font-medium">{token.name}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{token.value}</p>
                            <p className="text-sm leading-6 text-muted-foreground">
                              {token.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="playground" className="space-y-6">
          <SectionTitle
            eyebrow="Playground"
            title="Component states, variants and usage examples"
            description="Mỗi component trọng tâm đều có preview trạng thái, biến thể và ví dụ dùng lại để team copy sang màn business mà không phải tự nghĩ lại style."
          />

          <Tabs defaultValue="forms" className="gap-6">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="forms">Forms</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="data-display">Data display</TabsTrigger>
              <TabsTrigger value="navigation-overlay">Navigation & overlay</TabsTrigger>
            </TabsList>

            <TabsContent value="forms" className="grid gap-6 xl:grid-cols-2">
              <ShowcaseCard
                title="Button"
                description="Chuẩn hóa theo `variant` và `size`. Nên dùng `Button` thay vì tự viết class lặp lại ở business pages."
                preview={
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-3">
                      {buttonVariants.map((variant) => (
                        <Button key={variant} variant={variant}>
                          {variant}
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {buttonSizes.map((size) => (
                        <Button key={size} size={size}>
                          {size}
                        </Button>
                      ))}
                      <Button disabled>disabled</Button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button className="pointer-events-none bg-primary/90">hover</Button>
                      <Button className="pointer-events-none scale-[0.98] bg-primary/80 shadow-none">
                        active
                      </Button>
                      <Button aria-invalid>error</Button>
                    </div>
                  </div>
                }
                code={`<Button variant="default">Lưu thay đổi</Button>
<Button variant="outline" size="sm">Huỷ</Button>
<Button variant="destructive" disabled>Xoá nhân viên</Button>`}
              />

              <ShowcaseCard
                title="Input / Textarea / Select"
                description="Field states thống nhất cho form. `aria-invalid` là hook chuẩn cho error style."
                preview={
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="default-input">Default input</Label>
                      <Input id="default-input" placeholder="hr@onetech.vn" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="error-input">Error input</Label>
                      <Input id="error-input" aria-invalid defaultValue="sai-format" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="textarea-demo">Textarea</Label>
                      <Textarea
                        id="textarea-demo"
                        defaultValue="Nhập ghi chú cho yêu cầu nghỉ phép..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Department select</Label>
                      <Select defaultValue="hr">
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn phòng ban" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hr">HR</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="operations">Operations</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                }
                code={`<Label htmlFor="department">Phòng ban</Label>
<Select defaultValue="hr">
  <SelectTrigger id="department">
    <SelectValue placeholder="Chọn phòng ban" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="hr">HR</SelectItem>
  </SelectContent>
</Select>`}
              />

              <ShowcaseCard
                title="Checkbox / Radio / Switch"
                description="Các control lựa chọn cần dùng cùng `Label` để đảm bảo click target và accessibility."
                preview={
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Checkbox id="policy" defaultChecked />
                        <Label htmlFor="policy">Đã đọc chính sách</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Checkbox id="policy-disabled" disabled />
                        <Label htmlFor="policy-disabled">Disabled</Label>
                      </div>
                    </div>
                    <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="hr" id="role-hr" />
                        <Label htmlFor="role-hr">HR</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="manager" id="role-manager" />
                        <Label htmlFor="role-manager">Manager</Label>
                      </div>
                    </RadioGroup>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3">
                        <Label htmlFor="switch-1">Nhận email thông báo</Label>
                        <Switch id="switch-1" defaultChecked />
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3">
                        <Label htmlFor="switch-2">Khoá chỉnh sửa</Label>
                        <Switch id="switch-2" disabled />
                      </div>
                    </div>
                  </div>
                }
                code={`<div className="flex items-center gap-3">
  <Checkbox id="policy" defaultChecked />
  <Label htmlFor="policy">Đã đọc chính sách</Label>
</div>

<RadioGroup defaultValue="hr">
  <RadioGroupItem value="hr" id="role-hr" />
</RadioGroup>`}
              />
            </TabsContent>

            <TabsContent value="feedback" className="grid gap-6 xl:grid-cols-2">
              <ShowcaseCard
                title="Badge / Status tag"
                description="Dùng để thể hiện trạng thái ngắn, filter pills hoặc metadata nổi bật."
                preview={
                  <div className="flex flex-wrap gap-3">
                    {badgeVariants.map((variant) => (
                      <Badge key={variant} variant={variant}>
                        {variant}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      on leave
                    </Badge>
                  </div>
                }
                code={`<Badge>Approved</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Rejected</Badge>`}
              />

              <ShowcaseCard
                title="Toast / Notification"
                description="Project đang dùng Sonner. Đây là pattern chuẩn cho success, info và error notification."
                preview={
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() =>
                        toast.success('Đã lưu cấu hình chấm công.', {
                          description: 'Thay đổi đã được áp dụng cho toàn hệ thống.',
                        })
                      }
                    >
                      Success toast
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        toast.info('Đang đồng bộ dữ liệu nhân viên.', {
                          description: 'Quá trình này có thể mất vài giây.',
                        })
                      }
                    >
                      Info toast
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        toast.error('Không thể lưu yêu cầu.', {
                          description: 'Vui lòng kiểm tra lại các trường bắt buộc.',
                        })
                      }
                    >
                      Error toast
                    </Button>
                  </div>
                }
                code={`toast.success("Đã lưu cấu hình chấm công.", {
  description: "Thay đổi đã được áp dụng cho toàn hệ thống.",
})`}
              />

              <ShowcaseCard
                title="Loading / Skeleton / Progress"
                description="Skeleton cho loading layout, spinner cho tác vụ cục bộ, progress cho tiến trình rõ ràng."
                preview={
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <Button disabled>
                        <Spinner className="size-4" />
                        Đang xử lý...
                      </Button>
                      <div className="text-sm text-muted-foreground">Inline loading state</div>
                    </div>
                    <div className="grid gap-3 rounded-xl border bg-background p-4">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-10/12" />
                      <Skeleton className="h-10 w-32" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Đồng bộ payroll</span>
                        <span>72%</span>
                      </div>
                      <Progress value={72} />
                    </div>
                  </div>
                }
                code={`<Button disabled>
  <Spinner className="size-4" />
  Đang xử lý...
</Button>

<Skeleton className="h-4 w-full" />
<Progress value={72} />`}
              />
            </TabsContent>

            <TabsContent value="data-display" className="grid gap-6 xl:grid-cols-2">
              <ShowcaseCard
                title="Card"
                description="Card nên là container mặc định cho summary blocks, filters và detail panes."
                preview={
                  <Card className="gap-4 bg-background">
                    <CardHeader className="border-b">
                      <CardTitle>Annual leave balance</CardTitle>
                      <CardDescription>Realtime snapshot for current employee.</CardDescription>
                      <CardAction>
                        <Badge>Synced</Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl bg-muted/60 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Allocated
                        </p>
                        <p className="mt-2 text-2xl font-semibold">12.0</p>
                      </div>
                      <div className="rounded-xl bg-muted/60 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Used
                        </p>
                        <p className="mt-2 text-2xl font-semibold">4.5</p>
                      </div>
                      <div className="rounded-xl bg-muted/60 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Remaining
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-primary">7.5</p>
                      </div>
                    </CardContent>
                    <CardFooter className="justify-end border-t">
                      <Button variant="outline">View history</Button>
                    </CardFooter>
                  </Card>
                }
                code={`<Card>
  <CardHeader>
    <CardTitle>Annual leave balance</CardTitle>
    <CardDescription>Realtime snapshot for current employee.</CardDescription>
  </CardHeader>
  <CardContent>{/* metrics */}</CardContent>
</Card>`}
              />

              <ShowcaseCard
                title="Table"
                description="Bảng dữ liệu nên dùng primitives có sẵn để giữ consistency về hover, spacing và typography."
                preview={
                  <Table>
                    <TableCaption>Danh sách đơn nghỉ gần đây</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nhân viên</TableHead>
                        <TableHead>Loại nghỉ</TableHead>
                        <TableHead>Ngày</TableHead>
                        <TableHead className="text-right">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Nguyễn Văn A</TableCell>
                        <TableCell>Annual Leave</TableCell>
                        <TableCell>23/03/2026</TableCell>
                        <TableCell className="text-right">
                          <Badge>Approved</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow data-state="selected">
                        <TableCell>Trần Thị B</TableCell>
                        <TableCell>WFH</TableCell>
                        <TableCell>24/03/2026</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">Pending</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Lê Minh C</TableCell>
                        <TableCell>Sick Leave</TableCell>
                        <TableCell>25/03/2026</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">Rejected</Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                }
                code={`<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Nhân viên</TableHead>
      <TableHead className="text-right">Trạng thái</TableHead>
    </TableRow>
  </TableHeader>
</Table>`}
              />
            </TabsContent>

            <TabsContent value="navigation-overlay" className="grid gap-6 xl:grid-cols-2">
              <ShowcaseCard
                title="Dialog / Modal"
                description="Dùng stack `Dialog` chung để giữ overlay, close button, spacing và footer actions đồng nhất."
                preview={
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>Mở dialog mẫu</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Xác nhận duyệt đơn nghỉ</DialogTitle>
                        <DialogDescription>
                          Kiểm tra lại thông tin trước khi gửi quyết định tới nhân viên.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Nhân viên</span>
                          <span className="font-medium">Nguyễn Văn A</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Loại nghỉ</span>
                          <span className="font-medium">Annual Leave</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Thời gian</span>
                          <span className="font-medium">23/03/2026 - 24/03/2026</span>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                          Huỷ
                        </Button>
                        <Button onClick={() => setDialogOpen(false)}>Duyệt đơn</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                }
                code={`<Dialog>
  <DialogTrigger asChild>
    <Button>Mở dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Xác nhận duyệt đơn nghỉ</DialogTitle>
    </DialogHeader>
  </DialogContent>
</Dialog>`}
              />

              <ShowcaseCard
                title="Pagination"
                description="Pagination dùng lại button variants, phù hợp cho list/table page và report screens."
                preview={
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious href="#pagination" />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#pagination">1</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#pagination" isActive>
                          2
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink href="#pagination">3</PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext href="#pagination" />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                }
                code={`<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="?page=1" />
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="?page=2" isActive>2</PaginationLink>
    </PaginationItem>
  </PaginationContent>
</Pagination>`}
              />
            </TabsContent>
          </Tabs>
        </section>

        <section id="guidelines" className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="gap-4">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="size-4 text-primary" />
                Reuse guidelines
              </CardTitle>
              <CardDescription>Các rule nên bám theo khi team mở rộng UI về sau.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                Ưu tiên compose từ `components/ui/*`, chỉ thêm class ở layer màn hình khi thật sự là
                layout-specific.
              </p>
              <p>
                States lỗi nên dùng `aria-invalid`, trạng thái loading nên dùng `Spinner` hoặc
                `Skeleton`, notification dùng `toast.success/info/error`.
              </p>
              <p>
                Token mới nên khai báo ở `app/globals.css` trước, sau đó bổ sung vào showcase này để
                documentation luôn theo kịp code.
              </p>
              <p>
                Khi component bắt đầu có nhiều business flavors, tách wrapper vào
                `components/design-system` hoặc `components/features/*` thay vì copy class vào từng
                page.
              </p>
            </CardContent>
          </Card>

          <Card className="gap-4 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(211,242,231,0.45))]">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Future Storybook path
              </CardTitle>
              <CardDescription>
                Route này đã được tách theo module để dễ nâng cấp tiếp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                `app/guild-ui/page.tsx` chỉ đóng vai trò entry, còn token metadata và showcase logic
                ở `components/design-system/*`.
              </p>
              <p>
                Cấu trúc này có thể map trực tiếp sang Storybook stories về sau mà không cần bóc
                tách lại business page.
              </p>
              <p>
                Naming hiện tại bám theo `design-system-*`, đủ rõ để sau này đổi thành module
                `ui-system` nếu team muốn chuẩn hóa thêm.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
