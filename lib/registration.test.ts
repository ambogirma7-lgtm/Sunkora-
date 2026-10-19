import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCSV, deduplicateRecipients } from './registrationUtils.ts';
import type { RegistrationRecordPure } from './registrationUtils.ts';

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
    {
      id: 'reg_2',
      fullName: 'ጫላ ታደሰ በቀለ',
      phoneNumber: '0922334455',
      livingPlace: 'ሳንኮራ ከተማ፣ ቀበሌ 01',
      occupation: 'ነጋዴ',
      interestConfirmation: 'Yes',
      telegramUserId: '7703225687',
      telegramUsername: '@Natananor',
      isProxyRegistration: true,
      registeredByName: 'አምቢሳ ግርማ አጅታ',
      registeredByTelegramId: '7703225687',
      registrationDate: '2026-10-18T21:00:00.000Z',
      verificationStatus: 'Pending Approval',
    },
  ];

  const csv = generateCSV(sampleRecords);

  // Must begin with UTF-8 BOM \uFEFF for Excel & Google Sheets
  assert.equal(csv.charCodeAt(0), 0xFEFF);

  // Must contain intact Ethiopic characters without '?' or replacement
  assert.ok(csv.includes('አምቢሳ ግርማ አጅታ'), 'Full name in Amharic must be present');
  assert.ok(csv.includes('ደቡብ ምዕራብ ሸዋ፣ ሶዶ ዳቺ'), 'Living place in Amharic must be present');
  assert.ok(csv.includes('የባንክ ሠራተኛ'), 'Occupation in Amharic must be present');
  assert.ok(csv.includes('ጫላ ታደሰ በቀለ'), 'Proxy member name must be present');
  assert.ok(!csv.includes('???'), 'No question mark placeholders allowed in generated CSV');
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
    {
      id: '3',
      fullName: 'ጓደኛ 2',
      phoneNumber: '0933445566',
      livingPlace: 'ሳንኮራ',
      occupation: 'ነጋዴ',
      interestConfirmation: 'Yes',
      telegramUserId: '1001',
      registeredByTelegramId: '1001',
      registeredByName: 'አምቢሳ ግርማ',
      registrationDate: '2026-10-18',
      verificationStatus: 'Approved',
      isProxyRegistration: true,
    },
    {
      id: '4',
      fullName: 'ሌላ አባል',
      phoneNumber: '0944556677',
      livingPlace: 'ሳንኮራ',
      occupation: 'የመንግስት ሰራተኛ',
      interestConfirmation: 'Yes',
      telegramUserId: '2002',
      registrationDate: '2026-10-18',
      verificationStatus: 'Approved',
      isProxyRegistration: false,
    },
  ];

  const recipientMap = deduplicateRecipients(records);

  // Telegram ID 1001 registered themselves and 2 friends, but should only receive 1 notification
  assert.equal(recipientMap.size, 2);
  assert.ok(recipientMap.has('1001'));
  assert.ok(recipientMap.has('2002'));
});

test('No registration ID is assigned or required in member records', () => {
  const newMember: Partial<RegistrationRecordPure> = {
    fullName: 'አምቢሳ ግርማ',
    phoneNumber: '0911223344',
    livingPlace: 'ሳንኮራ',
    occupation: 'ነጋዴ',
  };

  assert.equal(newMember.registrationNumber, undefined);
  assert.equal(newMember.idNumber, undefined);
  assert.equal(newMember.idType, undefined);
});
