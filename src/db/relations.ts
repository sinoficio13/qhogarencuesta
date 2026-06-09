/**
 * Drizzle relations — enables typed nested reads via db.query.*
 *
 * surveys → questions → options + scaleRows
 * responses → answers
 */
import { relations } from 'drizzle-orm'
import { surveys, questions, options, scaleRows, responses, answers } from './schema'

export const surveysRelations = relations(surveys, ({ many }) => ({
  questions: many(questions),
  responses: many(responses),
}))

export const questionsRelations = relations(questions, ({ one, many }) => ({
  survey: one(surveys, {
    fields: [questions.surveyId],
    references: [surveys.id],
  }),
  options: many(options),
  scaleRows: many(scaleRows),
  answers: many(answers),
}))

export const optionsRelations = relations(options, ({ one }) => ({
  question: one(questions, {
    fields: [options.questionId],
    references: [questions.id],
  }),
}))

export const scaleRowsRelations = relations(scaleRows, ({ one }) => ({
  question: one(questions, {
    fields: [scaleRows.questionId],
    references: [questions.id],
  }),
}))

export const responsesRelations = relations(responses, ({ one, many }) => ({
  survey: one(surveys, {
    fields: [responses.surveyId],
    references: [surveys.id],
  }),
  answers: many(answers),
}))

export const answersRelations = relations(answers, ({ one }) => ({
  response: one(responses, {
    fields: [answers.responseId],
    references: [responses.id],
  }),
  question: one(questions, {
    fields: [answers.questionId],
    references: [questions.id],
  }),
}))
