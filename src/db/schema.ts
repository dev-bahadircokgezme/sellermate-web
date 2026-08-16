import { pgTable, text, timestamp, numeric, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role").notNull().default("STAFF"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({ emailIdx: uniqueIndex("users_email_idx").on(table.email) }));

export const marketplaceAccounts = pgTable("marketplace_accounts", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  marketplace: text("marketplace").notNull(),
  sellerId: text("seller_id"),
  displayName: text("display_name"),
  active: boolean("active").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  barcode: text("barcode"),
  sku: text("sku"),
  name: text("name").notNull(),
  cost: numeric("cost", { precision: 14, scale: 2 }).default("0").notNull(),
  stock: integer("stock").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  marketplaceAccountId: text("marketplace_account_id").notNull().references(() => marketplaceAccounts.id),
  marketplaceOrderNumber: text("marketplace_order_number").notNull(),
  status: text("status").notNull(),
  grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }).default("0").notNull(),
  orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  productId: text("product_id").references(() => products.id),
  barcode: text("barcode"),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  costAtSale: numeric("cost_at_sale", { precision: 14, scale: 2 }).default("0").notNull(),
});

export const financialTransactions = pgTable("financial_transactions", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  marketplaceAccountId: text("marketplace_account_id").notNull().references(() => marketplaceAccounts.id),
  orderId: text("order_id").references(() => orders.id),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description"),
  transactionAt: timestamp("transaction_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
