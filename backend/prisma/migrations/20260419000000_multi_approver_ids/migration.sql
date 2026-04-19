-- Convert approver_id from BIGINT (single FK) to TEXT (comma-separated IDs, e.g. "6" or "6,7")
-- Existing single-ID values are preserved exactly (e.g. 6 → "6")

-- Step 1: Drop the foreign-key constraint (if it exists)
ALTER TABLE "leave_requests" DROP CONSTRAINT IF EXISTS "leave_requests_approver_id_fkey";

-- Step 2: Convert column type from BIGINT to TEXT
ALTER TABLE "leave_requests" ALTER COLUMN "approver_id" TYPE TEXT USING CAST("approver_id" AS TEXT);
