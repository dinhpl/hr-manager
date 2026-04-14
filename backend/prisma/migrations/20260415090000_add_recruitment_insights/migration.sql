CREATE TABLE "recruitment_insights" (
  "id" BIGSERIAL PRIMARY KEY,
  "position_id" BIGINT NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "content" TEXT NOT NULL,
  "created_by_id" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "recruitment_insights_position_id_type_idx"
  ON "recruitment_insights" ("position_id", "type");

ALTER TABLE "recruitment_insights"
  ADD CONSTRAINT "recruitment_insights_position_id_fkey"
  FOREIGN KEY ("position_id") REFERENCES "job_positions" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
