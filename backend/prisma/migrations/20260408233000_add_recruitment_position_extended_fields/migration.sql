ALTER TABLE "job_positions"
ADD COLUMN "request_date" TIMESTAMP,
ADD COLUMN "onboard_deadline" TIMESTAMP,
ADD COLUMN "description_skills" TEXT,
ADD COLUMN "salary_range_usd" VARCHAR(255),
ADD COLUMN "main_skills" TEXT,
ADD COLUMN "jd_details" TEXT,
ADD COLUMN "cv_source" TEXT;
