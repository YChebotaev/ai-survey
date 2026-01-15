import { Knex } from "knex";

export const up = async (knex: Knex) => {
  // Add the surveyId column
  await knex.schema.alterTable("question_templates", (table) => {
    table.integer("surveyId").nullable().references("id").inTable("surveys");
  });

  // For existing questions, try to match them to surveys by projectId and order
  // This is a best-effort approach - ideally, questions should be re-seeded
  const questions = await knex("question_templates")
    .whereNull("surveyId")
    .where("deleted", false);

  for (const question of questions) {
    // Find surveys in the same project
    const surveys = await knex("surveys")
      .where({ projectId: question.projectId, deleted: false })
      .orderBy("createdAt", "asc");

    // Assign to the first survey in the project (best guess)
    // In practice, you should re-seed the database after this migration
    if (surveys.length > 0) {
      await knex("question_templates")
        .where({ id: question.id })
        .update({ surveyId: surveys[0].id });
    }
  }
};

export const down = (knex: Knex) => {
  return knex.schema.alterTable("question_templates", (table) => {
    table.dropColumn("surveyId");
  });
};
