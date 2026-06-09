-- PIVOT: replace one-time invitation tokens with identifier-based dedup
--
-- Changes:
--   surveys: add identifier_type (enum email|cedula, default email) + identifier_label (nullable)
--   responses: add identifier_hash (nullable text) + partial unique index
--   responses: drop invitation_id column (and its FK)
--   DROP TABLE invitations (no longer needed)
--
-- The partial unique index (survey_id, identifier_hash) WHERE identifier_hash IS NOT NULL
-- enforces one response per identifier per survey at the DB level, race-safe.

-- 1. Add identifier fields to surveys
ALTER TABLE "surveys" ADD COLUMN "identifier_type" text NOT NULL DEFAULT 'email';--> statement-breakpoint
ALTER TABLE "surveys" ADD COLUMN "identifier_label" text;--> statement-breakpoint

-- 2. Add check constraint for identifier_type enum
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_identifier_type_chk" CHECK ("identifier_type" IN ('email', 'cedula'));--> statement-breakpoint

-- 3. Add identifier_hash to responses
ALTER TABLE "responses" ADD COLUMN "identifier_hash" text;--> statement-breakpoint

-- 4. Create partial unique index for dedup
CREATE UNIQUE INDEX "responses_survey_identifier_uq" ON "responses" ("survey_id", "identifier_hash") WHERE "identifier_hash" IS NOT NULL;--> statement-breakpoint

-- 5. Drop FK from responses.invitation_id to invitations
ALTER TABLE "responses" DROP CONSTRAINT IF EXISTS "responses_invitation_id_invitations_id_fk";--> statement-breakpoint

-- 6. Drop invitation_id column from responses
ALTER TABLE "responses" DROP COLUMN IF EXISTS "invitation_id";--> statement-breakpoint

-- 7. Drop all invitations indexes (if they exist)
DROP INDEX IF EXISTS "invitations_token_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "invitations_survey_idx";--> statement-breakpoint

-- 8. Drop invitations table
DROP TABLE IF EXISTS "invitations";
