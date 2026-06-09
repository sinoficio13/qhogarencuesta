CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"option_ids" uuid[],
	"scale_values" jsonb,
	"text_value" text,
	CONSTRAINT "answers_one_of_chk" CHECK ((
        ("answers"."option_ids" is not null)::int +
        ("answers"."scale_values" is not null)::int +
        ("answers"."text_value" is not null)::int
      ) = 1)
);
--> statement-breakpoint
CREATE TABLE "options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"is_control" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"hint" text,
	"hint_why" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"max_select" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_type_chk" CHECK ("questions"."type" in ('single','multi','scale','open')),
	CONSTRAINT "questions_maxselect_chk" CHECK ("questions"."max_select" is null or ("questions"."type"='multi' and "questions"."max_select" > 0))
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"respondent_meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "scale_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label_html" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"meta_chips" jsonb,
	"note_html" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surveys_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_rows" ADD CONSTRAINT "scale_rows_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answers_question_idx" ON "answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "answers_response_idx" ON "answers" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "answers_optionids_gin" ON "answers" USING gin ("option_ids");--> statement-breakpoint
CREATE UNIQUE INDEX "options_q_pos_uq" ON "options" USING btree ("question_id","position");--> statement-breakpoint
CREATE INDEX "options_q_idx" ON "options" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_survey_pos_uq" ON "questions" USING btree ("survey_id","position");--> statement-breakpoint
CREATE INDEX "questions_survey_idx" ON "questions" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "responses_survey_idx" ON "responses" USING btree ("survey_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scalerows_q_pos_uq" ON "scale_rows" USING btree ("question_id","position");--> statement-breakpoint
CREATE INDEX "scalerows_q_idx" ON "scale_rows" USING btree ("question_id");