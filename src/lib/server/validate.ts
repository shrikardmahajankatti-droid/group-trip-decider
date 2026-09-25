import "server-only";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{3,60}$/;

export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);
export const isSlug = (s: unknown): s is string => typeof s === "string" && SLUG.test(s);
