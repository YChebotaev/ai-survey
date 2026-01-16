import { Knex } from "knex";

export const up = (knex: Knex) => {
  return knex.schema.createTable("session_messages", (table) => {
    table.increments("id").primary();
    table.integer("accountId").notNullable().references("id").inTable("accounts");
    table.integer("projectId").notNullable().references("id").inTable("projects");
    table.integer("surveyId").notNullable().references("id").inTable("surveys");
    table.integer("sessionId").notNullable().references("id").inTable("survey_sessions");
    table.integer("order").notNullable(); // Index within session, from 0 for initial agent's message
    table.text("partialReport").notNullable(); // JSON snapshot of report at this point
    table.string("author").notNullable(); // "agent" | "client"
    table.text("text").notNullable();
    table.boolean("deleted").defaultTo(false).notNullable();
    table.string("createdAt").notNullable();
    table.string("updatedAt").nullable();
    table.string("deletedAt").nullable();
    
    // Index for efficient querying by session
    table.index(["sessionId", "order"]);
  });
};

export const down = (knex: Knex) => {
  return knex.schema.dropTable("session_messages");
};
