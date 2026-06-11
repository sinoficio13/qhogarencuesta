-- AGENCIES: la agencia que realiza la encuesta de campo para QHogar (ej: Angel Pinto).
--
-- Changes:
--   create table agencies (slug unique, name, logo url, created_at)
--   surveys: add agency_id (nullable) + FK → agencies(id) ON DELETE SET NULL
--
-- El logo guarda una URL: ruta estática (/agencies/x.png) o URL de Vercel Blob.
-- agency_id es nullable: no toda encuesta tiene agencia.

-- 1. Create agencies table
CREATE TABLE "agencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agencies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

-- 2. Add agency_id to surveys
ALTER TABLE "surveys" ADD COLUMN "agency_id" uuid;--> statement-breakpoint

-- 3. FK surveys.agency_id → agencies.id (ON DELETE SET NULL)
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE set null ON UPDATE no action;
