import * as z from 'zod';

const finite = z.number().finite();
const widthFields = { minWidth: finite, maxWidth: finite };
const validWidths = ({ minWidth, maxWidth }: { minWidth: number; maxWidth: number }) => minWidth < maxWidth;
const widthError = { path: ['maxWidth'], error: 'must be greater than minWidth' };
const relativeTo = z.enum(['viewport', 'container', 'viewport-width']);
const stepCount = z.number({ error: 'must be a non-negative integer count' })
  .int({ error: 'must be a non-negative integer count' })
  .nonnegative({ error: 'must be a non-negative integer count' });

const typeSchema = z.strictObject({
  ...widthFields,
  minFontSize: finite,
  maxFontSize: finite,
  minTypeScale: finite,
  maxTypeScale: finite,
  negativeSteps: stepCount.optional(),
  positiveSteps: stepCount.optional(),
  relativeTo: relativeTo.optional(),
  labelStyle: z.enum(['utopia', 'tailwind', 'tshirt']).optional(),
}).refine(validWidths, widthError);

const spaceSchema = z.strictObject({
  ...widthFields,
  minSize: finite,
  maxSize: finite,
  negativeSteps: z.array(finite).optional(),
  positiveSteps: z.array(finite).optional(),
  customSizes: z.array(z.string()).optional(),
  relativeTo: relativeTo.optional(),
}).refine(validWidths, widthError);

const clampSchema = z.strictObject({
  ...widthFields,
  minSize: finite,
  maxSize: finite,
  usePx: z.boolean().optional(),
  relativeTo: relativeTo.optional(),
}).refine(validWidths, widthError);

const cssName = /^[a-z][a-z0-9-]*$/i;
const colorName = z.string().regex(/^[a-z0-9][a-z0-9-]*$/i);
const colorValue = z.string().trim().min(1).refine(
  (value) => !/[;{}\x00-\x1f\x7f]|\/\*|\*\/|!important/i.test(value),
  { error: 'must not contain CSS declarations or comments' },
);
const colorGroup = z.record(colorName, colorValue).refine(
  (group) => Object.keys(group).length > 0,
  { error: 'must contain at least one color' },
);
const colorsSchema = z.record(colorName, z.union([colorValue, colorGroup])).refine(
  (colors) => Object.keys(colors).length > 0,
  { error: 'must contain at least one color' },
);

/** The input format shared by the generator and future CLI/Vite integrations. */
export const flutilityCssConfigSchema = z.strictObject({
  type: typeSchema.optional(),
  space: spaceSchema.optional(),
  clamps: z.record(z.string().regex(cssName), clampSchema).optional(),
  colors: colorsSchema.optional(),
  themes: z.record(z.string().regex(cssName), z.strictObject({ colors: colorsSchema })).optional(),
  selector: z.string().trim().min(1)
    .refine((value) => !/[{}]/.test(value), { error: 'must be a CSS selector without braces' })
    .default(':root'),
  prefix: z.string().regex(cssName, { error: 'must start with a letter and contain only letters, numbers, or hyphens' })
    .default('flutility'),
}).refine(
  ({ type, space, clamps, colors }) => Boolean(type || space || colors || Object.keys(clamps ?? {}).length),
  { error: 'Provide at least one of type, space, clamps, or colors' },
);

export type FlutilityCssConfig = z.input<typeof flutilityCssConfigSchema>;

export function parseConfig(config: unknown): z.output<typeof flutilityCssConfigSchema> {
  const result = flutilityCssConfigSchema.safeParse(config);
  if (!result.success) throw new Error(z.prettifyError(result.error));
  return result.data;
}
