import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { User, InsertUser, users, athletes, InsertAthlete, weightEntries, InsertWeightEntry, liftRecords, InsertLiftRecord } from "../drizzle/schema";
import { getAllAthletes, getAthleteById, getLiftRecordsForAthlete, getWeightEntriesForAthlete, addLiftRecord, addWeightEntry, updateLiftRecord, updateAthlete, getLeaderboardByExercise, importAthlete, enforceAthleteOwnership, linkUserToAthlete, getAllGyms, getGymById, getGymBySlug, getGymByInviteCode, createGym, updateAthleteGym, getAllUsers, updateUserRole, requestGymAdd, getAllGymRequests, updateGymRequestStatus, getGymRequestById, getUserById, getPrVideos, upsertPrVideo, deletePrVideo, getPrVideosByExercise, getAllPrVideos, getPrVideoJudgments, getAllPrVideoJudgments, assignPrVideoJudges, submitPrVideoVote } from "./db";

export const appRouter = router({
  system: router({
    version: publicProcedure.query(() => "1.0.2"),
    getAllUsers: protectedProcedure.query(() => getAllUsers()),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  leaderboard: router({
    getAll: publicProcedure.query(() => getAllAthletes()),
    getByExercise: publicProcedure
      .input(z.object({
        exercise: z.string(),
        gymId: z.number().optional(),
        gender: z.enum(["male", "female"]).optional()
      }))
      .query(({ input }) => getLeaderboardByExercise(input.exercise, input.gymId, input.gender)),
  }),

  gym: router({
    getAll: publicProcedure.query(() => getAllGyms()),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getGymById(input.id)),

    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(({ input }) => getGymBySlug(input.slug)),

    join: protectedProcedure
      .input(z.object({ inviteCode: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user || !ctx.user.athleteId) throw new Error("No athlete profile found");
        const gym = await getGymByInviteCode(input.inviteCode);
        if (!gym) throw new Error("Invalid invite code");

        await updateAthleteGym(ctx.user.athleteId, gym.id);
        return gym;
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        slug: z.string(),
        inviteCode: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        if (ctx.user.role !== 'admin') throw new Error("Unauthorized: Only admins can create gyms directly");
        const gym = await createGym({
          ...input,
          createdBy: ctx.user.id,
        });

        if (gym && ctx.user.athleteId) {
          await updateAthleteGym(ctx.user.athleteId, gym.id);
        }

        return gym;
      }),

    leave: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!ctx.user || !ctx.user.athleteId) throw new Error("No athlete profile found");
        await updateAthleteGym(ctx.user.athleteId, null);
        return { success: true };
      }),

    requestAdd: protectedProcedure
      .input(z.object({ name: z.string(), location: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        return requestGymAdd({
          name: input.name,
          location: input.location,
          requestedBy: ctx.user.id,
          status: 'pending'
        });
      }),
  }),

  admin: router({
    listUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      return getAllUsers();
    }),
    setUserRole: protectedProcedure
      .input(z.object({ userId: z.number(), role: z.enum(['user', 'admin']) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
        return updateUserRole(input.userId, input.role);
      }),
    listGymRequests: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");
      return getAllGymRequests();
    }),
    updateGymRequestStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(['pending', 'approved', 'rejected']) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user?.role !== 'admin') throw new Error("Unauthorized");

        if (input.status === 'approved') {
          const req = await getGymRequestById(input.id);
          if (req && req.status !== 'approved') {
            const slug = req.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
            const prefix = (req.name.match(/[A-Z]/g) || req.name.substring(0, 3).toUpperCase().split('')).slice(0, 3).join('').toUpperCase().padEnd(3, 'X');
            const inviteCode = `${prefix}${Math.floor(100 + Math.random() * 899)}`;

            const gym = await createGym({
              name: req.name,
              slug,
              inviteCode,
              createdBy: req.requestedBy,
            });

            // Automatically add the requesting user to the gym
            if (gym) {
              const requestingUser = await getUserById(req.requestedBy);
              if (requestingUser?.athleteId) {
                await updateAthleteGym(requestingUser.athleteId, gym.id);
              }
            }
          }
        }

        return updateGymRequestStatus(input.id, input.status as any);
      }),
  }),

  athlete: router({
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getAthleteById(input.id)),

    getLiftHistory: publicProcedure
      .input(z.object({ athleteId: z.number(), exerciseType: z.string().optional() }))
      .query(({ input }) => getLiftRecordsForAthlete(input.athleteId, input.exerciseType)),

    getWeightHistory: publicProcedure
      .input(z.object({ athleteId: z.number() }))
      .query(({ input }) => getWeightEntriesForAthlete(input.athleteId)),

    addLift: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        exerciseType: z.string(),
        weight: z.number().optional(),
        reps: z.number().optional(),
        distance: z.number().optional(),
        recordedDate: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await enforceAthleteOwnership(input.athleteId, ctx.user);
        const athlete = await getAthleteById(input.athleteId);
        if (!athlete) throw new Error("Athlete not found");
        const dateStr = new Date(input.recordedDate).toISOString().split('T')[0];
        return addLiftRecord({
          athleteId: input.athleteId,
          exerciseType: input.exerciseType,
          weight: input.weight !== undefined ? String(input.weight) : null,
          reps: input.reps || 1,
          distance: input.distance !== undefined ? String(input.distance) : null,
          recordedDate: dateStr,
          notes: input.notes,
        });
      }),

    addWeight: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        weight: z.number(),
        recordedDate: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await enforceAthleteOwnership(input.athleteId, ctx.user);
        const dateStr = new Date(input.recordedDate).toISOString().split('T')[0];
        return addWeightEntry({
          athleteId: input.athleteId,
          weight: String(input.weight),
          recordedDate: dateStr,
        });
      }),

    updateLift: protectedProcedure
      .input(z.object({
        liftId: z.number(),
        weight: z.number().optional(),
        reps: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // For updateLift, we need to check the ownership of the athlete associated with the lift
        // For simplicity, let's assume the user can only edit their own history
        if (ctx.user?.athleteId) {
          return updateLiftRecord(input.liftId, {
            weight: input.weight ? String(input.weight) : undefined,
            reps: input.reps,
            notes: input.notes,
          });
        }
        throw new Error("Unauthorized");
      }),

    updateProfile: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        name: z.string().optional(),
        bodyWeight: z.number().optional(),
        squat: z.number().optional(),
        bench: z.number().optional(),
        deadlift: z.number().optional(),
        ohp: z.number().optional(),
        farmersWalkWeight: z.number().optional(),
        farmersWalkDistance: z.number().optional(),
        yokeWalkWeight: z.number().optional(),
        yokeWalkDistance: z.number().optional(),
        dipsReps: z.number().optional(),
        dipsWeight: z.number().optional(),
        pullUpsReps: z.number().optional(),
        pullUpsWeight: z.number().optional(),
        avatarUrl: z.string().optional(),
        gender: z.enum(["male", "female"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await enforceAthleteOwnership(input.athleteId, ctx.user);
        const { athleteId, ...updates } = input;
        let newTotal: string | null | undefined = undefined;
        if (updates.squat !== undefined && updates.bench !== undefined && updates.deadlift !== undefined) {
          newTotal = String(updates.squat + updates.bench + updates.deadlift);
        }
        return updateAthlete(athleteId, {
          name: updates.name,
          bodyWeight: updates.bodyWeight !== undefined ? String(updates.bodyWeight) : undefined,
          squat: updates.squat !== undefined ? String(updates.squat) : undefined,
          bench: updates.bench !== undefined ? String(updates.bench) : undefined,
          deadlift: updates.deadlift !== undefined ? String(updates.deadlift) : undefined,
          ohp: updates.ohp !== undefined ? String(updates.ohp) : undefined,
          farmersWalkWeight: updates.farmersWalkWeight !== undefined ? String(updates.farmersWalkWeight) : undefined,
          farmersWalkDistance: updates.farmersWalkDistance !== undefined ? String(updates.farmersWalkDistance) : undefined,
          yokeWalkWeight: updates.yokeWalkWeight !== undefined ? String(updates.yokeWalkWeight) : undefined,
          yokeWalkDistance: updates.yokeWalkDistance !== undefined ? String(updates.yokeWalkDistance) : undefined,
          dipsReps: updates.dipsReps,
          dipsWeight: updates.dipsWeight !== undefined ? String(updates.dipsWeight) : undefined,
          pullUpsReps: updates.pullUpsReps,
          pullUpsWeight: updates.pullUpsWeight !== undefined ? String(updates.pullUpsWeight) : undefined,
          avatarUrl: updates.avatarUrl,
          gender: updates.gender,
          total: newTotal,
        });
      }),

    setupProfile: protectedProcedure
      .input(z.object({
        name: z.string(),
        gender: z.enum(["male", "female"]),
        squat: z.number().optional(),
        bench: z.number().optional(),
        deadlift: z.number().optional(),
        ohp: z.number().optional(),
        farmersWalkWeight: z.number().optional(),
        farmersWalkDistance: z.number().optional(),
        yokeWalkWeight: z.number().optional(),
        yokeWalkDistance: z.number().optional(),
        dipsReps: z.number().optional(),
        dipsWeight: z.number().optional(),
        pullUpsReps: z.number().optional(),
        pullUpsWeight: z.number().optional(),
        bodyWeight: z.number().optional(),
        avatarUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new Error("Unauthorized");
        console.log(`[setupProfile] Setting up profile for user ${ctx.user.id}: ${input.name}`);

        // Create athlete
        const total = (input.squat || 0) + (input.bench || 0) + (input.deadlift || 0);
        const athlete = await importAthlete({
          name: input.name,
          email: ctx.user.email,
          avatarUrl: input.avatarUrl,
          gender: input.gender,
          squat: input.squat !== undefined ? String(input.squat) : null,
          bench: input.bench !== undefined ? String(input.bench) : null,
          deadlift: input.deadlift !== undefined ? String(input.deadlift) : null,
          ohp: input.ohp !== undefined ? String(input.ohp) : null,
          farmersWalkWeight: input.farmersWalkWeight !== undefined ? String(input.farmersWalkWeight) : null,
          farmersWalkDistance: input.farmersWalkDistance !== undefined ? String(input.farmersWalkDistance) : null,
          yokeWalkWeight: input.yokeWalkWeight !== undefined ? String(input.yokeWalkWeight) : null,
          yokeWalkDistance: input.yokeWalkDistance !== undefined ? String(input.yokeWalkDistance) : null,
          dipsReps: input.dipsReps,
          dipsWeight: input.dipsWeight !== undefined ? String(input.dipsWeight) : null,
          pullUpsReps: input.pullUpsReps,
          pullUpsWeight: input.pullUpsWeight !== undefined ? String(input.pullUpsWeight) : null,
          bodyWeight: input.bodyWeight !== undefined ? String(input.bodyWeight) : null,
          total: total > 0 ? String(total) : null,
        });

        if (athlete) {
          await linkUserToAthlete(ctx.user.id, athlete.id);
          // Also record initial lifts in history
          const lifts = [
            { type: 'squat', val: input.squat },
            { type: 'bench', val: input.bench },
            { type: 'deadlift', val: input.deadlift },
            { type: 'ohp', val: input.ohp },
            { type: 'farmersWalk', weight: input.farmersWalkWeight, distance: input.farmersWalkDistance },
            { type: 'yokeWalk', weight: input.yokeWalkWeight, distance: input.yokeWalkDistance },
            { type: 'dips', reps: input.dipsReps, weight: input.dipsWeight },
            { type: 'pullUps', reps: input.pullUpsReps, weight: input.pullUpsWeight },
          ];
          const dateStr = new Date().toISOString().split('T')[0];
          for (const lift of lifts) {
            const l = lift as any;
            if (l.val || l.weight || l.distance || l.reps) {
              await addLiftRecord({
                athleteId: athlete.id,
                exerciseType: l.type,
                weight: l.val || l.weight ? String(l.val || l.weight) : null,
                reps: l.reps || 1,
                distance: l.distance ? String(l.distance) : null,
                recordedDate: dateStr,
              });
            }
          }
          if (input.bodyWeight) {
            await addWeightEntry({
              athleteId: athlete.id,
              weight: String(input.bodyWeight),
              recordedDate: dateStr,
            });
          }
          return athlete;
        }
        throw new Error("Failed to create athlete profile");
      }),

    // PR Videos
    getPrVideos: publicProcedure
      .input(z.object({ athleteId: z.number() }))
      .query(({ input }) => getPrVideos(input.athleteId)),

    getPrVideosByExercise: publicProcedure
      .input(z.object({ exerciseType: z.string() }))
      .query(({ input }) => getPrVideosByExercise(input.exerciseType)),

    getAllPrVideos: publicProcedure
      .query(() => getAllPrVideos()),

    getPrVideoJudgments: publicProcedure
      .input(z.object({ athleteId: z.number(), exerciseType: z.string() }))
      .query(({ input }) => getPrVideoJudgments(input.athleteId, input.exerciseType)),

    getAllPrVideoJudgments: publicProcedure
      .query(() => getAllPrVideoJudgments()),

    assignPrVideoJudges: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        exerciseType: z.string(),
        judgeIds: z.array(z.number())
      }))
      .mutation(async ({ input, ctx }) => {
        // Only athlete owner or admin can assign judges
        if (ctx.user.role !== 'admin') {
          await enforceAthleteOwnership(input.athleteId, ctx.user);
        }
        return assignPrVideoJudges(input.athleteId, input.exerciseType, input.judgeIds);
      }),

    submitPrVideoVote: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        exerciseType: z.string(),
        vote: z.enum(['white', 'red'])
      }))
      .mutation(async ({ input, ctx }) => {
        return submitPrVideoVote(input.athleteId, input.exerciseType, ctx.user.id, input.vote);
      }),

    upsertPrVideo: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        exerciseType: z.string(),
        videoUrl: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await enforceAthleteOwnership(input.athleteId, ctx.user);
        await upsertPrVideo(input.athleteId, input.exerciseType, input.videoUrl);
        return { success: true };
      }),

    deletePrVideo: protectedProcedure
      .input(z.object({
        athleteId: z.number(),
        exerciseType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await enforceAthleteOwnership(input.athleteId, ctx.user);
        await deletePrVideo(input.athleteId, input.exerciseType);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
