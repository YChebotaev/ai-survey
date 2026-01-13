import { Knex } from "knex";

export const up = (knex: Knex) => {
  return knex.schema.createTable("account_memberships", (table) => {
    table.increments("id").primary();
    table.integer("accountId").notNullable().references("id").inTable("accounts");
    table.integer("userId").notNullable().references("id").inTable("users");
    table.string("role").defaultTo("admin").notNullable();
    table.boolean("deleted").defaultTo(false).notNullable();
    table.string("createdAt").notNullable();
    table.string("updatedAt").nullable();
    table.string("deletedAt").nullable();
  });
};

export const down = (knex: Knex) => {
  return knex.schema.dropTable("account_memberships");
};
