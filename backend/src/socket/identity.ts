import jwt from "jsonwebtoken";

const MONGO_ID = /^[0-9a-fA-F]{24}$/;

export type UserRole = "user" | "artist" | "admin";

export interface VerifiedSocketUser {
  id: string;
  role: UserRole;
  fullName: string;
  avatar: string;
}

export interface SocketUserRecord {
  id: string;
  role: UserRole;
  fullName?: string | null;
  avatar?: string | null;
  isActive: boolean;
}

export type HandshakeAuthResult =
  | { status: "guest" }
  | { status: "authenticated"; user: VerifiedSocketUser }
  | { status: "rejected"; reason: "ACCOUNT_LOCKED" };

export function extractAccessToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "null" || trimmed.toLowerCase() === "bearer") {
    return null;
  }
  const bearer = trimmed.match(/^Bearer\s+(.+)$/i);
  if (bearer) {
    const token = bearer[1].trim();
    return token || null;
  }
  return trimmed;
}

/**
 * Verifies the access JWT already used by HTTP `protect`.
 * A missing, invalid, or expired token is a guest.
 * A locked account is rejected and must not fall back to that user's id.
 * The role comes from the user record, not from the token payload.
 */
export async function authenticateSocketToken(
  rawToken: unknown,
  secret: string,
  findUser: (id: string) => Promise<SocketUserRecord | null>,
): Promise<HandshakeAuthResult> {
  const token = extractAccessToken(rawToken);
  if (!token || !secret) return { status: "guest" };

  let userId: string;
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === "string" || typeof payload.id !== "string") {
      return { status: "guest" };
    }
    userId = payload.id;
  } catch {
    return { status: "guest" };
  }

  if (!MONGO_ID.test(userId)) return { status: "guest" };

  const record = await findUser(userId);
  if (!record || !MONGO_ID.test(record.id)) return { status: "guest" };
  if (record.isActive === false) {
    return { status: "rejected", reason: "ACCOUNT_LOCKED" };
  }
  if (
    record.role !== "user" &&
    record.role !== "artist" &&
    record.role !== "admin"
  ) {
    return { status: "guest" };
  }

  return {
    status: "authenticated",
    user: {
      id: record.id,
      role: record.role,
      fullName: record.fullName ?? "",
      avatar: record.avatar ?? "",
    },
  };
}

export interface ConnectionIdentity {
  userId: string;
  isGuest: boolean;
  user: VerifiedSocketUser | null;
}

export interface SocketIdentityState {
  userId?: string;
  isGuest?: boolean;
  user?: VerifiedSocketUser;
  fullName?: string;
  avatar?: string;
}

/**
 * Identity is derived only from the handshake auth result.
 * This function does not accept handshake.query.userId.
 */
export function resolveConnectionIdentity(
  auth: HandshakeAuthResult,
  socketId: string,
): ConnectionIdentity {
  if (
    auth.status === "authenticated" &&
    MONGO_ID.test(auth.user.id)
  ) {
    return { userId: auth.user.id, isGuest: false, user: auth.user };
  }
  return { userId: `guest_${socketId}`, isGuest: true, user: null };
}

/** Writes the connection identity onto socket.data and drops any previous user. */
export function applyConnectionIdentity(
  data: SocketIdentityState,
  identity: ConnectionIdentity,
): void {
  data.userId = identity.userId;
  data.isGuest = identity.isGuest;
  if (identity.user && !identity.isGuest && identity.userId === identity.user.id) {
    data.user = identity.user;
    data.fullName = identity.user.fullName;
    data.avatar = identity.user.avatar;
    return;
  }
  delete data.user;
  delete data.fullName;
  delete data.avatar;
}

/**
 * Private notification and kick delivery room.
 * Guests and rejected handshakes do not join a user room.
 */
export function privateNotificationRoom(
  identity: ConnectionIdentity,
): string | null {
  if (
    identity.isGuest ||
    !identity.user ||
    identity.userId !== identity.user.id ||
    !MONGO_ID.test(identity.user.id)
  ) {
    return null;
  }
  return identity.user.id;
}

export function canJoinAdminDashboard(
  user: VerifiedSocketUser | null | undefined,
): boolean {
  return user?.role === "admin";
}

/**
 * The web client joins rooms through named events (`join_chart_page`,
 * `room:join`, `listening_track`). A client-supplied room name is not a
 * membership proof, so `join_room` cannot enter `admin_room`, a user id,
 * or a music room.
 */
export function canClientJoinRoom(_room: unknown): boolean {
  return false;
}

export function isRoomHost(
  hostId: unknown,
  user: VerifiedSocketUser | null | undefined,
): boolean {
  return (
    !!user &&
    typeof hostId === "string" &&
    MONGO_ID.test(hostId) &&
    hostId === user.id
  );
}

export function isSocketInMusicRoom(
  rooms: Iterable<string>,
  roomCode: string,
): boolean {
  if (!roomCode) return false;
  const target = `music_room:${roomCode}`;
  for (const room of rooms) {
    if (room === target) return true;
  }
  return false;
}

/** Analytics id. Verified sockets ignore the payload. Guests may only send `guest_*`. */
export function resolveActivityUserId(
  user: VerifiedSocketUser | null | undefined,
  payloadUserId: unknown,
  socketId: string,
): string {
  if (user && MONGO_ID.test(user.id)) return user.id;
  if (
    typeof payloadUserId === "string" &&
    payloadUserId.startsWith("guest_") &&
    !MONGO_ID.test(payloadUserId)
  ) {
    return payloadUserId;
  }
  return `guest_${socketId}`;
}

/** Play history is stored only for a verified user. */
export function resolvePlayUserId(
  user: VerifiedSocketUser | null | undefined,
): string | null {
  if (user && MONGO_ID.test(user.id)) return user.id;
  return null;
}

export function resolvePlayRateLimitIdentity(
  user: VerifiedSocketUser | null | undefined,
  socketId: string,
  ip: string,
): string {
  if (user && MONGO_ID.test(user.id)) return user.id;
  return ip || socketId;
}

export function readVerifiedUserId(
  data: { userId?: unknown; user?: { id?: unknown } } | undefined,
): string | undefined {
  const id = data?.user?.id;
  if (typeof id !== "string" || !MONGO_ID.test(id)) return undefined;
  if (data?.userId !== undefined && data.userId !== id) return undefined;
  return id;
}

export function selectNextHostId(
  candidateIds: ReadonlyArray<string | undefined>,
  leavingUserId: string,
): string | undefined {
  for (const id of candidateIds) {
    if (id && MONGO_ID.test(id) && id !== leavingUserId) return id;
  }
  return undefined;
}
