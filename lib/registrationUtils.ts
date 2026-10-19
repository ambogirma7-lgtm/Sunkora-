export interface RegistrationRecordPure {
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

/**
 * Normalizes phone numbers to a canonical Ethiopian 10-digit format (09... or 07...)
 * or clean digits for international numbers.
 * Examples:
 *   "+251911223344" -> "0911223344"
 *   "251911223344"  -> "0911223344"
 *   "0911 22 33 44" -> "0911223344"
 *   "911223344"     -> "0911223344"
 *   "+251711223344" -> "0711223344"
 *   "0711223344"    -> "0711223344"
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return '';

  if (digits.startsWith('251') && digits.length >= 12) {
    return '0' + digits.slice(3);
  }
  if ((digits.startsWith('9') || digits.startsWith('7')) && digits.length === 9) {
    return '0' + digits;
  }
  return digits;
}

/**
 * Normalizes full name by collapsing multiple whitespace, trimming, and lowercasing.
 */
export function normalizeFullName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface DuplicateCheckMatch {
  isDuplicate: boolean;
  field?: 'PHONE' | 'NAME' | 'BOTH';
  existingRecord?: RegistrationRecordPure;
  message?: string;
}

/**
 * Finds if a phone number already exists in registered records.
 */
export function findDuplicatePhone(
  records: RegistrationRecordPure[],
  phoneNumber: string,
  excludeId?: string
): DuplicateCheckMatch {
  const normTarget = normalizePhoneNumber(phoneNumber);
  if (!normTarget || normTarget.length < 8) return { isDuplicate: false };

  for (const r of records) {
    if (excludeId && r.id === excludeId) continue;
    const rPhone = normalizePhoneNumber(r.phoneNumber || '');
    if (rPhone && rPhone === normTarget) {
      return {
        isDuplicate: true,
        field: 'PHONE',
        existingRecord: r,
        message: `ይህ ስልክ ቁጥር (${r.phoneNumber}) ቀደም ሲል በ "${r.fullName}" ስም ተመዝግቧል።`,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Finds if a full name already exists in registered records.
 */
export function findDuplicateName(
  records: RegistrationRecordPure[],
  fullName: string,
  excludeId?: string
): DuplicateCheckMatch {
  const normTarget = normalizeFullName(fullName);
  if (!normTarget || normTarget.length < 3) return { isDuplicate: false };

  for (const r of records) {
    if (excludeId && r.id === excludeId) continue;
    const rName = normalizeFullName(r.fullName || '');
    if (rName && rName === normTarget) {
      return {
        isDuplicate: true,
        field: 'NAME',
        existingRecord: r,
        message: `ይህ ሙሉ ስም ("${r.fullName}") ቀደም ሲል በስልክ ቁጥር ${r.phoneNumber} ተመዝግቧል።`,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Checks both phone number and full name for duplicate registration.
 */
export function findDuplicateRegistration(
  records: RegistrationRecordPure[],
  fullName: string,
  phoneNumber: string,
  excludeId?: string
): DuplicateCheckMatch {
  const phoneMatch = findDuplicatePhone(records, phoneNumber, excludeId);
  const nameMatch = findDuplicateName(records, fullName, excludeId);

  if (phoneMatch.isDuplicate && nameMatch.isDuplicate) {
    return {
      isDuplicate: true,
      field: 'BOTH',
      existingRecord: phoneMatch.existingRecord || nameMatch.existingRecord,
      message: `ይህ ሙሉ ስም (${nameMatch.existingRecord?.fullName}) እና ስልክ ቁጥር (${phoneMatch.existingRecord?.phoneNumber}) ቀደም ሲል ተመዝግቧል።`,
    };
  }

  if (phoneMatch.isDuplicate) {
    return phoneMatch;
  }

  if (nameMatch.isDuplicate) {
    return nameMatch;
  }

  return { isDuplicate: false };
}

export function deduplicateRecipients(
  records: RegistrationRecordPure[]
): Map<string, string> {
  const recipientMap = new Map<string, string>();
  for (const r of records) {
    if (r.isProxyRegistration && r.registeredByTelegramId) {
      recipientMap.set(
        String(r.registeredByTelegramId),
        r.registeredByName || r.fullName
      );
    } else if (r.telegramUserId) {
      recipientMap.set(String(r.telegramUserId), r.fullName);
    }
  }
  return recipientMap;
}

export function generateCSV(records: RegistrationRecordPure[]): string {
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
