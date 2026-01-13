import { Knex } from "knex";

export const up = (knex: Knex) => {
  return knex.schema.createTable("account_invites", (table) => {
    table.increments("id").primary();
    table.integer("accountId").notNullable().references("id").inTable("accounts");
    table.string("email").nullable();
    table.string("phone").nullable();
    table.string("telegram").nullable();
    table.boolean("deleted").defaultTo(false).notNullable();
    table.string("createdAt").notNullable();
    table.string("updatedAt").nullable();
    table.string("deletedAt").nullable();
  });
};

export const down = (knex: Knex) => {
  return knex.schema.dropTable("account_invites");
};
