import { eq, and, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from 'pg';
const { Pool } = pkg;
import { User, InsertUser, users, athletes, InsertAthlete, weightEntries, InsertWeightEntry, liftRecords, InsertLiftRecord, gyms, Gym, InsertGym, gymRequests, InsertGymRequest, prVideos, prVideoJudgments } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: InstanceType<typeof Pool> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 1, // Limit connections for serverless
      });
      _db = drizzle(_pool);
      console.log("[Database] Connected successfully");
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Athletes queries
export async function getAllAthletes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(athletes).orderBy(desc(athletes.total));
}

export async function getAthleteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(athletes).where(eq(athletes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAthleteByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(athletes).where(eq(athletes.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAthleteByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(athletes).where(eq(athletes.name, name)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertAthlete(data: InsertAthlete) {
  const db = await getDb();
  if (!db) return undefined;

  // For upserting athletes by name
  await db.insert(athletes).values(data).onConflictDoUpdate({
    target: athletes.name,
    set: data,
  });

  return getAthleteByName(data.name!);
}

export async function updateAthlete(id: number, data: Partial<InsertAthlete>) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(athletes).set(data).where(eq(athletes.id, id));
  return getAthleteById(id);
}

export async function importAthlete(data: InsertAthlete) {
  const db = await getDb();
  if (!db) return undefined;

  if (!data.name) {
    throw new Error("Athlete name is required for import");
  }

  let existing = data.email ? await getAthleteByEmail(data.email) : undefined;

  if (!existing) {
    existing = await getAthleteByName(data.name);
  }

  if (existing) {
    // Update existing athlete
    await db.update(athletes).set(data).where(eq(athletes.id, existing.id));
    return getAthleteById(existing.id);
  } else {
    // Insert new athlete
    await db.insert(athletes).values(data);
    return getAthleteByName(data.name);
  }
}

// Weight entries queries
export async function getWeightEntriesForAthlete(athleteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(weightEntries).where(eq(weightEntries.athleteId, athleteId)).orderBy(asc(weightEntries.recordedDate));
}

export async function addWeightEntry(data: InsertWeightEntry) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(weightEntries).values(data);
  return result;
}

// Lift records queries
export async function getLiftRecordsForAthlete(athleteId: number, exerciseType?: string) {
  const db = await getDb();
  if (!db) return [];
  if (exerciseType) {
    return db.select().from(liftRecords).where(
      and(eq(liftRecords.athleteId, athleteId), eq(liftRecords.exerciseType, exerciseType))
    ).orderBy(asc(liftRecords.recordedDate));
  }
  return db.select().from(liftRecords).where(eq(liftRecords.athleteId, athleteId)).orderBy(asc(liftRecords.recordedDate));
}

export async function addLiftRecord(data: InsertLiftRecord) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(liftRecords).values(data);
  return result;
}

export async function updateLiftRecord(id: number, data: Partial<InsertLiftRecord>) {
  const db = await getDb();
  if (!db) return undefined;
  return db.update(liftRecords).set(data).where(eq(liftRecords.id, id));
}

export async function getLeaderboardByExercise(exerciseType: string, gymId?: number, gender?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (gymId) {
    conditions.push(eq(athletes.gymId, gymId));
  }
  if (gender) {
    conditions.push(eq(athletes.gender, gender));
  }

  let baseQuery = db.select().from(athletes);
  if (conditions.length > 0) {
    // @ts-ignore - dynamic where conditions
    baseQuery = baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  // Get all results and sort in JavaScript to handle NULL values properly
  const results = await baseQuery;

  // Sort with NULL/0 values at the bottom
  return results.sort((a, b) => {
    let aVal: number | null = null;
    let bVal: number | null = null;

    if (exerciseType === 'total') {
      aVal = a.total ? parseFloat(a.total) : null;
      bVal = b.total ? parseFloat(b.total) : null;
    } else if (exerciseType === 'squat') {
      aVal = a.squat ? parseFloat(a.squat) : null;
      bVal = b.squat ? parseFloat(b.squat) : null;
    } else if (exerciseType === 'bench') {
      aVal = a.bench ? parseFloat(a.bench) : null;
      bVal = b.bench ? parseFloat(b.bench) : null;
    } else if (exerciseType === 'deadlift') {
      aVal = a.deadlift ? parseFloat(a.deadlift) : null;
      bVal = b.deadlift ? parseFloat(b.deadlift) : null;
    } else if (exerciseType === 'ohp') {
      aVal = a.ohp ? parseFloat(a.ohp) : null;
      bVal = b.ohp ? parseFloat(b.ohp) : null;
    } else if (exerciseType === 'farmersWalk') {
      aVal = a.farmersWalkWeight ? parseFloat(a.farmersWalkWeight) : null;
      bVal = b.farmersWalkWeight ? parseFloat(b.farmersWalkWeight) : null;
    } else if (exerciseType === 'yokeWalk') {
      aVal = a.yokeWalkWeight ? parseFloat(a.yokeWalkWeight) : null;
      bVal = b.yokeWalkWeight ? parseFloat(b.yokeWalkWeight) : null;
    } else if (exerciseType === 'dips') {
      aVal = a.dipsWeight ? (parseFloat(a.dipsWeight) * 1000) + (a.dipsReps || 0) : (a.dipsReps ? a.dipsReps : null);
      bVal = b.dipsWeight ? (parseFloat(b.dipsWeight) * 1000) + (b.dipsReps || 0) : (b.dipsReps ? b.dipsReps : null);
    } else if (exerciseType === 'pullUps') {
      aVal = a.pullUpsWeight ? (parseFloat(a.pullUpsWeight) * 1000) + (a.pullUpsReps || 0) : (a.pullUpsReps ? a.pullUpsReps : null);
      bVal = b.pullUpsWeight ? (parseFloat(b.pullUpsWeight) * 1000) + (b.pullUpsReps || 0) : (b.pullUpsReps ? b.pullUpsReps : null);
    } else {
      aVal = a.total ? parseFloat(a.total) : null;
      bVal = b.total ? parseFloat(b.total) : null;
    }

    // NULL values go to the bottom
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    // Descending order for non-null values
    return bVal - aVal;
  });
}

// Gym queries
export async function getAllGyms() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gyms).orderBy(asc(gyms.name));
}

export async function getGymById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gyms).where(eq(gyms.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getGymBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gyms).where(eq(gyms.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getGymByInviteCode(inviteCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gyms).where(eq(gyms.inviteCode, inviteCode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createGym(data: InsertGym) {
  const db = await getDb();
  if (!db) return undefined;

  // Ensure slug exists
  if (!data.slug) {
    data.slug = data.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
  }

  // Ensure invite code exists
  if (!data.inviteCode) {
    const prefix = (data.name.match(/[A-Z]/g) || data.name.substring(0, 3).toUpperCase().split('')).slice(0, 3).join('').toUpperCase().padEnd(3, 'X');
    data.inviteCode = `${prefix}${Math.floor(100 + Math.random() * 899)}`;
  }

  const result = await db.insert(gyms).values(data).returning();
  return result[0];
}

export async function updateAthleteGym(athleteId: number, gymId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(athletes).set({ gymId }).where(eq(athletes.id, athleteId));
}
// tRPC specific procedure for ensuring a user only modifies their own athlete data
export async function enforceAthleteOwnership(athleteId: number, user: User | null) {
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (user.role === 'admin') return; // Admins can do anything
  if (user.athleteId !== athleteId) {
    throw new Error("You do not have permission to edit this athlete profile");
  }
}

export async function linkUserToAthlete(userId: number, athleteId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ athleteId }).where(eq(users.id, userId));
}

export async function syncUserAthlete(user: User): Promise<User> {
  if (user.athleteId) return user;

  const db = await getDb();
  if (!db) return user;

  // Try to find an athlete with the same email
  if (user.email) {
    const existingAthlete = await getAthleteByEmail(user.email);
    if (existingAthlete) {
      await linkUserToAthlete(user.id, existingAthlete.id);
      return { ...user, athleteId: existingAthlete.id };
    }
  }

  // WE NO LONGER AUTO-CREATE. The user will be prompted on the frontend.
  return user;
}

// Gym requests
export async function requestGymAdd(data: InsertGymRequest) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(gymRequests).values(data).returning();
  return result[0];
}

export async function getAllGymRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gymRequests).orderBy(desc(gymRequests.createdAt));
}

export async function getGymRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gymRequests).where(eq(gymRequests.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateGymRequestStatus(id: number, status: 'pending' | 'approved' | 'rejected') {
  const db = await getDb();
  if (!db) return;
  await db.update(gymRequests).set({ status, updatedAt: new Date() }).where(eq(gymRequests.id, id));
}

// Admin / User Management
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: 'user' | 'admin') {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}

// PR Videos
export async function getPrVideos(athleteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prVideos).where(eq(prVideos.athleteId, athleteId));
}

export async function upsertPrVideo(athleteId: number, exerciseType: string, videoUrl: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(prVideos).where(and(eq(prVideos.athleteId, athleteId), eq(prVideos.exerciseType, exerciseType)));
  await db.insert(prVideos).values({ athleteId, exerciseType, videoUrl });
  await assignLatestPrVideoJudgesIfMissing(athleteId, exerciseType);
}

export async function deletePrVideo(athleteId: number, exerciseType: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(prVideos).where(and(eq(prVideos.athleteId, athleteId), eq(prVideos.exerciseType, exerciseType)));
}

export async function getPrVideosByExercise(exerciseType: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prVideos).where(eq(prVideos.exerciseType, exerciseType));
}

export async function getAllPrVideos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prVideos);
}

export async function getRecentPrVideos(limit: number = 8) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: prVideos.id,
      athleteId: prVideos.athleteId,
      athleteName: athletes.name,
      avatarUrl: athletes.avatarUrl,
      exerciseType: prVideos.exerciseType,
      videoUrl: prVideos.videoUrl,
      createdAt: prVideos.createdAt,
    })
    .from(prVideos)
    .innerJoin(athletes, eq(prVideos.athleteId, athletes.id))
    .orderBy(desc(prVideos.createdAt))
    .limit(limit);
}

// PR Video Judgments
export async function getPrVideoJudgments(athleteId: number, exerciseType: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prVideoJudgments).where(
    and(
      eq(prVideoJudgments.athleteId, athleteId),
      eq(prVideoJudgments.exerciseType, exerciseType)
    )
  );
}

export async function getAllPrVideoJudgments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prVideoJudgments);
}

async function getLatestPrVideoJudgeIds(athleteId: number, excludeExerciseType: string) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select().from(prVideoJudgments).where(
    eq(prVideoJudgments.athleteId, athleteId)
  );

  const assignments = new Map<string, { latestTime: number; judgeIds: number[] }>();
  rows.forEach((row) => {
    if (row.exerciseType === excludeExerciseType) return;

    const latestTime = row.createdAt?.getTime?.() ?? 0;
    const assignment = assignments.get(row.exerciseType);
    if (!assignment) {
      assignments.set(row.exerciseType, { latestTime, judgeIds: [row.judgeId] });
      return;
    }

    assignment.latestTime = Math.max(assignment.latestTime, latestTime);
    if (!assignment.judgeIds.includes(row.judgeId)) {
      assignment.judgeIds.push(row.judgeId);
    }
  });

  return Array.from(assignments.values())
    .sort((left, right) => right.latestTime - left.latestTime)
    .find((assignment) => assignment.judgeIds.length > 0)?.judgeIds ?? [];
}

export async function assignLatestPrVideoJudgesIfMissing(athleteId: number, exerciseType: string) {
  const existingJudges = await getPrVideoJudgments(athleteId, exerciseType);
  if (existingJudges.length > 0) return [];

  const judgeIds = await getLatestPrVideoJudgeIds(athleteId, exerciseType);
  if (judgeIds.length === 0) return [];

  await assignPrVideoJudges(athleteId, exerciseType, judgeIds);
  return judgeIds;
}

export async function assignPrVideoJudges(athleteId: number, exerciseType: string, judgeIds: number[]) {
  const db = await getDb();
  if (!db) return;

  // Remove existing judges for this video
  await db.delete(prVideoJudgments).where(
    and(
      eq(prVideoJudgments.athleteId, athleteId),
      eq(prVideoJudgments.exerciseType, exerciseType)
    )
  );

  // Insert new judges
  const entries = judgeIds.map(judgeId => ({
    athleteId,
    exerciseType,
    judgeId,
    vote: null,
  }));

  if (entries.length > 0) {
    await db.insert(prVideoJudgments).values(entries);
  }
}

export async function submitPrVideoVote(athleteId: number, exerciseType: string, judgeId: number, vote: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(prVideoJudgments)
    .set({ vote, updatedAt: new Date() })
    .where(
      and(
        eq(prVideoJudgments.athleteId, athleteId),
        eq(prVideoJudgments.exerciseType, exerciseType),
        eq(prVideoJudgments.judgeId, judgeId)
      )
    );
}
