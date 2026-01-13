import { Knex } from "knex";

export const up = (knex: Knex) => {
  return knex.schema.createTable("project_memberships", (table) => {
    table.increments("id").primary();
    table.integer("accountId").notNullable().references("id").inTable("accounts");
    table.integer("userId").notNullable().references("id").inTable("users");
    table.integer("projectId").notNullable().references("id").inTable("projects");
    table.string("role").defaultTo("admin").notNullable();
    table.boolean("deleted").defaultTo(false).notNullable();
    table.string("createdAt").notNullable();
    table.string("updatedAt").nullable();
    table.string("deletedAt").nullable();
  });
};

export const down = (knex: Knex) => {
  return knex.schema.dropTable("project_memberships");
};
