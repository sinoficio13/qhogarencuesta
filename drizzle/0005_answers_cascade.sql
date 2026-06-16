-- CASCADE en answers al borrar una pregunta.
--
-- Bug de producción: al eliminar una pregunta YA RESPONDIDA desde el editor admin
-- (/admin/[surveyId]), el DELETE explotaba por violación de foreign key.
-- answers.question_id → questions.id estaba en ON DELETE NO ACTION, a diferencia
-- de options/scale_rows que ya tenían ON DELETE CASCADE desde questions.
--
-- Changes:
--   answers.question_id FK: ON DELETE no action → ON DELETE cascade
--
-- Efecto: borrar una pregunta borra sus respuestas asociadas (irreversible).
-- Consistente con options/scale_rows, que ya cascadeaban desde questions.

ALTER TABLE "answers" DROP CONSTRAINT "answers_question_id_questions_id_fk";--> statement-breakpoint

ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
