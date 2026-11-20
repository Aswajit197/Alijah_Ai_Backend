import crypto from 'crypto';

/**
 * Two-way mapper between arbitrary DB primary keys (like Prisma CUIDs)
 * and strict RFC 4122 v4 UUIDs expected by Retell voice-service (z.uuid())
 * and workflow-service (python UUID).
 */

const cuidToUuidMap = new Map<string, string>();
const uuidToCuidMap = new Map<string, string>();

export const DEFAULT_TENANT_UUID = '11111111-1111-4111-8111-111111111111';

export function toUuid(id: string): string {
  if (!id) return id;
  // If it's already a valid UUID, return in lowercase
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id.toLowerCase();
  }

  const cached = cuidToUuidMap.get(id);
  if (cached) return cached;

  // Generate deterministic v4-compliant UUID from MD5 of the CUID
  const hash = crypto.createHash('md5').update(id).digest('hex');
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  
  cuidToUuidMap.set(id, uuid);
  uuidToCuidMap.set(uuid, id);
  return uuid;
}

export function fromUuid(uuid: string): string {
  if (!uuid) return uuid;
  const cuid = uuidToCuidMap.get(uuid.toLowerCase());
  return cuid || uuid;
}

export function registerMapping(cuid: string, uuid: string): void {
  cuidToUuidMap.set(cuid, uuid.toLowerCase());
  uuidToCuidMap.set(uuid.toLowerCase(), cuid);
}
