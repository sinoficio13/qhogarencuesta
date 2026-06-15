-- WATERMARK: marca de agua POR ENCUESTA (independiente del logo de la agencia).
--
-- Changes:
--   surveys: add watermark_image (nullable, URL de Vercel Blob)
--   surveys: add watermark_style (NOT NULL, default 'none') — none|centered|tiled|corner
--
-- watermark_image NULL = sin imagen. watermark_style 'none' = no se muestra.
-- Las encuestas existentes quedan en 'none' → sin cambios visibles hasta configurarse.

ALTER TABLE "surveys" ADD COLUMN "watermark_image" text;--> statement-breakpoint

ALTER TABLE "surveys" ADD COLUMN "watermark_style" text DEFAULT 'none' NOT NULL;
