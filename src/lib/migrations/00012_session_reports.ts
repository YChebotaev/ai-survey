import { Knex } from "knex";

export const up = (knex: Knex) => {
  return knex.schema.createTable("session_reports", (table) => {
    table.increments("id").primary();
    table.integer("accountId").notNullable().references("id").inTable("accounts");
    table.integer("projectId").notNullable().references("id").inTable("projects");
    table.integer("surveyId").notNullable().references("id").inTable("surveys");
    table.integer("sessionId").notNullable().references("id").inTable("survey_sessions");
    table.text("data").notNullable();
    table.boolean("deleted").defaultTo(false).notNullable();
    table.string("createdAt").notNullable();
    table.string("updatedAt").nullable();
    table.string("deletedAt").nullable();
  });
};

export const down = (knex: Knex) => {
  return knex.schema.dropTable("session_reports");
};
