import { z } from "zod";

export const goalTypeSchema = z.enum(["lose_weight", "maintain_weight", "gain_weight"]);

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

/** Whether the line is solid food or a beverage — same macro fields either way. */
export const logItemCategorySchema = z.enum(["food", "drink"]);

export const sourceTypeSchema = z.enum(["manual", "ai_scan"]);

export const imageSourceMethodSchema = z.enum(["camera", "upload", "unknown"]);

export const imageMetadataSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().nonnegative(),
  uploadedAt: z.string().datetime(),
  sourceMethod: imageSourceMethodSchema,
});

export const userProfileSchema = z.object({
  nickname: z.string().min(1).max(80),
  email: z.string().email().max(320),
  goalType: goalTypeSchema,
  dailyCalorieTarget: z.number().positive().finite().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const foodLogEntrySchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  mealType: mealTypeSchema,
  itemCategory: logItemCategorySchema.default("food"),
  foodName: z.string().min(1).max(200),
  quantity: z.number().positive().finite(),
  unit: z.string().min(1).max(40),
  calories: z.number().nonnegative().finite(),
  protein: z.number().nonnegative().finite(),
  carbs: z.number().nonnegative().finite(),
  fat: z.number().nonnegative().finite(),
  notes: z.string().max(2000).optional(),
  sourceType: sourceTypeSchema,
  aiConfidence: z.number().min(0).max(1).optional(),
  aiAssumptions: z.string().max(4000).optional(),
  imageMetadata: imageMetadataSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const foodLogEntryDraftSchema = foodLogEntrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const userProfileDraftSchema = userProfileSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const suggestionToneSchema = z.enum(["info", "tip", "caution"]);

export const suggestionItemSchema = z.object({
  id: z.string(),
  tone: suggestionToneSchema,
  title: z.string(),
  body: z.string(),
});

export const suggestionInputSnapshotSchema = z.object({
  dayCalories: z.number().nonnegative().finite(),
  dayProtein: z.number().nonnegative().finite(),
  dayCarbs: z.number().nonnegative().finite(),
  dayFat: z.number().nonnegative().finite(),
  entryCount: z.number().int().nonnegative(),
});

export const suggestionSnapshotSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string().datetime(),
  inputSnapshot: suggestionInputSnapshotSchema,
  suggestions: z.array(suggestionItemSchema),
});

/** Input snapshot stored with each LLM coach response (for analytics / replay). */
export const coachAdviceInputSnapshotSchema = z.object({
  dayCalories: z.number().nonnegative().finite(),
  dayProtein: z.number().nonnegative().finite(),
  dayCarbs: z.number().nonnegative().finite(),
  dayFat: z.number().nonnegative().finite(),
  entryCount: z.number().int().nonnegative(),
});

/** One saved AI coach message for a calendar day (max 2 per day in the app). */
export const coachAdviceSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Sequence within day; 1-2 are internal coach calls, higher can be third-party imports. */
  sequence: z.number().int().min(1).max(20),
  generatedAt: z.string().datetime(),
  inputSnapshot: coachAdviceInputSnapshotSchema,
  summary: z.string().min(1).max(16000),
});

export const coachAdviceDayEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  mealType: mealTypeSchema,
  itemCategory: logItemCategorySchema,
  foodName: z.string().min(1).max(200),
  quantity: z.number().positive().finite(),
  unit: z.string().min(1).max(40),
  calories: z.number().nonnegative().finite(),
  protein: z.number().nonnegative().finite(),
  carbs: z.number().nonnegative().finite(),
  fat: z.number().nonnegative().finite(),
});

export const coachAdviceRecentDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totals: z.object({
    calories: z.number().nonnegative().finite(),
    protein: z.number().nonnegative().finite(),
    carbs: z.number().nonnegative().finite(),
    fat: z.number().nonnegative().finite(),
  }),
  entries: z.array(coachAdviceDayEntrySchema).max(200),
});

export const coachAdviceRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  coachInsightNumber: z.union([z.literal(1), z.literal(2)]),
  profile: z.object({
    nickname: z.string().min(1).max(80).optional(),
    goalType: goalTypeSchema,
    dailyCalorieTarget: z.number().positive().finite().optional(),
  }),
  dayTotals: z.object({
    calories: z.number().nonnegative().finite(),
    protein: z.number().nonnegative().finite(),
    carbs: z.number().nonnegative().finite(),
    fat: z.number().nonnegative().finite(),
  }),
  entries: z.array(coachAdviceDayEntrySchema).min(1).max(200),
  recentDays: z.array(coachAdviceRecentDaySchema).min(1).max(7),
});

export const coachAdviceResponseSchema = z.object({
  summary: z.string().min(1).max(16000),
});

export const persistedStateV1Schema = z.object({
  version: z.literal(1),
  profile: userProfileSchema.nullable(),
  entries: z.array(foodLogEntrySchema),
});

export const persistedStateV2Schema = z.object({
  version: z.literal(2),
  profile: userProfileSchema.nullable(),
  entries: z.array(foodLogEntrySchema),
  suggestionHistory: z.array(suggestionSnapshotSchema),
});

export const persistedStateV3Schema = z.object({
  version: z.literal(3),
  profile: userProfileSchema.nullable(),
  entries: z.array(foodLogEntrySchema),
  suggestionHistory: z.array(suggestionSnapshotSchema),
  coachAdviceHistory: z.array(coachAdviceSchema),
});

export const appStorageSchema = z.object({
  version: z.literal(1),
  profile: userProfileSchema,
  entries: z.array(foodLogEntrySchema),
});

/** Food-scan JSON (vision models) — validated server-side before mapping to drafts. */
export const foodScanApiItemSchema = z.object({
  foodName: z.string().min(1).max(200),
  quantity: z.number().positive().finite(),
  unit: z.string().min(1).max(40),
  calories: z.number().nonnegative().finite(),
  protein: z.number().nonnegative().finite(),
  carbs: z.number().nonnegative().finite(),
  fat: z.number().nonnegative().finite(),
  confidence: z.number().min(0).max(1),
  assumptions: z.string().max(2000),
  mealType: mealTypeSchema.optional(),
});

export const foodScanApiResponseSchema = z.object({
  items: z.array(foodScanApiItemSchema).min(1).max(20),
});

export const foodScanRequestBodySchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().min(1),
  defaultMealType: mealTypeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  imageMetadata: imageMetadataSchema,
  /** Optional user context to steer the vision model (also stored on saved entries as `notes`). */
  userDescription: z.string().max(2000).optional(),
});

export type GoalType = z.infer<typeof goalTypeSchema>;
export type MealType = z.infer<typeof mealTypeSchema>;
export type LogItemCategory = z.infer<typeof logItemCategorySchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type ImageMetadata = z.infer<typeof imageMetadataSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type FoodLogEntry = z.infer<typeof foodLogEntrySchema>;
export type FoodLogEntryDraft = z.infer<typeof foodLogEntryDraftSchema>;
export type UserProfileDraft = z.infer<typeof userProfileDraftSchema>;
export type SuggestionTone = z.infer<typeof suggestionToneSchema>;
export type SuggestionItem = z.infer<typeof suggestionItemSchema>;
export type SuggestionInputSnapshot = z.infer<typeof suggestionInputSnapshotSchema>;
export type SuggestionSnapshot = z.infer<typeof suggestionSnapshotSchema>;
export type CoachAdviceInputSnapshot = z.infer<typeof coachAdviceInputSnapshotSchema>;
export type CoachAdvice = z.infer<typeof coachAdviceSchema>;
export type CoachAdviceDayEntry = z.infer<typeof coachAdviceDayEntrySchema>;
export type CoachAdviceRequest = z.infer<typeof coachAdviceRequestSchema>;
export type CoachAdviceResponse = z.infer<typeof coachAdviceResponseSchema>;
export type FoodScanApiItem = z.infer<typeof foodScanApiItemSchema>;
export type FoodScanRequestBody = z.infer<typeof foodScanRequestBodySchema>;

/** POST /api/food-macro-estimate — text-only macro estimate for manual food entry. */
export const foodMacroEstimateRequestSchema = z.object({
  foodName: z.string().min(1).max(200),
  quantity: z.number().positive().finite(),
  unit: z.string().min(1).max(40),
  /** Extra context for the model (brand, cooking method, etc.); not required. */
  notes: z.string().max(2000).optional(),
});

export const foodMacroEstimateResponseSchema = z.object({
  calories: z.number().nonnegative().finite(),
  protein: z.number().nonnegative().finite(),
  carbs: z.number().nonnegative().finite(),
  fat: z.number().nonnegative().finite(),
  assumptions: z.string().max(2000).optional(),
});

export type FoodMacroEstimateRequest = z.infer<typeof foodMacroEstimateRequestSchema>;
export type FoodMacroEstimateResponse = z.infer<typeof foodMacroEstimateResponseSchema>;

export type PersistedStateV3 = z.infer<typeof persistedStateV3Schema>;

/** User block inside a JSON export — `goalType` may be a legacy string. */
export const nutrilogExportUserSchema = z.object({
  nickname: z.string(),
  email: z.string().email(),
  goalType: z.string(),
  dailyCalorieTarget: z.number().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Validates a `nutrilog-export` JSON file (v2+; v2 omits `coachAdvice` in the wild). */
export const nutrilogExportDocumentSchema = z.object({
  format: z.literal("nutrilog-export"),
  schemaVersion: z.number().int().min(1).max(99),
  exportedAt: z.string(),
  dateRange: z.object({ start: z.string(), end: z.string() }),
  user: nutrilogExportUserSchema.nullable(),
  foodLogEntries: z.array(foodLogEntrySchema),
  suggestionSnapshots: z.array(suggestionSnapshotSchema),
  coachAdvice: z.array(coachAdviceSchema).optional().default([]),
});

/** Settings / profile updates when email is owned by auth (Supabase). */
export const userProfileUpdateDraftSchema = z.object({
  nickname: z.string().min(1).max(80),
  goalType: goalTypeSchema,
  dailyCalorieTarget: z.number().positive().finite().optional(),
});

export type NutrilogExportUser = z.infer<typeof nutrilogExportUserSchema>;
export type NutrilogExportDocument = z.infer<typeof nutrilogExportDocumentSchema>;
export type UserProfileUpdateDraft = z.infer<typeof userProfileUpdateDraftSchema>;
