'use client';

import * as React from 'react';

import { DemoCard, DemoRow, DemoSection } from '@/components/design-system/demo-helpers';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const FRAMEWORK_OPTIONS = [
  { value: 'next', label: 'Next.js' },
  { value: 'remix', label: 'Remix' },
  { value: 'astro', label: 'Astro' },
  { value: 'nuxt', label: 'Nuxt.js' },
  { value: 'sveltekit', label: 'SvelteKit' },
];

export function SgInputs() {
  const [comboValue, setComboValue] = React.useState('');
  const [sliderValue, setSliderValue] = React.useState([40]);
  const [switchChecked, setSwitchChecked] = React.useState(false);
  const [date, setDate] = React.useState<string | undefined>();

  return (
    <DemoSection title="Form Controls" description="Input, Select, Checkbox, Radio, Switch, Slider, Combobox và DatePicker.">
      <div className="grid gap-4 lg:grid-cols-2">
        <DemoCard label="Input & Label">
          <DemoRow vertical>
            <div className="space-y-2">
              <Label htmlFor="sg-input">Full Name</Label>
              <Input id="sg-input" placeholder="Nguyễn Văn A" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sg-input-disabled">Disabled</Label>
              <Input id="sg-input-disabled" placeholder="Read only" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sg-input-error" className="text-destructive">
                Email (Error)
              </Label>
              <Input
                id="sg-input-error"
                placeholder="user@example.com"
                aria-invalid
                defaultValue="not-an-email"
              />
            </div>
          </DemoRow>
        </DemoCard>

        <DemoCard label="Textarea">
          <DemoRow vertical>
            <div className="space-y-2">
              <Label htmlFor="sg-textarea">Ghi chú</Label>
              <Textarea id="sg-textarea" placeholder="Nhập nội dung..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sg-textarea-disabled">Disabled</Label>
              <Textarea id="sg-textarea-disabled" placeholder="Read only" disabled rows={2} />
            </div>
          </DemoRow>
        </DemoCard>

        <DemoCard label="Select">
          <DemoRow vertical>
            <div className="space-y-2">
              <Label>Phòng ban</Label>
              <Select>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="engineering">Engineering</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Disabled</Label>
              <Select disabled>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Không thể chọn" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">Option A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DemoRow>
        </DemoCard>

        <DemoCard label="Combobox (Searchable)">
          <DemoRow vertical>
            <div className="space-y-2">
              <Label>Framework</Label>
              <Combobox
                options={FRAMEWORK_OPTIONS}
                value={comboValue}
                onValueChange={setComboValue}
                placeholder="Chọn framework..."
                searchPlaceholder="Tìm kiếm..."
                emptyText="Không tìm thấy."
                className="w-full"
              />
            </div>
          </DemoRow>
        </DemoCard>

        <DemoCard label="Checkbox & Radio Group">
          <DemoRow vertical>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Checkbox
              </p>
              <div className="flex items-center gap-2">
                <Checkbox id="cb1" defaultChecked />
                <Label htmlFor="cb1">Nhớ đăng nhập</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="cb2" />
                <Label htmlFor="cb2">Nhận thông báo email</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="cb3" disabled />
                <Label htmlFor="cb3" className="text-muted-foreground">
                  Disabled
                </Label>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Radio Group
              </p>
              <RadioGroup defaultValue="employee">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="employee" id="r1" />
                  <Label htmlFor="r1">Employee</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manager" id="r2" />
                  <Label htmlFor="r2">Manager</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="admin" id="r3" />
                  <Label htmlFor="r3">Admin</Label>
                </div>
              </RadioGroup>
            </div>
          </DemoRow>
        </DemoCard>

        <DemoCard label="Switch & Slider">
          <DemoRow vertical>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Switch
              </p>
              <div className="flex items-center gap-3">
                <Switch
                  id="sw1"
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
                <Label htmlFor="sw1">{switchChecked ? 'Bật' : 'Tắt'} thông báo</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="sw2" defaultChecked />
                <Label htmlFor="sw2">Dark mode</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="sw3" disabled />
                <Label htmlFor="sw3" className="text-muted-foreground">
                  Disabled
                </Label>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Slider — {sliderValue[0]}%
              </p>
              <Slider
                value={sliderValue}
                onValueChange={setSliderValue}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </DemoRow>
        </DemoCard>

        <DemoCard label="Date Picker">
          <DemoRow vertical>
            <div className="space-y-2">
              <Label>Ngày bắt đầu</Label>
              <DatePicker value={date} onChange={(d) => setDate(d)} placeholder="Chọn ngày..." />
            </div>
          </DemoRow>
        </DemoCard>
      </div>
    </DemoSection>
  );
}
