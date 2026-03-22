import { z } from "zod";

export const goalTypeSchema = z.enum(["lose_weight", "maintain_weight", "gain_weight"]);

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

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
export type FoodScanApiItem = z.infer<typeof foodScanApiItemSchema>;
export type FoodScanRequestBody = z.infer<typeof foodScanRequestBodySchema>;
