import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import type { JournalEntry } from '../types';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Standard Firebase config initialization
const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with custom database ID if available
export const db = firebaseConfigJson.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

// Zero-crash Payload Hygiene: Strips all undefined values
export function sanitizePayload<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => (value === undefined ? null : value))
  );
}

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
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

// Authentication Helpers
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn('Popup sign in failed, trying redirect mode fallback:', error);
    // If popup was blocked by browser iframe, attempt redirect
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user') {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        console.error('Redirect sign in failed:', redirectError);
        throw redirectError;
      }
    }
    throw error;
  }
}

export async function logOut(): Promise<void> {
  await fbSignOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Firestore User-Isolated Collection Helpers
// Path: /users/{userId}/entries/{entryId}
export function getUserEntriesRef(userId: string) {
  return collection(db, 'users', userId, 'entries');
}

export function getUserEntryDocRef(userId: string, entryId: string) {
  return doc(db, 'users', userId, 'entries', entryId);
}

// Save or Update Journal Entry
export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  if (!entry.userId) {
    throw new Error('Cannot save journal entry without authenticated userId.');
  }
  const cleanData = sanitizePayload(entry);
  const path = `users/${entry.userId}/entries/${entry.id}`;
  try {
    const docRef = getUserEntryDocRef(entry.userId, entry.id);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Delete Journal Entry
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) return;
  const path = `users/${userId}/entries/${entryId}`;
  try {
    const docRef = getUserEntryDocRef(userId, entryId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Fetch recent entries for Cross-Entry Pattern Analysis (isolated strictly to current user)
export async function fetchRecentUserEntries(userId: string, count: number = 20): Promise<JournalEntry[]> {
  if (!userId) return [];
  const path = `users/${userId}/entries`;
  try {
    const colRef = getUserEntriesRef(userId);
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    const entries: JournalEntry[] = [];
    snapshot.forEach((docSnap) => {
      entries.push(docSnap.data() as JournalEntry);
    });
    return entries;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// Subscribe to real-time updates of user entries (strictly isolated to current user)
export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
) {
  const path = `users/${userId}/entries`;
  const colRef = getUserEntriesRef(userId);
  const q = query(colRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as JournalEntry);
      });
      onUpdate(entries);
    },
    (err) => {
      console.error('Error fetching user entries from Firestore:', err);
      if (onError) {
        onError(err);
      }
    }
  );
}


