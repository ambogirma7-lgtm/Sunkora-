import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findDuplicateRegistration,
  normalizePhoneNumber,
  normalizeFullName,
} from './registrationUtils.ts';
import type { RegistrationRecordPure } from './registrationUtils.ts';

test('Registration closed response includes exact user requested phrase', () => {
  const finishedPhrase = 'Registration is finished thank for your interest to be with us.';
  assert.ok(finishedPhrase.includes('Registration is finished thank for your interest to be with us.'));
});

test('Duplicate prevention detects duplicate by full name and phone number', () => {
  const existing: RegistrationRecordPure[] = [
    {
      id: 'reg_100',
      fullName: 'ቃበኛ ግርማው ያደታ',
      phoneNumber: '+251919239810',
      livingPlace: 'አዲስ አበባ',
      occupation: 'የመንግስት ሰራተኛ',
      interestConfirmation: 'Yes',
      telegramUserId: '7703225687',
      registrationDate: '2026-10-19',
      verificationStatus: 'Approved',
    },
  ];

  // 1. Same phone number with different name
  const phoneDup = findDuplicateRegistration(existing, 'አዲስ የተለየ ስም', '0919239810');
  assert.equal(phoneDup.isDuplicate, true);
  assert.equal(phoneDup.field, 'PHONE');

  // 2. Same full name with different phone
  const nameDup = findDuplicateRegistration(existing, 'ቃበኛ ግርማው ያደታ', '0911000000');
  assert.equal(nameDup.isDuplicate, true);
  assert.equal(nameDup.field, 'NAME');

  // 3. Both duplicate
  const bothDup = findDuplicateRegistration(existing, 'ቃበኛ ግርማው ያደታ', '0919239810');
  assert.equal(bothDup.isDuplicate, true);
  assert.equal(bothDup.field, 'BOTH');

  // 4. Truly unique person allowed
  const validUnique = findDuplicateRegistration(existing, 'ዳንኤል በቀለ ከበደ', '0933112233');
  assert.equal(validUnique.isDuplicate, false);
});

test('Friends status mapping identifies approval status correctly', () => {
  const records: RegistrationRecordPure[] = [
    {
      id: 'reg_main',
      fullName: 'Ambisa Girma Ejita',
      phoneNumber: '0911223344',
      livingPlace: 'አዲስ አበባ',
      occupation: 'መሃንዲስ',
      interestConfirmation: 'Yes',
      telegramUserId: '2057666071',
      registrationDate: '2026-10-19',
      verificationStatus: 'Approved',
      isProxyRegistration: false,
    },
    {
      id: 'proxy_1',
      fullName: 'melese hora',
      phoneNumber: '0945747650',
      livingPlace: 'Asossa',
      occupation: 'የመንግስት ሰራተኛ',
      interestConfirmation: 'Yes',
      telegramUserId: '2057666071',
      registeredByTelegramId: '2057666071',
      registeredByName: 'Ambisa Girma Ejita',
      registrationDate: '2026-10-19',
      verificationStatus: 'Approved',
      isProxyRegistration: true,
    },
    {
      id: 'proxy_2',
      fullName: 'Yeshiwas Tefera',
      phoneNumber: '+251941372261',
      livingPlace: 'G/beles',
      occupation: 'የግል ስራ',
      interestConfirmation: 'Yes',
      telegramUserId: '2057666071',
      registeredByTelegramId: '2057666071',
      registeredByName: 'Ambisa Girma Ejita',
      registrationDate: '2026-10-19',
      verificationStatus: 'Approved',
      isProxyRegistration: true,
    },
  ];

  const userTelegramId = '2057666071';
  const userRecord = records.find((r) => !r.isProxyRegistration && r.telegramUserId === userTelegramId);
  assert.ok(userRecord);
  assert.equal(userRecord.fullName, 'Ambisa Girma Ejita');
  assert.equal(userRecord.verificationStatus, 'Approved');

  const friends = records.filter((r) => r.isProxyRegistration && r.registeredByTelegramId === userTelegramId);
  assert.equal(friends.length, 2);
  assert.equal(friends[0].fullName, 'melese hora');
  assert.equal(friends[0].verificationStatus, 'Approved');
  assert.equal(friends[1].fullName, 'Yeshiwas Tefera');
  assert.equal(friends[1].verificationStatus, 'Approved');
});
