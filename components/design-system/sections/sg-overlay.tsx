'use client';

import * as React from 'react';
import { HomeIcon, MoreHorizontalIcon } from 'lucide-react';

import { DemoCard, DemoRow, DemoSection } from '@/components/design-system/demo-helpers';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function SgOverlay() {
  return (
    <DemoSection
      title="Navigation & Overlay"
      description="Dialog, Drawer, Dropdown, Tooltip, Popover, Breadcrumb, Pagination, Resizable."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dialog */}
        <DemoCard label="Dialog">
          <DemoRow>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Mở Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Xác nhận hành động</DialogTitle>
                  <DialogDescription>
                    Bạn có chắc muốn thực hiện thao tác này? Không thể hoàn tác.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dialog-name">Tên nhân viên</Label>
                    <Input id="dialog-name" placeholder="Nguyễn Văn A" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline">Hủy</Button>
                  <Button>Xác nhận</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </DemoRow>
        </DemoCard>

        {/* Drawer */}
        <DemoCard label="Drawer">
          <DemoRow>
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline">Mở Drawer</Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Tạo đơn nghỉ phép</DrawerTitle>
                  <DrawerDescription>
                    Điền thông tin và gửi đơn để được phê duyệt.
                  </DrawerDescription>
                </DrawerHeader>
                <div className="px-4 py-2 space-y-3">
                  <div className="space-y-1.5">
                    <Label>Lý do nghỉ</Label>
                    <Input placeholder="Nhập lý do..." />
                  </div>
                </div>
                <DrawerFooter>
                  <Button>Gửi đơn</Button>
                  <DrawerClose asChild>
                    <Button variant="outline">Hủy</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </DemoRow>
        </DemoCard>

        {/* Dropdown */}
        <DemoCard label="Dropdown Menu">
          <DemoRow>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreHorizontalIcon />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Xem chi tiết</DropdownMenuItem>
                <DropdownMenuItem>Chỉnh sửa</DropdownMenuItem>
                <DropdownMenuItem>Xuất Excel</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">Xóa</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DemoRow>
        </DemoCard>

        {/* Tooltip */}
        <DemoCard label="Tooltip">
          <DemoRow>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover vào đây</Button>
              </TooltipTrigger>
              <TooltipContent>Đây là tooltip giải thích hành động</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost">
                  <HomeIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Trang chủ</TooltipContent>
            </Tooltip>
          </DemoRow>
        </DemoCard>

        {/* Popover */}
        <DemoCard label="Popover">
          <DemoRow>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Mở Popover</Button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">Cài đặt thông báo</h4>
                    <p className="text-xs text-muted-foreground">
                      Chọn loại thông báo bạn muốn nhận.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="popover-email">Email</Label>
                    <Input id="popover-email" placeholder="user@example.com" />
                  </div>
                  <Button size="sm" className="w-full">Lưu cài đặt</Button>
                </div>
              </PopoverContent>
            </Popover>
          </DemoRow>
        </DemoCard>

        {/* Breadcrumb */}
        <DemoCard label="Breadcrumb">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">
                  <HomeIcon className="size-3.5" />
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbEllipsis />
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Nghỉ phép</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </DemoCard>

        {/* Pagination */}
        <DemoCard label="Pagination" className="lg:col-span-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">1</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>2</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">3</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">10</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </DemoCard>

        {/* Resizable */}
        <DemoCard label="Resizable Panels" className="lg:col-span-2">
          <div className="h-32 rounded-lg border">
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={30} minSize={20}>
                <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                  Panel A
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={40} minSize={20}>
                <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                  Panel B
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={30} minSize={20}>
                <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                  Panel C
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </DemoCard>
      </div>
    </DemoSection>
  );
}
