'use client';

import * as React from 'react';
import { format, isValid, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: string;
  onChange: (dateString: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function parseDateValue(value?: string): Date | undefined {
  if (!value) return undefined;

  const isoDate = parse(value, 'yyyy-MM-dd', new Date());
  if (isValid(isoDate)) return isoDate;

  const displayDate = parse(value, 'dd/MM/yyyy', new Date());
  if (isValid(displayDate)) return displayDate;

  const fallbackDate = new Date(value);
  return isValid(fallbackDate) ? fallbackDate : undefined;
}

export function DatePicker({ 
  value, 
  onChange, 
  placeholder = 'Pick a date',
  className,
  disabled = false 
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  
  // Accept both ISO form values and display-formatted dates from older screens.
  const selectedDate = parseDateValue(value);
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Convert Date back to YYYY-MM-DD string format
      const dateString = format(date, 'yyyy-MM-dd');
      onChange(dateString);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
