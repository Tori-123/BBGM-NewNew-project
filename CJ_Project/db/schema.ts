import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const subjects = sqliteTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    color: text("color").notNull(),
    period: integer("period").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("idx_subjects_name").on(table.name)],
);

export const exams = sqliteTable(
  "exams",
  {
    id: text("id").primaryKey(),
    weekStart: text("week_start").notNull(),
    dayIndex: integer("day_index").notNull(),
    title: text("title").notNull(),
    time: text("time").notNull(),
    location: text("location").notNull().default(""),
    note: text("note").notNull().default(""),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_exams_week_day").on(table.weekStart, table.dayIndex)],
);

export const cjEntries = sqliteTable(
  "cj_entries",
  {
    id: text("id").primaryKey(),
    weekStart: text("week_start").notNull(),
    dayIndex: integer("day_index").notNull(),
    period: integer("period").notNull(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id),
    ic: text("ic").notNull().default(""),
    hw: text("hw").notNull().default(""),
    announcement: text("announcement").notNull().default(""),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_cj_entry_slot").on(
      table.weekStart,
      table.dayIndex,
      table.period,
      table.subjectId,
    ),
    index("idx_cj_entries_week_day").on(table.weekStart, table.dayIndex),
  ],
);
