import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCSV,
  deduplicateRecipients,
  normalizePhoneNumber,
  normalizeFullName,
  findDuplicatePhone,
  findDuplicateName,
  findDuplicateRegistration,
} from './registrationUtils.ts';
import type { RegistrationRecordPure } from './registrationUtils.ts';

test('normalizePhoneNumber handles various Ethiopian mobile formats', () => {
  assert.equal(normalizePhoneNumber('+251911223344'), '0911223344');
  assert.equal(normalizePhoneNumber('251911223344'), '0911223344');
  assert.equal(normalizePhoneNumber('0911223344'), '0911223344');
  assert.equal(normalizePhoneNumber('911223344'), '0911223344');
  assert.equal(normalizePhoneNumber('0911 22 33 44'), '0911223344');
  assert.equal(normalizePhoneNumber('+251 911 22 33 44'), '0911223344');
  assert.equal(normalizePhoneNumber('(0911) 22-33-44'), '0911223344');
  assert.equal(normalizePhoneNumber('+251711223344'), '0711223344');
  assert.equal(normalizePhoneNumber('0711223344'), '0711223344');
  assert.equal(normalizePhoneNumber('711223344'), '0711223344');
});

test('normalizeFullName collapses spaces and trims', () => {
  assert.equal(normalizeFullName('  አምቢሳ   ግርማ    አጅታ  '), 'አምቢሳ ግርማ አጅታ');
  assert.equal(normalizeFullName('Teshal  Girma  Ejita'), 'teshal girma ejita');
});

test('findDuplicatePhone detects duplicate regardless of format', () => {
  const existingRecords: RegistrationRecordPure[] = [
    {
      id: 'reg_1',
      fullName: 'አምቢሳ ግርማ አጅታ',
      phoneNumber: '+251911223344',
      livingPlace: 'ሳንኮራ',
      occupation: 'የባንክ ሠራተኛ',
      interestConfirmation: 'Yes',
      telegramUserId: '1001',
      registrationDate: '2026-10-18',
      verificationStatus: 'Approved',
    },
  ];

  // Should detect duplicate when entering 0911223344 vs +251911223344
  const dupCheck1 = findDuplicatePhone(existingRecords, '0911223344');
  assert.equal(dupCheck1.isDuplicate, true);
  assert.equal(dupCheck1.field, 'PHONE');
  assert.equal(dupCheck1.existingRecord?.fullName, 'አምቢሳ ግርማ አጅታ');

  // Should NOT flag when updating own record (matching excludeId)
  const dupCheckSelf = findDuplicatePhone(existingRecords, '0911223344', 'reg_1');
  assert.equal(dupCheckSelf.isDuplicate, false);

  // Different phone should be allowed
  const diffPhoneCheck = findDuplicatePhone(existingRecords, '0922334455');
  assert.equal(diffPhoneCheck.isDuplicate, false);
});

test('findDuplicateName detects duplicate full names', () => {
  const existingRecords: RegistrationRecordPure[] = [
    {
      id: 'reg_1',
      fullName: 'አምቢሳ ግርማ አጅታ',
      phoneNumber: '0911223344',
      livingPlace: 'ሳንኮራ',
      occupation: 'የባንክ ሠራተኛ',
      interestConfirmation: 'Yes',
      telegramUserId: '1001',
      registrationDate: '2026-10-18',
      verificationStatus: 'Approved',
    },
  ];

  // Extra spaces in input
  const nameCheck = findDuplicateName(existingRecords, 'አምቢሳ   ግርማ  አጅታ');
  assert.equal(nameCheck.isDuplicate, true);
  assert.equal(nameCheck.field, 'NAME');

  // Unrelated name
  const diffNameCheck = findDuplicateName(existingRecords, 'በቀለ ታደሰ አያና');
  assert.equal(diffNameCheck.isDuplicate, false);
});

test('findDuplicateRegistration checks both name and phone', () => {
  const existingRecords: RegistrationRecordPure[] = [
    {
      id: 'reg_1',
      fullName: 'አምቢሳ ግርማ አጅታ',
      phoneNumber: '+251911223344',
      livingPlace: 'ሳንኮራ',
      occupation: 'የባንክ ሠራተኛ',
      interestConfirmation: 'Yes',
      telegramUserId: '1001',
      registrationDate: '2026-10-18',
      verificationStatus: 'Approved',
    },
  ];

  // Both match
  const checkBoth = findDuplicateRegistration(existingRecords, 'አምቢሳ ግርማ አጅታ', '0911223344');
  assert.equal(checkBoth.isDuplicate, true);
  assert.equal(checkBoth.field, 'BOTH');

  // Phone match only
  const checkPhoneOnly = findDuplicateRegistration(existingRecords, 'ሌላ ሰው ስም', '0911223344');
  assert.equal(checkPhoneOnly.isDuplicate, true);
  assert.equal(checkPhoneOnly.field, 'PHONE');

  // Name match only
  const checkNameOnly = findDuplicateRegistration(existingRecords, 'አምቢሳ ግርማ አጅታ', '0988776655');
  assert.equal(checkNameOnly.isDuplicate, true);
  assert.equal(checkNameOnly.field, 'NAME');

  // Completely new person
  const checkNew = findDuplicateRegistration(existingRecords, 'አዲስ አባል ሙሉ ስም', '0955443322');
  assert.equal(checkNew.isDuplicate, false);
});

test('generateCSV preserves Amharic Unicode and prepends UTF-8 BOM', () => {
  const sampleRecords: RegistrationRecordPure[] = [
    {
      id: 'reg_1',
      fullName: 'አምቢሳ ግርማ አጅታ',
      phoneNumber: '+251911223344',
      livingPlace: 'ደቡብ ምዕራብ ሸዋ፣ ሶዶ ዳቺ',
      occupation: 'የባንክ ሠራተኛ',
      interestConfirmation: 'Yes',
      telegramUserId: '7703225687',
      telegramUsername: '@Natananor',
      isProxyRegistration: false,
      registrationDate: '2026-10-18T20:00:00.000Z',
      verificationStatus: 'Approved',
    },
  ];

  const csv = generateCSV(sampleRecords);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(csv.includes('አምቢሳ ግርማ አጅታ'));
  assert.ok(!csv.includes('???'));
});

test('deduplicateRecipients groups proxy and direct registrations correctly', () => {
  const records: RegistrationRecordPure[] = [
    {
      id: '1',
      fullName: 'አምቢሳ ግርማ',
      phoneNumber: '0911223344',
      livingPlace: 'ሳንኮራ',
      occupation: 'መምህር',
      interestConfirmation: 'Yes',
      telegramUserId: '1001',
      registrationDate: '2026-10-18',
      verificationStatus: 'Approved',
      isProxyRegistration: false,
    },
    {
      id: '2',
      fullName: 'ጓደኛ 1',
      phoneNumber: '0922334455',
      livingPlace: 'ሳንኮራ',
      occupation: 'ገበሬ',
      interestConfirmation: 'Yes',
      telegramUserId: '1001',
      registeredByTelegramId: '1001',
      registeredByName: 'አምቢሳ ግርማ',
      registrationDate: '2026-10-18',
      verificationStatus: 'Approved',
      isProxyRegistration: true,
    },
  ];

  const recipientMap = deduplicateRecipients(records);
  assert.equal(recipientMap.size, 1);
  assert.ok(recipientMap.has('1001'));
});
