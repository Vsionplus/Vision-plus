import {
  Timestamp,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export const ADMIN_LOCKOUT_MAX_ATTEMPTS = 5;
export const ADMIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ADMIN_IDLE_WARNING_BEFORE_MS = 60 * 1000;
export const LAST_ATTEMPT_KEY_STORAGE = 'vp_admin_last_attempt_key';

export interface AdminLoginAttemptStatus {
  attemptId: string;
  failedCount: number;
  isLocked: boolean;
  lockedUntilMs: number | null;
  remainingMs: number;
}

function pureJsSha256Hex(input: string): string {
  const utf8 = unescape(encodeURIComponent(input));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= utf8.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  const bitLen = utf8.length * 8;
  words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32));
  words[((bitLen + 64) >> 9 << 4) + 15] = bitLen;

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  let H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const w = new Array<number>(64);
  for (let i = 0; i < words.length; i += 16) {
    let [a, b, c, d, e, f, g, h] = H;
    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] || 0;
      } else {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    H = [
      (H[0] + a) | 0,
      (H[1] + b) | 0,
      (H[2] + c) | 0,
      (H[3] + d) | 0,
      (H[4] + e) | 0,
      (H[5] + f) | 0,
      (H[6] + g) | 0,
      (H[7] + h) | 0,
    ];
  }

  return H.map((val) => (val >>> 0).toString(16).padStart(8, '0')).join('');
}

export async function hashAttemptEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encoded = new TextEncoder().encode(normalized);
      const digest = await window.crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback to pure JS SHA-256
    }
  }
  return pureJsSha256Hex(normalized);
}

function emptyAttemptStatus(attemptId: string): AdminLoginAttemptStatus {
  return {
    attemptId,
    failedCount: 0,
    isLocked: false,
    lockedUntilMs: null,
    remainingMs: 0,
  };
}

function getFirestoreCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code || 'unknown');
  }
  return error instanceof Error ? error.message : 'unknown';
}

function parseNullableTimestampMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (raw instanceof Timestamp) return raw.toMillis();
  if (
    typeof raw === 'object' &&
    'toMillis' in raw &&
    typeof (raw as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (raw as { toMillis: () => number }).toMillis();
  }
  return null;
}

function buildAttemptStatus(
  attemptId: string,
  count: number,
  lockedUntilMs: number | null
): AdminLoginAttemptStatus {
  const nowMs = Date.now();

  if (count >= ADMIN_LOCKOUT_MAX_ATTEMPTS && lockedUntilMs && lockedUntilMs > nowMs) {
    return {
      attemptId,
      failedCount: ADMIN_LOCKOUT_MAX_ATTEMPTS,
      isLocked: true,
      lockedUntilMs,
      remainingMs: lockedUntilMs - nowMs,
    };
  }

  if (count >= ADMIN_LOCKOUT_MAX_ATTEMPTS && (!lockedUntilMs || lockedUntilMs <= nowMs)) {
    return emptyAttemptStatus(attemptId);
  }

  return {
    attemptId,
    failedCount: Math.max(0, count),
    isLocked: false,
    lockedUntilMs: null,
    remainingMs: 0,
  };
}

export async function getAdminAttemptStatusById(attemptId: string): Promise<AdminLoginAttemptStatus> {
  try {
    let snap;
    try {
      snap = await getDocFromServer(doc(db, 'adminLoginAttempts', attemptId));
    } catch (serverErr) {
      const serverCode = getFirestoreCode(serverErr);
      if (serverCode === 'unavailable' || serverCode === 'failed-precondition') {
        snap = await getDoc(doc(db, 'adminLoginAttempts', attemptId));
      } else {
        throw serverErr;
      }
    }

    if (!snap.exists()) {
      return emptyAttemptStatus(attemptId);
    }

    const data = snap.data() as { count?: number; lockedUntil?: unknown };
    const count = typeof data.count === 'number' ? data.count : 0;
    const lockedUntilMs = parseNullableTimestampMs(data.lockedUntil);
    return buildAttemptStatus(attemptId, count, lockedUntilMs);
  } catch (err) {
    console.error(
      '[AdminLogin Step 4: read adminLoginAttempts]',
      getFirestoreCode(err),
      err
    );
    // Never block login if reading attempts fails (e.g. permission-denied or offline)
    return emptyAttemptStatus(attemptId);
  }
}

export async function getAdminAttemptStatusByEmail(email: string): Promise<AdminLoginAttemptStatus> {
  const attemptId = await hashAttemptEmail(email);
  return getAdminAttemptStatusById(attemptId);
}

export async function recordAdminFailedAttempt(email: string): Promise<AdminLoginAttemptStatus> {
  const attemptId = await hashAttemptEmail(email);
  try {
    localStorage.setItem(LAST_ATTEMPT_KEY_STORAGE, attemptId);
  } catch {
    // Ignore storage restriction
  }

  const ref = doc(db, 'adminLoginAttempts', attemptId);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    console.error(
      '[AdminLogin Step 4: read adminLoginAttempts before write]',
      getFirestoreCode(err),
      err
    );
    return emptyAttemptStatus(attemptId);
  }

  let nextCount = 1;
  let nextLockedUntil: Timestamp | null = null;
  let nextLockedUntilMs: number | null = null;

  try {
    if (!snap.exists()) {
      await setDoc(ref, {
        count: 1,
        lockedUntil: null,
      });
    } else {
      const data = snap.data() as { count?: number; lockedUntil?: unknown };
      const currentCount = typeof data.count === 'number' ? data.count : 0;
      const existingLockedMs = parseNullableTimestampMs(data.lockedUntil);
      const stillLocked =
        currentCount >= ADMIN_LOCKOUT_MAX_ATTEMPTS &&
        existingLockedMs !== null &&
        existingLockedMs > Date.now();

      if (stillLocked) {
        return buildAttemptStatus(attemptId, ADMIN_LOCKOUT_MAX_ATTEMPTS, existingLockedMs);
      }

      const expired =
        currentCount >= ADMIN_LOCKOUT_MAX_ATTEMPTS &&
        (existingLockedMs === null || existingLockedMs <= Date.now());

      nextCount = expired ? 1 : Math.min(ADMIN_LOCKOUT_MAX_ATTEMPTS, currentCount + 1);
      if (nextCount >= ADMIN_LOCKOUT_MAX_ATTEMPTS) {
        nextLockedUntilMs = Date.now() + ADMIN_LOCKOUT_DURATION_MS;
        nextLockedUntil = Timestamp.fromMillis(nextLockedUntilMs);
      } else {
        nextLockedUntilMs = null;
        nextLockedUntil = null;
      }

      await setDoc(ref, {
        count: nextCount,
        lockedUntil: nextLockedUntil,
      });
    }

    return buildAttemptStatus(attemptId, nextCount, nextLockedUntilMs);
  } catch (err) {
    console.error(
      '[AdminLogin Step 4: write adminLoginAttempts]',
      getFirestoreCode(err),
      err
    );
    // Do not block or mask real login errors if attempt logging fails
    return emptyAttemptStatus(attemptId);
  }
}

export async function clearAdminAttempts(email: string): Promise<void> {
  const attemptId = await hashAttemptEmail(email);
  try {
    localStorage.removeItem(LAST_ATTEMPT_KEY_STORAGE);
  } catch {
    // Ignore storage error
  }
  try {
    const ref = doc(db, 'adminLoginAttempts', attemptId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await setDoc(ref, {
        count: 0,
        lockedUntil: null,
      });
    }
  } catch (err) {
    console.error(
      '[AdminLogin Step 4: reset adminLoginAttempts]',
      getFirestoreCode(err),
      err
    );
    // Non-fatal: resetting counter must never block a valid admin login
  }
}
