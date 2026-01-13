import { Knex } from "knex";

export const up = (knex: Knex) => {
  return knex.schema.createTable("question_templates", (table) => {
    table.increments("id").primary();
    table.integer("accountId").notNullable().references("id").inTable("accounts");
    table.integer("projectId").notNullable().references("id").inTable("projects");
    table.integer("order").notNullable();
    table.string("dataKey").notNullable();
    table.text("questionTemplate").notNullable();
    table.text("successTemplate").notNullable();
    table.text("failTemplate").notNullable();
    table.boolean("final").defaultTo(false).notNullable();
    table.string("type").defaultTo("freeform").notNullable();
    table.boolean("deleted").defaultTo(false).notNullable();
    table.string("createdAt").notNullable();
    table.string("updatedAt").nullable();
    table.string("deletedAt").nullable();
  });
};

export const down = (knex: Knex) => {
  return knex.schema.dropTable("question_templates");
};
