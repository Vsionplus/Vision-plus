import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { Locale } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

export async function uploadPrescriptionImage(
  uid: string,
  blob: Blob,
  fileName: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string }> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'prescription.jpg';
  const storagePath = `prescriptions/${uid}/${Date.now()}_${safeName.replace(/\.[^.]+$/, '')}.jpg`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
    });
    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, path: storagePath });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

export async function deletePrescriptionImage(storagePath?: string): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // Ignore if already deleted or permission unavailable
  }
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function stripUndefined<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (input && typeof input === 'object' && !(input instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return input;
}

export function getFirebaseAuthErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  return '';
}

export function mapFirebaseAuthError(error: unknown, locale: Locale = 'ar'): string {
  const code = getFirebaseAuthErrorCode(error);
  const ar = (a: string, e: string) => (locale === 'ar' ? a : e);

  switch (code) {
    case 'auth/invalid-email':
      return ar('صيغة البريد الإلكتروني غير صحيحة.', 'Invalid email address format.');
    case 'auth/user-disabled':
      return ar('تم تعطيل هذا الحساب. يرجى التواصل مع إدارة المتجر.', 'This account has been disabled.');
    case 'auth/user-not-found':
      return ar('لا يوجد حساب مسجل بهذا البريد الإلكتروني.', 'No account found with this email.');
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return ar(
        'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
        'Incorrect email or password.'
      );
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use':
      return ar(
        'هذا البريد الإلكتروني مسجل مسبقاً. يمكنك تسجيل الدخول مباشرة ولن تفقد سلتك.',
        'This email is already registered. Please sign in to keep your cart.'
      );
    case 'auth/weak-password':
      return ar(
        'كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل.',
        'Password must be at least 6 characters.'
      );
    case 'auth/too-many-requests':
      return ar(
        'تم إرسال طلبات كثيرة مؤقتاً. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.',
        'Too many attempts. Please wait a moment and try again.'
      );
    case 'auth/requires-recent-login':
      return ar(
        'لأسباب أمنية، يرجى إعادة إدخال كلمة المرور الحالية لتأكيد التغيير.',
        'Please enter your current password to confirm this sensitive action.'
      );
    case 'auth/operation-not-allowed':
      return ar(
        'يرجى تفعيل طريقة الدخول (Email/Password و Anonymous) من لوحة تحكم Firebase Authentication -> Sign-in method.',
        'Please enable Email/Password and Anonymous sign-in providers in Firebase Console -> Authentication -> Sign-in method.'
      );
    case 'auth/network-request-failed':
      return ar(
        'تعذر الاتصال بالشبكة. تحقق من اتصال الإنترنت وحاول مجدداً.',
        'Network error. Please check your internet connection.'
      );
    default:
      return ar(
        'حدث خطأ أثناء المصادقة. يرجى المحاولة مرة أخرى.',
        'Authentication error occurred. Please try again.'
      );
  }
}
