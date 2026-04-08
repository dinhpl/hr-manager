'use client';

import { toast } from 'sonner';

import { DemoCard, DemoRow, DemoSection } from '@/components/design-system/demo-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

export function SgFeedback() {
  return (
    <DemoSection
      title="Feedback & Status"
      description="Badge, Spinner, Skeleton, Progress, Toast."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <DemoCard label="Badge — Variants">
          <DemoRow>
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </DemoRow>
        </DemoCard>

        <DemoCard label="Spinner — Sizes">
          <DemoRow>
            <Spinner className="size-4" />
            <Spinner className="size-6" />
            <Spinner className="size-8" />
            <Spinner className="size-10 text-primary" />
            <Spinner className="size-10 text-destructive" />
          </DemoRow>
        </DemoCard>

        <DemoCard label="Skeleton">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-20 w-full rounded-lg" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-8 rounded-md" />
              <Skeleton className="h-8 rounded-md" />
              <Skeleton className="h-8 rounded-md" />
            </div>
          </div>
        </DemoCard>

        <DemoCard label="Progress">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Hoàn thành</span>
                <span>75%</span>
              </div>
              <Progress value={75} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Upload</span>
                <span>40%</span>
              </div>
              <Progress value={40} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Xử lý</span>
                <span>10%</span>
              </div>
              <Progress value={10} />
            </div>
          </div>
        </DemoCard>

        <DemoCard label="Toast (Sonner)">
          <DemoRow>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast('Đã lưu thành công!')}
            >
              Default
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success('Cập nhật thành công!')}
            >
              Success
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.error('Đã xảy ra lỗi!')}
            >
              Error
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.warning('Cảnh báo: kiểm tra lại dữ liệu.')}
            >
              Warning
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info('Thông tin cập nhật mới.')}
            >
              Info
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.promise(new Promise((res) => setTimeout(res, 2000)), {
                  loading: 'Đang xử lý...',
                  success: 'Hoàn tất!',
                  error: 'Thất bại',
                })
              }
            >
              Promise
            </Button>
          </DemoRow>
        </DemoCard>
      </div>
    </DemoSection>
  );
}
