import { integer, pgEnum, pgTable, text, timestamp, varchar, decimal, date, index, serial } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const genderEnum = pgEnum("gender", ["male", "female"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  athleteId: integer("athleteId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Athletes table - stores athlete profiles with their personal records
 */
export const athletes = pgTable("athletes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  bodyWeight: decimal("bodyWeight", { precision: 6, scale: 2 }),
  squat: decimal("squat", { precision: 6, scale: 2 }),
  bench: decimal("bench", { precision: 6, scale: 2 }),
  deadlift: decimal("deadlift", { precision: 6, scale: 2 }),
  total: decimal("total", { precision: 8, scale: 2 }),
  ohp: decimal("ohp", { precision: 6, scale: 2 }),
  inclineBench: decimal("inclineBench", { precision: 6, scale: 2 }),
  rdl: decimal("rdl", { precision: 6, scale: 2 }),
  revBandBench: decimal("revBandBench", { precision: 6, scale: 2 }),
  revBandSquat: decimal("revBandSquat", { precision: 6, scale: 2 }),
  revBandDl: decimal("revBandDl", { precision: 6, scale: 2 }),
  slingshotBench: decimal("slingshotBench", { precision: 6, scale: 2 }),
  farmersWalkWeight: decimal("farmersWalkWeight", { precision: 6, scale: 2 }),
  farmersWalkDistance: decimal("farmersWalkDistance", { precision: 6, scale: 2 }),
  yokeWalkWeight: decimal("yokeWalkWeight", { precision: 6, scale: 2 }),
  yokeWalkDistance: decimal("yokeWalkDistance", { precision: 6, scale: 2 }),
  dipsReps: integer("dipsReps"),
  dipsWeight: decimal("dipsWeight", { precision: 6, scale: 2 }),
  pullUpsReps: integer("pullUpsReps"),
  pullUpsWeight: decimal("pullUpsWeight", { precision: 6, scale: 2 }),
  avatarUrl: text("avatarUrl"),
  email: varchar("email", { length: 320 }).unique(),
  gender: varchar("gender", { length: 10 }),
  gymId: integer("gymId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  totalIdx: index("athletes_total_idx").on(table.total),
  emailIdx: index("athletes_email_idx").on(table.email),
  gymIdx: index("athletes_gym_idx").on(table.gymId),
  genderIdx: index("athletes_gender_idx").on(table.gender),
}));

export const gyms = pgTable("gyms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  inviteCode: varchar("inviteCode", { length: 12 }).notNull().unique(),
  logoUrl: text("logoUrl"),
  createdBy: integer("createdBy"), // userId of the creator
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("gyms_slug_idx").on(table.slug),
  inviteIdx: index("gyms_invite_idx").on(table.inviteCode),
}));

export type Gym = typeof gyms.$inferSelect;
export type InsertGym = typeof gyms.$inferInsert;

export type Athlete = typeof athletes.$inferSelect;
export type InsertAthlete = typeof athletes.$inferInsert;

/**
 * Weight entries - tracks body weight changes over time
 */
export const weightEntries = pgTable("weightEntries", {
  id: serial("id").primaryKey(),
  athleteId: integer("athleteId").notNull(),
  weight: decimal("weight", { precision: 6, scale: 2 }).notNull(),
  recordedDate: date("recordedDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  athleteIdx: index("weightEntries_athlete_idx").on(table.athleteId),
  dateIdx: index("weightEntries_date_idx").on(table.recordedDate),
}));

export type WeightEntry = typeof weightEntries.$inferSelect;
export type InsertWeightEntry = typeof weightEntries.$inferInsert;

/**
 * Lift records - tracks individual lift attempts over time
 */
export const liftRecords = pgTable("liftRecords", {
  id: serial("id").primaryKey(),
  athleteId: integer("athleteId").notNull(),
  exerciseType: varchar("exerciseType", { length: 50 }).notNull(), // squat, bench, deadlift, ohp, etc
  weight: decimal("weight", { precision: 6, scale: 2 }),
  reps: integer("reps").default(1),
  distance: decimal("distance", { precision: 6, scale: 2 }),
  recordedDate: date("recordedDate").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  athleteIdx: index("liftRecords_athlete_idx").on(table.athleteId),
  exerciseIdx: index("liftRecords_exercise_idx").on(table.exerciseType),
  dateIdx: index("liftRecords_date_idx").on(table.recordedDate),
}));

export type LiftRecord = typeof liftRecords.$inferSelect;
export type InsertLiftRecord = typeof liftRecords.$inferInsert;

/**
 * Gym requests - tracks requests to add new gyms
 */
export const gymRequests = pgTable("gymRequests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  location: text("location"),
  requestedBy: integer("requestedBy").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type GymRequest = typeof gymRequests.$inferSelect;
export type InsertGymRequest = typeof gymRequests.$inferInsert;