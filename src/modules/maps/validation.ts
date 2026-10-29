import { z } from "zod";
import { isWithinUae } from "./geo";

export const mapLookupOperationSchema = z.enum(["autocomplete", "place", "geocode", "reverse-geocode"]);
export type MapLookupOperation = z.infer<typeof mapLookupOperationSchema>;

/** Google place IDs are URL-safe tokens; reject anything else before it reaches a URL path. */
export const googlePlaceIdSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,255}$/, "Choose a valid Google place.");
/** Browser-generated autocomplete session token (UUID), used only to group billing. */
export const placesSessionTokenSchema = z.string().regex(/^[A-Za-z0-9-]{16,64}$/);

export const mapLookupSchemas = {
  autocomplete: z.strictObject({input: z.string().trim().min(2).max(200), sessionToken: placesSessionTokenSchema}),
  place: z.strictObject({placeId: googlePlaceIdSchema, sessionToken: placesSessionTokenSchema.nullable().optional()}),
  geocode: z.strictObject({address: z.string().trim().min(3).max(500)}),
  "reverse-geocode": z.strictObject({latitude: z.number().finite(), longitude: z.number().finite()})
    .refine(value => isWithinUae(value.latitude, value.longitude), {message: "Place the pin inside the United Arab Emirates."}),
} satisfies Record<MapLookupOperation, z.ZodType>;

const boundValue = (min: number, max: number) => z.union([z.number(), z.string().trim().regex(/^-?\d{1,3}(?:\.\d{1,10})?$/).transform(Number)])
  .pipe(z.number().finite().min(min).max(max));

/**
 * Visible map area sent with map-pin requests. All four edges or none; the
 * antimeridian is not supported (UAE inventory never crosses it).
 */
export const mapViewportSchema = z.strictObject({
  south: boundValue(-90, 90), north: boundValue(-90, 90), west: boundValue(-180, 180), east: boundValue(-180, 180),
}).refine(value => value.south < value.north && value.west < value.east, {message: "Map bounds must have south below north and west below east."});

export const mapPinPageSchema = z.union([z.number(), z.string().regex(/^\d{1,5}$/).transform(Number)]).pipe(z.number().int().min(0).max(20_000));
