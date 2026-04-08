'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

import { DemoCard, DemoSection } from '@/components/design-system/demo-helpers';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const chartData = [
  { month: 'T1', nghiPhep: 12, tangCa: 8 },
  { month: 'T2', nghiPhep: 18, tangCa: 5 },
  { month: 'T3', nghiPhep: 9, tangCa: 14 },
  { month: 'T4', nghiPhep: 22, tangCa: 11 },
  { month: 'T5', nghiPhep: 7, tangCa: 19 },
  { month: 'T6', nghiPhep: 15, tangCa: 6 },
];

const chartConfig = {
  nghiPhep: { label: 'Nghỉ phép', color: 'var(--primary)' },
  tangCa: { label: 'Tăng ca', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const tableData = [
  { name: 'Nguyễn Văn A', dept: 'Engineering', status: 'Đã duyệt', days: 5 },
  { name: 'Trần Thị B', dept: 'Design', status: 'Chờ duyệt', days: 2 },
  { name: 'Lê Văn C', dept: 'Product', status: 'Từ chối', days: 3 },
  { name: 'Phạm Thị D', dept: 'Marketing', status: 'Đã duyệt', days: 1 },
];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'Đã duyệt': 'default',
  'Chờ duyệt': 'secondary',
  'Từ chối': 'destructive',
};

export function SgDisplay() {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());

  return (
    <DemoSection
      title="Data Display"
      description="Card, Table, Avatar, Accordion, Tabs, Calendar, Chart, AspectRatio."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Card */}
        <DemoCard label="Card">
          <Card>
            <CardHeader>
              <CardTitle>Tổng quan tháng</CardTitle>
              <CardDescription>Số liệu nghỉ phép và tăng ca tháng 4/2026</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-2xl font-semibold">24</p>
                <p className="text-xs text-muted-foreground">Đơn đã duyệt</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-semibold text-destructive">3</p>
                <p className="text-xs text-muted-foreground">Chờ xử lý</p>
              </div>
            </CardContent>
          </Card>
        </DemoCard>

        {/* Avatar */}
        <DemoCard label="Avatar">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col items-center gap-1">
              <Avatar className="size-6">
                <AvatarImage src="" />
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">xs</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Avatar className="size-8">
                <AvatarFallback>NA</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">sm</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary text-primary-foreground">TB</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">md</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Avatar className="size-14">
                <AvatarFallback className="bg-secondary text-secondary-foreground text-lg">LC</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">lg</span>
            </div>
            <div className="ml-4 flex -space-x-2">
              {['A', 'B', 'C', 'D'].map((l) => (
                <Avatar key={l} className="size-8 border-2 border-background">
                  <AvatarFallback className="text-xs">{l}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        </DemoCard>

        {/* Accordion */}
        <DemoCard label="Accordion">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Chính sách nghỉ phép</AccordionTrigger>
              <AccordionContent>
                Nhân viên được hưởng 12 ngày nghỉ phép có lương mỗi năm. Ngày nghỉ tích lũy theo tháng.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Quy trình tăng ca</AccordionTrigger>
              <AccordionContent>
                Yêu cầu tăng ca phải được manager phê duyệt trước 24 giờ. Phụ cấp tăng ca tính theo hệ số 1.5x.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Comp-off policy</AccordionTrigger>
              <AccordionContent>
                Tăng ca cuối tuần được đổi sang ngày nghỉ bù trong vòng 30 ngày.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </DemoCard>

        {/* Tabs */}
        <DemoCard label="Tabs">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
              <TabsTrigger value="leave">Nghỉ phép</TabsTrigger>
              <TabsTrigger value="overtime">Tăng ca</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-3">
              <p className="text-sm text-muted-foreground">Hiển thị thống kê tổng hợp theo tháng.</p>
            </TabsContent>
            <TabsContent value="leave" className="mt-3">
              <p className="text-sm text-muted-foreground">Danh sách đơn nghỉ phép đã nộp.</p>
            </TabsContent>
            <TabsContent value="overtime" className="mt-3">
              <p className="text-sm text-muted-foreground">Lịch sử tăng ca và phụ cấp.</p>
            </TabsContent>
          </Tabs>
        </DemoCard>

        {/* Calendar */}
        <DemoCard label="Calendar">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
            />
          </div>
        </DemoCard>

        {/* AspectRatio */}
        <DemoCard label="Aspect Ratio">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">16/9</p>
            <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-md bg-muted">
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                16 : 9 container
              </div>
            </AspectRatio>
            <p className="text-xs text-muted-foreground">4/3</p>
            <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-md bg-muted">
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                4 : 3 container
              </div>
            </AspectRatio>
          </div>
        </DemoCard>

        {/* Chart */}
        <DemoCard label="Chart (Bar)" className="lg:col-span-2">
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="nghiPhep" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tangCa" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </DemoCard>

        {/* Table */}
        <DemoCard label="Table" className="lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân viên</TableHead>
                <TableHead>Phòng ban</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Số ngày</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.dept}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DemoCard>
      </div>
    </DemoSection>
  );
}
