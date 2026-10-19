import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';

export interface RegistrationRecord {
  id: string;
  fullName: string;
  phoneNumber: string;
  livingPlace: string;
  occupation: string;
  interestConfirmation: 'Yes' | 'No';
  telegramUserId: string;
  telegramUsername?: string;
  isProxyRegistration?: boolean;
  registeredByTelegramId?: string;
  registeredByTelegramUsername?: string;
  registeredByName?: string;
  registrationDate: string;
  verificationStatus: 'Pending Approval' | 'Approved' | 'Rejected' | 'Pending';
  approvedBy?: string;
  reviewedAt?: string;
  idType?: string;
  idNumber?: string;
  registrationNumber?: string;
  updatedAt?: string;
}

export interface BotSession {
  userId: string;
  username?: string;
  step:
    | 'IDLE'
    | 'ASK_CONFIRM_INTEREST'
    | 'ASK_FULL_NAME'
    | 'ASK_PHONE'
    | 'ASK_LIVING_PLACE'
    | 'ASK_OCCUPATION'
    | 'CONFIRMATION'
    | 'ASK_HAS_INTERESTED_FRIEND'
    | 'ASK_FRIEND_NAME'
    | 'ASK_FRIEND_PHONE'
    | 'ASK_FRIEND_LIVING_PLACE'
    | 'ASK_FRIEND_OCCUPATION'
    | 'CONFIRM_FRIEND';
  draft: Partial<RegistrationRecord>;
  friendDraft?: Partial<RegistrationRecord>;
  updatedAt: number;
}

// In-memory fast cache to minimize latency, with Firestore persistent backup
const memorySessions = new Map<string, BotSession>();

export async function getSession(userId: string, username?: string): Promise<BotSession> {
  const cached = memorySessions.get(userId);
  if (cached) {
    if (username) cached.username = username;
    return cached;
  }

  try {
    const sessionDoc = await getDoc(doc(db, 'bot_sessions', userId));
    if (sessionDoc.exists()) {
      const data = sessionDoc.data() as BotSession;
      if (username) data.username = username;
      memorySessions.set(userId, data);
      return data;
    }
  } catch (err) {
    console.warn('Error reading session from firestore:', err);
  }

  const newSession: BotSession = {
    userId,
    username,
    step: 'IDLE',
    draft: {},
    updatedAt: Date.now(),
  };
  memorySessions.set(userId, newSession);
  return newSession;
}

export async function saveSession(session: BotSession): Promise<void> {
  session.updatedAt = Date.now();
  memorySessions.set(session.userId, session);

  try {
    await setDoc(doc(db, 'bot_sessions', session.userId), {
      userId: session.userId,
      username: session.username || '',
      step: session.step,
      draft: session.draft || {},
      friendDraft: session.friendDraft || {},
      updatedAt: session.updatedAt,
    });
  } catch (err) {
    console.warn('Error saving session to firestore:', err);
  }
}

export async function clearSession(userId: string): Promise<void> {
  memorySessions.delete(userId);
  try {
    await deleteDoc(doc(db, 'bot_sessions', userId));
  } catch (err) {
    console.warn('Error deleting session from firestore:', err);
  }
}

export async function getRegistrationById(id: string): Promise<RegistrationRecord | null> {
  try {
    const docSnap = await getDoc(doc(db, 'registrations', id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...(docSnap.data() as any) } as RegistrationRecord;
    }
  } catch (err) {
    console.error('Error fetching registration by ID:', err);
  }
  return null;
}

export async function getRegistrationByTelegramId(telegramUserId: string): Promise<RegistrationRecord | null> {
  try {
    const q = query(
      collection(db, 'registrations'),
      where('telegramUserId', '==', String(telegramUserId)),
      where('isProxyRegistration', '==', false),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...(docSnap.data() as any) } as RegistrationRecord;
    }
  } catch (err) {
    console.error('Error fetching registration by telegram ID:', err);
  }
  return null;
}

export async function getRegistrationByPhone(phone: string): Promise<RegistrationRecord | null> {
  try {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const q = query(
      collection(db, 'registrations'),
      where('phoneNumber', '==', cleanPhone),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...(docSnap.data() as any) } as RegistrationRecord;
    }
  } catch (err) {
    console.error('Error fetching registration by phone:', err);
  }
  return null;
}

export async function saveRegistration(
  record: Omit<RegistrationRecord, 'id' | 'registrationDate' | 'verificationStatus'> & {
    registrationDate?: string;
    verificationStatus?: 'Pending Approval' | 'Approved' | 'Rejected';
  }
): Promise<RegistrationRecord> {
  const now = new Date().toISOString();
  const isProxy = Boolean(record.isProxyRegistration);

  // If proxy, create a unique doc ID; if self, use user telegram ID
  const docId = isProxy
    ? `proxy_${record.registeredByTelegramId || record.telegramUserId}_${Date.now()}`
    : `reg_${record.telegramUserId}`;

  const existing = isProxy ? null : await getRegistrationByTelegramId(record.telegramUserId);

  const finalRecord: RegistrationRecord = {
    id: docId,
    fullName: record.fullName.trim(),
    phoneNumber: record.phoneNumber.trim(),
    livingPlace: record.livingPlace.trim(),
    occupation: record.occupation.trim(),
    interestConfirmation: 'Yes',
    telegramUserId: String(record.telegramUserId || ''),
    telegramUsername: record.telegramUsername ? `@${record.telegramUsername.replace(/^@/, '')}` : '',
    isProxyRegistration: isProxy,
    registeredByTelegramId: record.registeredByTelegramId || '',
    registeredByTelegramUsername: record.registeredByTelegramUsername || '',
    registeredByName: record.registeredByName || '',
    registrationDate: existing?.registrationDate || now,
    verificationStatus: record.verificationStatus || existing?.verificationStatus || 'Pending Approval',
    updatedAt: now,
  };

  await setDoc(doc(db, 'registrations', docId), finalRecord);
  return finalRecord;
}

export async function updateRegistrationStatus(
  id: string,
  status: 'Pending Approval' | 'Approved' | 'Rejected',
  approvedBy?: string
): Promise<RegistrationRecord | null> {
  try {
    const ref = doc(db, 'registrations', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data();
    const updated = {
      ...data,
      verificationStatus: status,
      approvedBy: approvedBy || 'Admin',
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(ref, updated);
    return { id, ...(updated as any) } as RegistrationRecord;
  } catch (err) {
    console.error('Error updating registration status:', err);
    return null;
  }
}

export async function deleteRegistration(telegramUserId: string): Promise<boolean> {
  try {
    const existing = await getRegistrationByTelegramId(telegramUserId);
    if (existing) {
      await deleteDoc(doc(db, 'registrations', existing.id));
      return true;
    }
  } catch (err) {
    console.error('Error deleting registration:', err);
  }
  return false;
}

export async function deleteRegistrationById(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'registrations', id));
    return true;
  } catch (err) {
    console.error('Error deleting registration by ID:', err);
    return false;
  }
}

export async function getAllRegistrations(): Promise<RegistrationRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'registrations'));
    const list: RegistrationRecord[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as any) });
    });
    return list.sort((a, b) => (b.registrationDate || '').localeCompare(a.registrationDate || ''));
  } catch (err) {
    console.error('Error fetching all registrations:', err);
    return [];
  }
}

export async function searchRegistrations(queryText: string): Promise<RegistrationRecord[]> {
  const all = await getAllRegistrations();
  const q = queryText.toLowerCase().trim();
  if (!q) return all;

  return all.filter(
    (r) =>
      (r.fullName && r.fullName.toLowerCase().includes(q)) ||
      (r.phoneNumber && r.phoneNumber.includes(q)) ||
      (r.livingPlace && r.livingPlace.toLowerCase().includes(q)) ||
      (r.occupation && r.occupation.toLowerCase().includes(q)) ||
      (r.telegramUsername && r.telegramUsername.toLowerCase().includes(q)) ||
      (r.registeredByName && r.registeredByName.toLowerCase().includes(q)) ||
      (r.verificationStatus && r.verificationStatus.toLowerCase().includes(q))
  );
}

export interface NotificationLog {
  id: string;
  message: string;
  target: 'APPROVED' | 'ALL';
  sentCount: number;
  failedCount: number;
  totalTargeted: number;
  sentAt: string;
  sentBy?: string;
}

export async function saveNotificationLog(log: Omit<NotificationLog, 'id' | 'sentAt'>): Promise<NotificationLog> {
  const docId = `notif_${Date.now()}`;
  const now = new Date().toISOString();
  const entry: NotificationLog = {
    id: docId,
    ...log,
    sentAt: now,
  };

  try {
    await setDoc(doc(db, 'notifications', docId), entry);
  } catch (err) {
    console.warn('Could not save notification log:', err);
  }
  return entry;
}

export async function getNotificationLogs(): Promise<NotificationLog[]> {
  try {
    const snap = await getDocs(collection(db, 'notifications'));
    const list: NotificationLog[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as any) });
    });
    return list.sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''));
  } catch (err) {
    console.warn('Could not fetch notification logs:', err);
    return [];
  }
}

export function generateCSV(records: RegistrationRecord[]): string {
  const headers = [
    'Full Name',
    'Phone Number',
    'Current Living Place',
    'Occupation',
    'Interest Confirmation',
    'Registration Type',
    'Registered By (Telegram ID / Name)',
    'Telegram Username',
    'Registration Date',
    'Approval Status',
  ];

  const rows = records.map((r) => [
    `"${(r.fullName || '').replace(/"/g, '""')}"`,
    `"${(r.phoneNumber || '').replace(/"/g, '""')}"`,
    `"${(r.livingPlace || '').replace(/"/g, '""')}"`,
    `"${(r.occupation || '').replace(/"/g, '""')}"`,
    `"${r.interestConfirmation || 'Yes'}"`,
    `"${r.isProxyRegistration ? 'On Behalf of Friend (No Telegram)' : 'Direct (Self)'}"`,
    `"${r.isProxyRegistration ? `${r.registeredByName || ''} (ID: ${r.registeredByTelegramId || ''})` : r.telegramUserId || ''}"`,
    `"${r.telegramUsername || ''}"`,
    `"${r.registrationDate || ''}"`,
    `"${r.verificationStatus || 'Pending Approval'}"`,
  ]);

  // Prepend UTF-8 BOM so Excel & Sheets open Amharic without "?????"
  return '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

