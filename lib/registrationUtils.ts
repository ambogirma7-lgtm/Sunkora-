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
