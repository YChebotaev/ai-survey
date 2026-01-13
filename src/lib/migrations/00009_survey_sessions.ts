import { Knex } from "knex";

export const up = (knex: Knex) => {
  return knex.schema.createTable("survey_sessions", (table) => {
    table.increments("id").primary();
    table.integer("accountId").notNullable().references("id").inTable("accounts");
    table.integer("projectId").notNullable().references("id").inTable("projects");
    table.integer("surveyId").notNullable().references("id").inTable("surveys");
    table.text("sessionState").notNullable();
    table.boolean("deleted").defaultTo(false).notNullable();
    table.string("createdAt").notNullable();
    table.string("updatedAt").nullable();
    table.string("deletedAt").nullable();
  });
};

export const down = (knex: Knex) => {
  return knex.schema.dropTable("survey_sessions");
};
