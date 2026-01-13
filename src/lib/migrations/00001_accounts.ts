import { Knex } from "knex";

export const up = (knex: Knex) => {
  return knex.schema.createTable("accounts", (table) => {
    table.increments("id").primary();
    table.string("name").notNullable();
    table.boolean("deleted").defaultTo(false).notNullable();
    table.string("createdAt").notNullable();
    table.string("updatedAt").nullable();
    table.string("deletedAt").nullable();
  });
};

export const down = (knex: Knex) => {
  return knex.schema.dropTable("accounts");
};
