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

export const appStorageSchema = z.object({
  version: z.literal(1),
  profile: userProfileSchema,
  entries: z.array(foodLogEntrySchema),
});

export type GoalType = z.infer<typeof goalTypeSchema>;
export type MealType = z.infer<typeof mealTypeSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type ImageMetadata = z.infer<typeof imageMetadataSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type FoodLogEntry = z.infer<typeof foodLogEntrySchema>;
export type FoodLogEntryDraft = z.infer<typeof foodLogEntryDraftSchema>;
export type UserProfileDraft = z.infer<typeof userProfileDraftSchema>;
