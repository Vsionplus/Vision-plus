import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, initializeFirestore } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { Locale } from '../types';

const app = initializeApp(firebaseConfig);
export const db = (() => {
  try {
    return initializeFirestore(
      app,
      { experimentalAutoDetectLongPolling: true },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
})();
export const auth = getAuth(app);
export const storage = getStorage(app);

export async function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  });
}

async function uploadToStorageWithTimeout(
  storagePath: string,
  blob: Blob,
  contentType: string,
  onProgress?: (pct: number) => void,
  timeoutMs = 5500
): Promise<string> {
  const storageRef = ref(storage, storagePath);
  const uploadPromise = new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob, { contentType });
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
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Upload timeout')), timeoutMs);
  });

  return Promise.race([uploadPromise, timeoutPromise]);
}

export async function uploadPrescriptionImage(
  uid: string,
  blob: Blob,
  fileName: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string }> {
  onProgress?.(20);
  const dataUrl = await readFileAsDataUrl(blob);

  if (uid && uid !== 'guest_pending' && auth.currentUser) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'prescription.jpg';
    const storagePath = `prescriptions/${uid}/${Date.now()}_${safeName.replace(/\.[^.]+$/, '')}.jpg`;
    try {
      const url = await uploadToStorageWithTimeout(storagePath, blob, 'image/jpeg', onProgress);
      return { url, path: storagePath };
    } catch {
      // Fallback to compressed JPEG dataUrl so uploads always succeed even if Storage CORS/bucket isn't configured
    }
  }

  onProgress?.(100);
  return { url: dataUrl, path: '' };
}

export async function uploadPrescriptionDocument(
  uid: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ url: string; path: string; fileName: string; fileType: 'image' | 'pdf' }> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    onProgress?.(35);
    const dataUrl = await readFileAsDataUrl(file);
    onProgress?.(100);
    return {
      url: dataUrl,
      path: '',
      fileName: file.name,
      fileType: 'pdf',
    };
  }

  onProgress?.(15);
  const { blob, dataUrl } = await compressPrescriptionImageToUpload(file);
  if (uid && uid !== 'guest_pending' && auth.currentUser) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'prescription.jpg';
    const storagePath = `prescriptions/${uid}/${Date.now()}_${safeName.replace(/\.[^.]+$/, '')}.jpg`;
    try {
      const url = await uploadToStorageWithTimeout(storagePath, blob, 'image/jpeg', onProgress);
      return { url, path: storagePath, fileName: file.name, fileType: 'image' };
    } catch {
      // Seamless fallback to compressed dataUrl
    }
  }
  onProgress?.(100);
  return { url: dataUrl, path: '', fileName: file.name, fileType: 'image' };
}

async function compressPrescriptionImageToUpload(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  const { blob, dataUrl } = await compressImageFileToBlob(file, 1000, 0.76);
  return { blob, dataUrl };
}

export async function deletePrescriptionImage(storagePath?: string): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // Ignore if already deleted or permission unavailable
  }
}

export async function compressImageFileToBlob(
  file: File,
  maxDim = 1200,
  quality = 0.84
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            resolve({ blob: blob || file, dataUrl: compressedUrl });
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve({ blob: file, dataUrl });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadAdminImage(
  folder: 'products' | 'banners' | 'branding' | 'categories',
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const { blob, dataUrl } = await compressImageFileToBlob(
    file,
    folder === 'banners' ? 1400 : 1000,
    0.82
  );
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'image.jpg';
  const storagePath = `${folder}/${Date.now()}_${safeName.replace(/\.[^.]+$/, '')}.jpg`;
  const storageRef = ref(storage, storagePath);

  try {
    return await new Promise<string>((resolve, reject) => {
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
        (err) => reject(err),
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  } catch {
    onProgress?.(100);
    return dataUrl;
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

function isPlainObject(val: unknown): val is Record<string, unknown> {
  if (!val || typeof val !== 'object') return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

export function stripUndefined<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
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
    case 'auth/missing-email':
      return ar('يرجى إدخال البريد الإلكتروني أولاً.', 'Please enter your email address first.');
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
    case 'auth/admin-restricted-operation':
      return ar(
        'تم تقييد طريقة الدخول هذه في إعدادات المصادقة.',
        'This sign-in method is restricted in Firebase Authentication settings.'
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
