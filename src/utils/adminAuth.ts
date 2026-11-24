import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
  updateDoc,
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

function parseTimestampMs(raw: unknown): number {
  if (raw instanceof Timestamp) return raw.toMillis();
  if (raw && typeof raw === 'object' && 'toMillis' in raw && typeof (raw as { toMillis: () => number }).toMillis === 'function') {
    return (raw as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export async function getAdminAttemptStatusById(attemptId: string): Promise<AdminLoginAttemptStatus> {
  try {
    let snap;
    try {
      snap = await getDocFromServer(doc(db, 'adminLoginAttempts', attemptId));
    } catch {
      snap = await getDoc(doc(db, 'adminLoginAttempts', attemptId));
    }

    if (!snap.exists()) {
      return {
        attemptId,
        failedCount: 0,
        isLocked: false,
        lockedUntilMs: null,
        remainingMs: 0,
      };
    }

    const data = snap.data() as { failedCount?: number; lastAttemptAt?: unknown };
    const failedCount = typeof data.failedCount === 'number' ? data.failedCount : 0;
    const lastAttemptMs = parseTimestampMs(data.lastAttemptAt);
    const unlockAtMs = lastAttemptMs + ADMIN_LOCKOUT_DURATION_MS;
    const nowMs = Date.now();

    if (failedCount >= ADMIN_LOCKOUT_MAX_ATTEMPTS && unlockAtMs > nowMs) {
      return {
        attemptId,
        failedCount: ADMIN_LOCKOUT_MAX_ATTEMPTS,
        isLocked: true,
        lockedUntilMs: unlockAtMs,
        remainingMs: unlockAtMs - nowMs,
      };
    }

    if (failedCount >= ADMIN_LOCKOUT_MAX_ATTEMPTS && unlockAtMs <= nowMs) {
      // Lockout period has expired on server
      return {
        attemptId,
        failedCount: 0,
        isLocked: false,
        lockedUntilMs: null,
        remainingMs: 0,
      };
    }

    return {
      attemptId,
      failedCount,
      isLocked: false,
      lockedUntilMs: null,
      remainingMs: 0,
    };
  } catch {
    return {
      attemptId,
      failedCount: 0,
      isLocked: false,
      lockedUntilMs: null,
      remainingMs: 0,
    };
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
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: attemptId,
        failedCount: 1,
        lastAttemptAt: serverTimestamp(),
      });
    } else {
      const data = snap.data() as { failedCount?: number; lastAttemptAt?: unknown };
      const currentCount = typeof data.failedCount === 'number' ? data.failedCount : 0;
      const lastAttemptMs = parseTimestampMs(data.lastAttemptAt);
      const expired = lastAttemptMs + ADMIN_LOCKOUT_DURATION_MS <= Date.now();

      if (currentCount >= ADMIN_LOCKOUT_MAX_ATTEMPTS && !expired) {
        return getAdminAttemptStatusById(attemptId);
      }

      const nextCount =
        currentCount >= ADMIN_LOCKOUT_MAX_ATTEMPTS && expired
          ? 1
          : Math.min(ADMIN_LOCKOUT_MAX_ATTEMPTS, currentCount + 1);

      await updateDoc(ref, {
        failedCount: nextCount,
        lastAttemptAt: serverTimestamp(),
      });
    }
    return getAdminAttemptStatusById(attemptId);
  } catch {
    // Fallback status if Firestore rules blocked increment (e.g. already locked on server)
    return getAdminAttemptStatusById(attemptId);
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
    await deleteDoc(doc(db, 'adminLoginAttempts', attemptId));
  } catch {
    // Non-fatal if doc doesn't exist or already cleared
  }
}
