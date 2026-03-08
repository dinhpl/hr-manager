# Date Formatting Audit: HR Frontend

**Date:** 2026-03-08  
**Scope:** Frontend codebase at `/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page`  
**Objective:** Identify all date formatting utilities, patterns, and dependencies

---

## Summary

**Date Library Dependency:**
- `date-fns: 4.1.0` (package.json)
- Used primarily in date-picker component
- Majority of date handling uses native JS `Date` object + locale methods

**Formatting Functions (centralized):**
Located in `lib/hr-utils.ts`:

1. **`formatDateVN(value?: string | Date | null): string`**
   - Format: Vietnamese locale (`vi-VN`)
   - Output: `dd/mm/yyyy` (e.g., "08/03/2026")
   - Method: `date.toLocaleDateString('vi-VN')`
   - Returns: `-` if invalid/null

2. **`formatDateTimeVN(value?: string | Date | null): string`**
   - Format: Vietnamese locale datetime
   - Output: `dd/mm/yyyy, HH:mm:ss` 
   - Method: `date.toLocaleString('vi-VN')`
   - Returns: `-` if invalid/null

3. **`toDateInputValue(value?: string | Date | null): string`**
   - Format: ISO date (for HTML `<input type="date">`)
   - Output: `yyyy-MM-dd` (e.g., "2026-03-08")
   - Method: `date.toISOString().slice(0, 10)`
   - Returns: empty string if invalid/null

4. **`toIsoDateTime(value: string, endOfDay = false): string`**
   - Format: ISO datetime (8601 format)
   - Output: `yyyy-MM-ddT00:00:00.000Z` or `yyyy-MM-ddT23:59:59.999Z`
   - Appends suffix based on `endOfDay` flag
   - Used for API date range filtering

---

## Component Usage Map

### `components/ui/date-picker.tsx`
- **Library:** `date-fns` (v4.1.0)
- **Functions used:**
  - `format()` — converts Date to string (display: `dd/MM/yyyy`, internal: `yyyy-MM-dd`)
  - `parse()` — converts string to Date (supports `yyyy-MM-dd` and `dd/MM/yyyy` formats)
  - `isValid()` — validates parsed dates
- **Logic flow:**
  ```
  Input (string) → parseDateValue() → Date | undefined
  Date → handleDateSelect() → format(date, 'yyyy-MM-dd') → onChange callback
  Display: format(selectedDate, 'dd/MM/yyyy')
  ```
- **Key detail:** Handles backward compatibility with both ISO and Vietnamese display formats

### Dashboard Pages Using `formatDateVN*`

| File | Function | Count | Example Usage |
|------|----------|-------|---|
| `app/dashboard/page.tsx` | `formatDateVN`, `formatDateTimeVN` | 6 | `{formatDateVN(request.fromDate)}` |
| `app/dashboard/approval/page.tsx` | `formatDateVN`, `formatDateTimeVN` | 4 | `{formatDateVN(request.fromDate)}` |
| `app/dashboard/leave-history/page.tsx` | `formatDateVN`, `formatDateTimeVN` | 8 | `fromDate: formatDateVN(item.fromDate)` |
| `app/dashboard/leave-request/page.tsx` | `toIsoDateTime` | 1 | `toIsoDateTime(startDate, true)` |
| `app/dashboard/compoff/page.tsx` | `formatDateVN` | 5 | `date: formatDateVN(item.toDate)` |
| `app/dashboard/overtime/page.tsx` | `formatDateVN` | 3 | `{formatDateVN(row.date)}` |
| `app/dashboard/employees/page.tsx` | `formatDateVN`, `toIsoDateTime` | 2 | `{formatDateVN(employee.companyJoinDate)}` |
| `app/dashboard/settings/page.tsx` | Native `Date` | 2 | `exportedAt: new Date().toISOString()` |
| `app/dashboard/reports/page.tsx` | Native `Date` | 2 | `getFullYear()` calls |

---

## Native Date Object Usage Patterns

### Common Operations Found

| Pattern | File | Usage |
|---------|------|-------|
| `new Date(value)` | Multiple | Constructor for parsing date strings |
| `.getTime()` | Multiple | Get milliseconds for comparison/sorting |
| `.getFullYear()` | Multiple | Extract year from date |
| `.getMonth()` | `dashboard/page.tsx` | Get month for calendar logic |
| `.getDate()` | `dashboard/page.tsx` | Get day of month |
| `.getDay()` | `dashboard/page.tsx` | Get weekday (0-6) |
| `toISOString()` | Multiple | ISO 8601 output for APIs |
| `toLocaleDateString('vi-VN')` | `hr-utils.ts` | Vietnamese locale formatting |
| `toLocaleString('vi-VN')` | `hr-utils.ts` | Vietnamese locale datetime formatting |
| `Date.now()` | `approval/page.tsx` | Current timestamp in ms |

### Date Arithmetic Examples
```ts
// dashboard/page.tsx (calendar generation)
const firstDay = new Date(year, month - 1, 1).getDay();
const daysInMonth = new Date(year, month, 0).getDate();

// leave-request/page.tsx (duration calculation)
const hours = (end.getTime() - start.getTime()) / 3600000;

// compoff/page.tsx (sorting)
const aTime = new Date(a.approvedAt ?? a.createdAt ?? a.toDate).getTime();
```

---

## Date Formats in Codebase

| Format | Purpose | Example | Function |
|--------|---------|---------|----------|
| `yyyy-MM-dd` | Input value (form, date picker) | "2026-03-08" | DatePicker, `toDateInputValue()` |
| `dd/MM/yyyy` | Vietnamese display (UI) | "08/03/2026" | `formatDateVN()` |
| `yyyy-MM-ddTHH:mm:ss.sssZ` | API payload (ISO 8601) | "2026-03-08T15:30:45.123Z" | `toIsoDateTime()` |
| Locale string | Vietnamese datetime (UI) | "08/03/2026, 15:30:45" | `formatDateTimeVN()` |

---

## Key Observations

### ✅ Strengths
1. **Centralized utility functions** in `lib/hr-utils.ts` — easy to maintain date formatting logic
2. **Consistent Vietnamese locale** usage (`vi-VN`) across all formatting
3. **Safe null/invalid handling** — returns `-` or empty string, never errors
4. **Dual format support** in DatePicker — backward compatible with both ISO and Vietnamese formats
5. **Date-fns integration** — modern library for component logic (parsing, validation)

### ⚠️ Observations
1. **Mixed date libraries:**
   - `date-fns` used only in DatePicker component
   - Rest of codebase relies on native `Date` methods
   - Could be consolidated for consistency

2. **No centralized time formatting:**
   - Time inputs (e.g., "HH:mm" in overtime form) handled ad-hoc
   - No dedicated time format utility

3. **Heavy use of `.getTime()` for comparisons:**
   - Works but could benefit from date-fns utilities (e.g., `differenceInDays()`, `isBefore()`)

4. **Manual date arithmetic:**
   - Calendar generation, range calculations done with `new Date()` constructor
   - date-fns has helpers like `getDaysInMonth()`, `getDay()` that are more robust

5. **No standardized input validation:**
   - `toIsoDateTime()` doesn't validate input format
   - Could cause issues if malformed date strings passed

---

## File Inventory

### Utility Files
- **`lib/hr-utils.ts`** — Core date formatting functions (lines 48-73)
- **`components/ui/date-picker.tsx`** — DatePicker with date-fns integration (lines 1-81)

### Consumer Files (Dashboard Pages)
- `app/dashboard/page.tsx`
- `app/dashboard/approval/page.tsx`
- `app/dashboard/leave-history/page.tsx`
- `app/dashboard/leave-request/page.tsx`
- `app/dashboard/compoff/page.tsx`
- `app/dashboard/overtime/page.tsx`
- `app/dashboard/employees/page.tsx`
- `app/dashboard/settings/page.tsx`
- `app/dashboard/reports/page.tsx`

### Dependency Summary
```json
{
  "date-fns": "4.1.0",
  "Used in": ["components/ui/date-picker.tsx"],
  "Total date-related lines": "~250+ across all components"
}
```

---

## Recommendations

### For Backend Integration
1. **Ensure consistent ISO 8601 format** — API should send dates as `yyyy-MM-ddTHH:mm:ss.sssZ`
2. **Clarify timezone handling** — Currently using browser local time + toLocaleString (may have TZ issues)
3. **Validate API date formats** — Add validation layer for incoming dates from backend

### For Frontend Standardization
1. **Consider consolidating date-fns usage** — Either extend it across codebase or remove if native Date suffices
2. **Add time format utility** — Similar to `formatDateVN()`, create `formatTimeVN()` for consistency
3. **Add robust date parsing** — Use date-fns `parseISO()` instead of `new Date(string)` for API responses

---

## Unresolved Questions

1. **Timezone handling:** Are dates stored in UTC on backend? Frontend uses browser local time — potential TZ mismatch?
2. **Backend date format spec:** What format does backend API return dates in? ISO 8601 assumed but not confirmed.
3. **Time-only formatting:** How should time-only values (e.g., "15:30") be formatted for Vietnamese locale?
4. **Relative date display:** Any requirement for relative dates (e.g., "2 days ago") in approvals or notifications?
5. **DatePicker locale:** Should DatePicker calendar header/labels be in Vietnamese? Currently using English weekdays/months from date-fns.
