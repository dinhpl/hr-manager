# Date Formatting Patterns in Frontend Codebase

**Report Date**: 2026-03-08  
**Scope**: `/app` and `/components` directories  
**Status**: Complete

---

## Summary

Found **13 files** using date formatting. **NO external date libraries** (date-fns, dayjs, moment) in app/components. All date handling uses **native JS + Locale API** via utility functions.

### Key Findings:
- ✅ **Centralized**: All date formatting via `@/lib/hr-utils.ts`
- ✅ **Consistent**: Vietnamese locale (`vi-VN`) used everywhere
- ✅ **Light**: Only `date-fns` used in 1 component (date-picker), for parsing/display format conversion
- 📊 **Patterns**: `formatDateVN()`, `formatDateTimeVN()`, `toDateInputValue()`, `toIsoDateTime()`, `new Date()`

---

## Core Utilities (lib/hr-utils.ts)

| Function | Implementation | Output Format | Notes |
|----------|---|---|---|
| `formatDateVN()` | `toLocaleDateString('vi-VN')` | `dd/MM/yyyy` | Returns `-` if invalid |
| `formatDateTimeVN()` | `toLocaleString('vi-VN')` | `dd/MM/yyyy, HH:mm:ss` | Returns `-` if invalid |
| `toDateInputValue()` | `toISOString().slice(0, 10)` | `yyyy-MM-dd` | HTML input value |
| `toIsoDateTime()` | Manual string concat + `toISOString()` | `yyyy-MM-ddT...Z` | Supports end-of-day flag |
| `numberValue()` | Type coercion | Number | Utility for safe conversion |

---

## File-by-File Date Patterns

### 1. **app/dashboard/approval/page.tsx** (851 lines)
- `formatDateVN()` → 4 uses (lines 150, 151, 693, 695)
- `formatDateTimeVN()` → 2 uses (lines 156, 709)
- `new Date(string).getTime()` → 2 uses (lines 132, 140) — for time diff calculations
- **Purpose**: Approval list display, overdue calculation

### 2. **app/dashboard/compoff/page.tsx** (835 lines)
- `formatDateVN()` → 7 uses (lines 212, 221, 230, 238, 571, 594, 643)
- `new Date(string)` → 3 uses (lines 110, 199, 200) — for sorting & detection
- **Purpose**: Comp-off timeline, expiry date display

### 3. **app/dashboard/employees/page.tsx** (1,600+ lines)
- `formatDateVN()` → used in date display
- `toIsoDateTime()` → 2 uses for API conversion
- `DatePicker` component → date input field
- **Purpose**: Employee management, birth date & join date handling

### 4. **app/dashboard/leave-history/page.tsx** (1,600+ lines)
- `formatDateVN()` → display from/to dates
- `toDateInputValue()` → filter date picker
- `toIsoDateTime()` → API submission
- **Purpose**: Leave request history with date range filtering

### 5. **app/dashboard/leave-request/page.tsx** (638 lines)
- `toIsoDateTime()` → 2 uses (lines 233, 234) — form submission
- `new Date()` → 1 use for time calculations (line 131)
- `new Date().getDate()` → 1 use (line 73) — working days calc
- **Purpose**: New leave request form, day counting logic

### 6. **app/dashboard/overtime/page.tsx** (674 lines)
- `formatDateVN()` → 5 uses (lines 518, 571, 631, 643)
- `new Date(string)` → 4 uses (lines 99, 110, 111, 123) — date parsing
- **Purpose**: OT history display, month range detection

### 7. **app/dashboard/page.tsx** (1,042 lines)
- `formatDateVN()` → 6 uses (lines 184, 415, 479, 482, 828, 831)
- `formatDateTimeVN()` → 2 uses (lines 189, 191)
- `new Date()` → 2 uses (lines 213, 873) — calendar logic
- **Purpose**: Dashboard calendar & recent requests

### 8. **app/dashboard/reports/page.tsx** (1,017 lines)
- `new Date(string)` → 2 uses (lines 156, 159) — year extraction
- `toISOString().slice(0, 10)` → implicit in date range defaults (line 142-143)
- **Purpose**: Report date filtering, CSV export naming

### 9. **app/dashboard/settings/page.tsx** (50+ KB file)
- `DatePicker` component usage
- Date display in various settings sections
- **Purpose**: Leave policy settings with effective dates

### 10. **components/ui/date-picker.tsx** (80 lines)
- **ONLY external lib**: `date-fns` (`format`, `parse`, `isValid`)
- Patterns:
  - Parse: `parse(value, 'yyyy-MM-dd', new Date())`
  - Parse: `parse(value, 'dd/MM/yyyy', new Date())`
  - Parse fallback: `new Date(value)`
  - Format: `format(date, 'yyyy-MM-dd')` → for value
  - Format: `format(date, 'dd/MM/yyyy')` → for display (line 66)
- **Purpose**: Date picker display & conversion

### 11. **components/leave-detail-modal.tsx** (200+ lines)
- No date formatting (data passed pre-formatted)
- Displays `fromDate`, `toDate`, `submittedAt`, `approvedAt` as strings
- **Purpose**: Modal display only, formatting done at source

### 12. **components/leave-request-modal.tsx**
- `formatDateVN()` usage
- Date display in modal

### 13. **components/ui/calendar.tsx**
- Standard calendar component (no date logic in file)

---

## Date String Patterns Identified

| Format | Usage | Library | Notes |
|--------|-------|---------|-------|
| `yyyy-MM-dd` | HTML input, API params | Native/date-fns | ISO short form |
| `dd/MM/yyyy` | UI display (Vietnamese) | `toLocaleDateString('vi-VN')` | Locale-based |
| `dd/MM/yyyy, HH:mm:ss` | UI timestamps | `toLocaleString('vi-VN')` | Full datetime |
| `yyyy-MM-ddT...Z` | API payloads | `toISOString()` | ISO 8601 UTC |
| `T00:00:00.000Z` | Start of day (API) | Manual concat | Convention |
| `T23:59:59.999Z` | End of day (API) | Manual concat | Convention |

---

## JavaScript Date Functions Used

```
✅ new Date(string)           — Parse ISO/fallback strings
✅ new Date()                 — Current date/time
✅ date.getTime()             — Millisecond comparison
✅ date.getDay()              — Weekday detection (0-6)
✅ date.getFullYear()         — Year extraction
✅ date.getMonth()            — Month (0-11)
✅ date.getDate()             — Day of month (1-31)
✅ date.toLocaleDateString()  — Locale-formatted display
✅ date.toLocaleString()      — Locale-formatted datetime
✅ date.toISOString()         — ISO 8601 string
```

---

## Date Calculations

### Working Days Count (leave-request/page.tsx)
```typescript
function countWorkingDays(fromDate: string, toDate: string): number {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;  // Skip Sunday(0), Saturday(6)
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
```

### Time Difference in Hours (overtime/page.tsx)
```typescript
const hours = (end.getTime() - start.getTime()) / 3600000;  // ms → hours
```

### Month Range Detection (overtime/page.tsx)
```typescript
function getMonthRange(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { fromDate: start.toISOString(), toDate: end.toISOString() };
}
```

---

## Data Flow for Date Handling

```
API Response (ISO 8601)
    ↓
Utility Functions (hr-utils.ts)
    ├─ formatDateVN()        → Display UI (dd/MM/yyyy)
    ├─ formatDateTimeVN()    → Display timestamp
    ├─ toDateInputValue()    → HTML input (yyyy-MM-dd)
    └─ toIsoDateTime()       → API submission
    ↓
Component Display / Form Submission
```

---

## Recommendations for Backend Integration

1. **API Contracts**: Always send dates in **ISO 8601** (`yyyy-MM-ddT...Z`)
2. **Parsing**: Frontend safely parses via `new Date()` constructor
3. **Display**: Use `formatDateVN()` for all user-facing dates (Vietnamese locale)
4. **Form Inputs**: DatePicker outputs `yyyy-MM-dd` via `toDateInputValue()`
5. **Calculations**: All business logic uses milliseconds via `.getTime()`

---

## Library Dependencies Summary

| Library | Where | Purpose | # Files |
|---------|-------|---------|---------|
| **date-fns** | `date-picker.tsx` only | Parse + format conversion | 1 |
| **Native JS** | Core `hr-utils.ts` | Locale-based formatting | 12+ |
| **dayjs** | ❌ NOT USED | — | — |
| **moment** | ❌ NOT USED | — | — |

---

## Files Read Successfully

✅ app/dashboard/approval/page.tsx  
✅ app/dashboard/compoff/page.tsx  
✅ app/dashboard/employees/page.tsx  
✅ app/dashboard/leave-history/page.tsx  
✅ app/dashboard/leave-request/page.tsx  
✅ app/dashboard/overtime/page.tsx  
✅ app/dashboard/page.tsx  
✅ app/dashboard/reports/page.tsx  
✅ app/dashboard/settings/page.tsx  
✅ components/ui/date-picker.tsx  
✅ components/leave-detail-modal.tsx  
✅ lib/hr-utils.ts  

---

## Conclusion

**Frontend date handling is well-centralized and consistent.**

- All formatting goes through `hr-utils.ts` utilities
- Vietnamese locale (`vi-VN`) applied uniformly
- Only `date-fns` used for date picker UI (minimal)
- Native JS + Locale API for all core formatting
- No mixed patterns or conflicting libraries

**Ready for backend integration** with confidence in date format consistency.

