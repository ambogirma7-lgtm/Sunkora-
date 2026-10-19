import { Telegraf, Markup } from 'telegraf';
import {
  getSession,
  saveSession,
  clearSession,
  getRegistrationByTelegramId,
  getRegistrationById,
  saveRegistration,
  updateRegistrationStatus,
  deleteRegistrationById,
  getAllRegistrations,
  searchRegistrations,
  generateCSV,
  RegistrationRecord,
} from './registrationService';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.warn('TELEGRAM_BOT_TOKEN is not defined in environment variables.');
}

export const bot = new Telegraf(BOT_TOKEN || '');

// Authorized Administrator User ID
export const ADMIN_USER_ID = 7703225687;
export const ADMIN_USERNAME = 'Natananor';

export function isAdmin(fromId: number | string | undefined): boolean {
  if (!fromId) return false;
  return Number(fromId) === ADMIN_USER_ID;
}

// Function to notify admin when a new registration arrives
async function notifyAdminNewRegistration(record: RegistrationRecord) {
  try {
    const isProxy = Boolean(record.isProxyRegistration);
    const text =
      `🔔 <b>አዲስ የምዝገባ ጥያቄ ቀርቧል!</b>\n\n` +
      `👤 <b>ሙሉ ስም፦</b> ${record.fullName}\n` +
      `📱 <b>ስልክ ቁጥር፦</b> <code>${record.phoneNumber}</code>\n` +
      `📍 <b>የመኖሪያ ቦታ፦</b> ${record.livingPlace}\n` +
      `💼 <b>የስራ ዘርፍ / ሙያ፦</b> ${record.occupation}\n` +
      `📋 <b>የምዝገባ ዓይነት፦</b> ${isProxy ? 'በጓደኛ የተመዘገበ (ቴሌግራም የለውም)' : 'በራሱ (ቀጥታ)'}\n` +
      (isProxy ? `🤝 <b>የመዘገበው ሰው፦</b> ${record.registeredByName || ''} (ID: <code>${record.registeredByTelegramId || ''}</code>)\n` : `📱 <b>ቴሌግራም፦</b> ${record.telegramUsername || record.telegramUserId}\n`) +
      `📅 <b>ቀን፦</b> ${new Date().toLocaleDateString('am-ET')}\n\n` +
      `👉 <b>እባክዎ ይህን የምዝገባ ጥያቄ ያረጋግጡ ወይም ያስተዳድሩ፦</b>`;

    const inlineKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ አጽድቅ (Approve)', `approve_${record.id}`),
        Markup.button.callback('❌ ውድቅ አድርግ (Reject)', `reject_${record.id}`),
      ],
      [Markup.button.callback('🗑️ በቋሚነት ሰርዝ (Delete)', `del_${record.id}`)],
    ]);

    await bot.telegram.sendMessage(ADMIN_USER_ID, text, {
      parse_mode: 'HTML',
      ...inlineKeyboard,
    });
  } catch (err: any) {
    console.warn('Could not send registration alert to admin:', err.message);
  }
}

// Keyboards in natural, respectful Amharic
const interestKeyboard = Markup.keyboard([
  ['✅ አዎ፣ መሳተፍ እፈልጋለሁ'],
  ['❌ አይ፣ አልፈልግም'],
]).resize().oneTime();

const phoneKeyboard = Markup.keyboard([
  [Markup.button.contactRequest('📱 ስልክ ቁጥሬን አጋራ')],
  ['❌ ምዝገባውን አቋርጥ'],
]).resize().oneTime();

const confirmKeyboard = Markup.keyboard([
  ['✅ አረጋግጣለሁ፣ ላክ'],
  ['✏️ መረጃዬን ማስተካከል እፈልጋለሁ'],
  ['❌ ምዝገባውን አቋርጥ'],
]).resize().oneTime();

const friendConfirmKeyboard = Markup.keyboard([
  ['✅ አረጋግጣለሁ፣ ላክ'],
  ['✏️ መረጃውን ማስተካከል እፈልጋለሁ'],
  ['❌ ሰርዝ'],
]).resize().oneTime();

const askFriendKeyboard = Markup.keyboard([
  ['➕ አዎ፣ ሌላ ፍላጎት ያለው ሰው መመዝገብ እፈልጋለሁ'],
  ['✅ የለም፣ ምዝገባውን ጨርሻለሁ'],
]).resize().oneTime();

// Registered user keyboard: DOES NOT ALLOW DELETING (Keeps data safely in secure database)
const registeredUserKeyboard = Markup.keyboard([
  ['📋 የምዝገባ መረጃዬን አሳይ'],
  ['➕ ሌላ ፍላጎት ያለው ሰው መመዝገብ (ቴሌግራም የሌለው)'],
  ['✏️ መረጃዬን ማስተካከል'],
]).resize();

const removeKeyboard = Markup.removeKeyboard();

// Helper to format registered card
function formatRecordSummary(record: Partial<RegistrationRecord>, isFriend = false): string {
  const statusLabel =
    record.verificationStatus === 'Approved'
      ? '✅ የጸደቀ (Approved)'
      : record.verificationStatus === 'Rejected'
      ? '❌ ውድቅ የተደረገ (Rejected)'
      : '⏳ በአስተዳዳሪው ማረጋገጫ በመጠባበቅ ላይ (Pending Approval)';

  return (
    `📋 <b>${isFriend ? 'የጓደኛዎ/የዘመድዎ የምዝገባ መረጃ ማጠቃለያ' : 'የምዝገባ መረጃ ማጠቃለያ'}</b>\n\n` +
    `👤 <b>ሙሉ ስም፦</b> ${record.fullName || 'አልተሞላም'}\n` +
    `📱 <b>ስልክ ቁጥር፦</b> ${record.phoneNumber || 'አልተሞላም'}\n` +
    `📍 <b>የመኖሪያ ቦታ፦</b> ${record.livingPlace || 'አልተሞላም'}\n` +
    `💼 <b>የስራ ዘርፍ / ሙያ፦</b> ${record.occupation || 'አልተሞላም'}\n` +
    (isFriend && record.registeredByName ? `🤝 <b>የመዘገበው ሰው፦</b> ${record.registeredByName}\n` : '') +
    `🛡️ <b>የማረጋገጫ ሁኔታ፦</b> <b>${statusLabel}</b>\n`
  );
}

// ---------------------------------------------
// INLINE ACTION HANDLERS (ADMIN APPROVE / REJECT / DELETE)
// ---------------------------------------------

bot.action(/^approve_(.+)$/, async (ctx) => {
  const adminId = ctx.from?.id;
  if (!isAdmin(adminId)) {
    return ctx.answerCbQuery('ይህን እርምጃ ለመውሰድ ፈቃድ የለዎትም።', { show_alert: true });
  }

  const docId = ctx.match[1];
  const updated = await updateRegistrationStatus(docId, 'Approved', ctx.from?.username || 'Natananor');

  if (!updated) {
    return ctx.answerCbQuery('የምዝገባ መረጃውን ማግኘት አልተቻለም።', { show_alert: true });
  }

  await ctx.answerCbQuery('✅ ምዝገባው ጸድቋል!');

  try {
    const inline = Markup.inlineKeyboard([
      [Markup.button.callback('🗑️ በቋሚነት ሰርዝ (Delete)', `del_${updated.id}`)],
    ]);
    await ctx.editMessageText(
      `✅ <b>የምዝገባ ጥያቄው ጸድቋል! (Approved)</b>\n\n` +
        `👤 <b>ሙሉ ስም፦</b> ${updated.fullName}\n` +
        `📱 <b>ስልክ ቁጥር፦</b> <code>${updated.phoneNumber}</code>\n` +
        `📍 <b>የመኖሪያ ቦታ፦</b> ${updated.livingPlace}\n` +
        `💼 <b>የስራ ዘርፍ፦</b> ${updated.occupation}\n` +
        `🛡️ <b>ያጸደቀው አስተዳዳሪ፦</b> @${ctx.from?.username || 'Natananor'}\n` +
        `📅 <b>ቀን፦</b> ${new Date().toLocaleDateString('am-ET')}`,
      { parse_mode: 'HTML', ...inline }
    );
  } catch (err) {
    console.warn('Could not edit admin message:', err);
  }

  // Send approval notification to the member who registered
  try {
    const notifyId = updated.isProxyRegistration
      ? Number(updated.registeredByTelegramId)
      : Number(updated.telegramUserId);

    if (notifyId) {
      const msg = updated.isProxyRegistration
        ? `🎉 <b>እንኳን ደስ አለዎት!</b>\n\nእርስዎ ያስመዘገቡት የ <b>${updated.fullName}</b> የምዝገባ ጥያቄ በአስተዳዳሪው ዘንድ <b>ተቀባይነት አግኝቶ ጸድቋል (Approved)</b>። እናመሰግናለን! 🙏`
        : `🎉 <b>እንኳን ደስ አለዎት ${updated.fullName}!</b>\n\nበሳንኮራ የመኖሪያ ቤት መሬት ፈላጊዎች ዝርዝር ውስጥ ያቀረቡት የምዝገባ ጥያቄ በአስተዳዳሪው ዘንድ <b>ተቀባይነት አግኝቶ ጸድቋል (Approved)</b>።\n\nወደፊት የሚኖሩ አዳዲስ መረጃዎችንና ቀጣይ ሂደቶችን በዚህ ቦት እናሳውቆታለን። እናመሰግናለን! 🙏`;

      await bot.telegram.sendMessage(notifyId, msg, { parse_mode: 'HTML' });
    }
  } catch (err: any) {
    console.warn('Could not notify member of approval:', err.message);
  }
});

bot.action(/^reject_(.+)$/, async (ctx) => {
  const adminId = ctx.from?.id;
  if (!isAdmin(adminId)) {
    return ctx.answerCbQuery('ይህን እርምጃ ለመውሰድ ፈቃድ የለዎትም።', { show_alert: true });
  }

  const docId = ctx.match[1];
  const updated = await updateRegistrationStatus(docId, 'Rejected', ctx.from?.username || 'Natananor');

  if (!updated) {
    return ctx.answerCbQuery('የምዝገባ መረጃውን ማግኘት አልተቻለም።', { show_alert: true });
  }

  await ctx.answerCbQuery('❌ ምዝገባው ውድቅ ተደርጓል!');

  try {
    const inline = Markup.inlineKeyboard([
      [Markup.button.callback('🗑️ በቋሚነት ሰርዝ (Delete)', `del_${updated.id}`)],
    ]);
    await ctx.editMessageText(
      `❌ <b>የምዝገባ ጥያቄው ውድቅ ተደርጓል (Rejected)</b>\n\n` +
        `👤 <b>ሙሉ ስም፦</b> ${updated.fullName}\n` +
        `📱 <b>ስልክ ቁጥር፦</b> <code>${updated.phoneNumber}</code>\n` +
        `📍 <b>የመኖሪያ ቦታ፦</b> ${updated.livingPlace}\n` +
        `🛡️ <b>ውሳኔውን የሰጠው አስተዳዳሪ፦</b> @${ctx.from?.username || 'Natananor'}\n` +
        `📅 <b>ቀን፦</b> ${new Date().toLocaleDateString('am-ET')}`,
      { parse_mode: 'HTML', ...inline }
    );
  } catch (err) {
    console.warn('Could not edit admin message:', err);
  }

  // Notify member
  try {
    const notifyId = updated.isProxyRegistration
      ? Number(updated.registeredByTelegramId)
      : Number(updated.telegramUserId);

    if (notifyId) {
      const msg = updated.isProxyRegistration
        ? `ሰላም፣ እርስዎ ያስመዘገቡት የ <b>${updated.fullName}</b> የምዝገባ ጥያቄ በአስተዳዳሪው ዘንድ ተቀባይነት አላገኘም። ተጨማሪ መረጃ ካስፈለገዎት አስተዳዳሪውን @${ADMIN_USERNAME} ማነጋገር ይችላሉ።`
        : `ሰላም <b>${updated.fullName}</b>፣ ያቀረቡት የምዝገባ ጥያቄ በአስተዳዳሪው ዘንድ ተቀባይነት አላገኘም። ተጨማሪ መረጃ ካስፈለገዎት አስተዳዳሪውን @${ADMIN_USERNAME} ማነጋገር ይችላሉ።`;

      await bot.telegram.sendMessage(notifyId, msg, { parse_mode: 'HTML' });
    }
  } catch (err: any) {
    console.warn('Could not notify member of rejection:', err.message);
  }
});

// Admin Delete Actions
bot.action(/^del_(.+)$/, async (ctx) => {
  const adminId = ctx.from?.id;
  if (!isAdmin(adminId)) {
    return ctx.answerCbQuery('ይህን እርምጃ ለመውሰድ ፈቃድ የለዎትም።', { show_alert: true });
  }

  const id = ctx.match[1];
  const record = await getRegistrationById(id);
  if (!record) {
    return ctx.answerCbQuery('የምዝገባ መረጃው አልተገኘም።', { show_alert: true });
  }

  await ctx.answerCbQuery();
  const confirmInline = Markup.inlineKeyboard([
    [
      Markup.button.callback('⚠️ አዎ፣ ሙሉ በሙሉ ሰርዝ', `confirm_del_${id}`),
      Markup.button.callback('❌ ተመለስ', `cancel_del_${id}`),
    ],
  ]);

  await ctx.reply(
    `⚠️ <b>የአስተዳዳሪ ማረጋገጫ (Permanent Delete)፦</b>\n\n` +
      `የ <b>${record.fullName}</b>ን የምዝገባ መረጃ ከዳታቤዝ ውስጥ <b>ሙሉ በሙሉ እና በቋሚነት መሰረዝ</b> ይፈልጋሉ?\n` +
      `<i>(ይህ እርምጃ መልሶ መመለስ አይቻልም)</i>`,
    { parse_mode: 'HTML', ...confirmInline }
  );
});

bot.action(/^confirm_del_(.+)$/, async (ctx) => {
  const adminId = ctx.from?.id;
  if (!isAdmin(adminId)) {
    return ctx.answerCbQuery('ይህን እርምጃ ለመውሰድ ፈቃድ የለዎትም።', { show_alert: true });
  }

  const id = ctx.match[1];
  const record = await getRegistrationById(id);
  const name = record?.fullName || 'አባል';
  const deleted = await deleteRegistrationById(id);

  if (deleted) {
    await ctx.answerCbQuery('✅ በቋሚነት ተሰርዟል!');
    await ctx.editMessageText(
      `🗑️ የ <b>${name}</b> የምዝገባ መረጃ በአስተዳዳሪው ከዳታቤዝ ውስጥ <b>ሙሉ በሙሉ እና በቋሚነት ተሰርዟል</b>።`,
      { parse_mode: 'HTML' }
    );
  } else {
    await ctx.answerCbQuery('ስህተት ተከስቷል');
  }
});

bot.action(/^cancel_del_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('ተሰርዟል');
  try {
    await ctx.editMessageText('መሰረዙ ተቋርጧል። መረጃው በዳታቤዝ ውስጥ ሳይነካ ተቀምጧል።');
  } catch {}
});

// ---------------------------------------------
// BOT COMMANDS
// ---------------------------------------------

// /start command
bot.command('start', async (ctx) => {
  const from = ctx.from;
  if (!from) return;

  const userId = String(from.id);
  const username = from.username || '';

  // Check if user is already registered
  const existing = await getRegistrationByTelegramId(userId);
  if (existing) {
    const statusNote =
      existing.verificationStatus === 'Approved'
        ? '✅ ምዝገባዎ በአስተዳዳሪው ጸድቋል (Approved)'
        : existing.verificationStatus === 'Rejected'
        ? '❌ ምዝገባዎ ውድቅ ተደርጓል (Rejected)'
        : '⏳ ምዝገባዎ በአስተዳዳሪው ማረጋገጫ በመጠባበቅ ላይ ነው (Pending Approval)';

    await ctx.reply(
      `ሰላም <b>${existing.fullName}</b>! ቀደም ሲል በሳንኮራ የመኖሪያ ቤት መሬት ፈላጊዎች ዝርዝር ውስጥ ተመዝግበዋል።\n\n` +
        `🛡️ <b>ሁኔታ፦</b> ${statusNote}\n` +
        `📅 <b>የተመዘገቡበት ቀን፦</b> ${new Date(existing.registrationDate).toLocaleDateString('am-ET')}\n\n` +
        `የተመዘገቡትን መረጃ ለመመልከት ወይም ቴሌግራም የማይጠቀሙ ሌላ ፍላጎት ያላቸውን ሰዎች ለመመዝገብ ከታች ያሉትን አማራጮች ይጠቀሙ፦`,
      { parse_mode: 'HTML', ...registeredUserKeyboard }
    );
    return;
  }

  // New registration prompt
  const session = await getSession(userId, username);
  session.step = 'ASK_CONFIRM_INTEREST';
  session.draft = { telegramUserId: userId, telegramUsername: username };
  await saveSession(session);

  await ctx.reply(
    `ሰላም <b>${from.first_name || ''}</b>! እንኳን ወደ <b>የሳንኮራ የመኖሪያ ቤት መሬት ምዝገባ ቦት</b> (Sankora Land Registration Bot) በደህና መጡ።\n\n` +
      `ይህ ቦት በሳንኮራ ከተማ የመኖሪያ ቤት መሬት ለማግኘት ለሚደረገው የጋራ ጥረት ፍላጎት ያላቸውን አባላት በትክክልና በፍትሃዊነት ለመመዝገብ የተዘጋጀ ነው።\n\n` +
      `👉 <b>በሳንኮራ ከተማ የመኖሪያ ቤት መሬት ለማግኘት በሚደረገው የጋራ ጥረት በእውነት መሳተፍ ይፈልጋሉ?</b>`,
    { parse_mode: 'HTML', ...interestKeyboard }
  );
});

// /cancel command (only cancels active registration wizard, does NOT delete registered members)
bot.command('cancel', async (ctx) => {
  if (!ctx.from) return;
  await clearSession(String(ctx.from.id));
  await ctx.reply(
    `ምዝገባው ተቋርጧል። በማንኛውም ጊዜ እንደገና ለመጀመር /start ብለው መላክ ይችላሉ።`,
    removeKeyboard
  );
});

// /help command
bot.command('help', async (ctx) => {
  const isAdm = ctx.from && isAdmin(ctx.from.id);
  let text =
    `ℹ️ <b>የሳንኮራ የመኖሪያ ቤት መሬት ምዝገባ ቦት መመሪያ</b>\n\n` +
    `ይህ ቦት በሳንኮራ ከተማ የመኖሪያ መሬት ለማግኘት የሚሹ ዜጎችን መረጃ በታማኝነትና በሚስጥር ለመመዝገብ ያገለግላል።\n` +
    `ሁሉም መረጃዎች በደህንነት ዳታቤዝ ውስጥ ተጠብቀው ይቆያሉ።\n\n` +
    `<b>ትዕዛዞች፦</b>\n` +
    `• /start — ምዝገባ ለመጀመር ወይም ሁኔታዎን ለማየት\n` +
    `• /status — የተመዘገቡትን መረጃዎን ለማየት\n` +
    `• /edit — የተመዘገቡትን መረጃ ለማስተካከል\n` +
    `• /add_friend — ቴሌግራም የማይጠቀም ሌላ ፍላጎት ያለው ሰው ለመመዝገብ\n` +
    `• /cancel — በሂደት ላይ ያለ ምዝገባን ለማቋረጥ\n` +
    `• /help — ይህን መመሪያ ለማየት\n`;

  if (isAdm) {
    text +=
      `\n👑 <b>የአስተዳዳሪ (Admin) ትዕዛዞች፦</b>\n` +
      `• /admin — የአስተዳዳሪ መቆጣጠሪያ ሰሌዳ\n` +
      `• /pending — ማረጋገጫ የሚጠብቁትን ለማየትና ለማጽደቅ\n` +
      `• /delete &lt;ስም/ስልክ&gt; — አባልን ከዳታቤዝ በቋሚነት ለመሰረዝ\n` +
      `• /count — የተመዘገቡ አባላት ጠቅላላ ቁጥርና ማጠቃለያ\n` +
      `• /members — የተመዘገቡ አባላት ዝርዝር\n` +
      `• /search &lt;ስም/ስልክ&gt; — አባል መፈለጊያ\n` +
      `• /export — መረጃዎችን በCSV ፋይል ማውረጃ\n`;
  }

  await ctx.reply(text, { parse_mode: 'HTML' });
});

// /status command
bot.command('status', async (ctx) => {
  if (!ctx.from) return;
  const existing = await getRegistrationByTelegramId(String(ctx.from.id));
  if (!existing) {
    await ctx.reply(`እስካሁን አልተመዘገቡም። ለመመዝገብ /start ብለው ይጀምሩ።`, removeKeyboard);
    return;
  }
  await ctx.reply(formatRecordSummary(existing), {
    parse_mode: 'HTML',
    ...registeredUserKeyboard,
  });
});

// /edit command
bot.command('edit', async (ctx) => {
  if (!ctx.from) return;
  const userId = String(ctx.from.id);
  const session = await getSession(userId, ctx.from.username);
  session.step = 'ASK_FULL_NAME';
  session.draft = { telegramUserId: userId, telegramUsername: ctx.from.username || '' };
  await saveSession(session);

  await ctx.reply(
    `መረጃዎን ለማስተካከል ዝግጁ ነን።\n\nእባክዎ ሙሉ ስምዎን (የአባትና የአያት ስም ጨምሮ) በትክክል ጽፈው ይላኩ፦`,
    removeKeyboard
  );
});

// /add_friend command: allow registering another interested person who does not use telegram
bot.command('add_friend', async (ctx) => {
  if (!ctx.from) return;
  const userId = String(ctx.from.id);
  const session = await getSession(userId, ctx.from.username);
  const existing = await getRegistrationByTelegramId(userId);

  session.step = 'ASK_FRIEND_NAME';
  session.friendDraft = {
    registeredByTelegramId: userId,
    registeredByTelegramUsername: ctx.from.username ? `@${ctx.from.username}` : '',
    registeredByName: existing?.fullName || ctx.from.first_name || 'የቴሌግራም አባል',
    isProxyRegistration: true,
  };
  await saveSession(session);

  await ctx.reply(
    `🤝 <b>ቴሌግራም የማይጠቀም ሌላ ፍላጎት ያለው ሰው ምዝገባ</b>\n\n` +
      `ስለ ፍላጎታቸው እርግጠኛ የሆኑበትን ሰው መረጃ በታማኝነት መመዝገብ ይችላሉ።\n\n` +
      `👉 <b>1. እባክዎ የሰውየውን/የሴትየዋን ሙሉ ስም (የአባትና የአያት ስም ጨምሮ) ጽፈው ይላኩ፦</b>`,
    { parse_mode: 'HTML', ...removeKeyboard }
  );
});

// ---------------------------------------------
// ADMINISTRATOR COMMANDS (Strict ID Check: 7703225687)
// ---------------------------------------------

bot.command('admin', async (ctx) => {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    return ctx.reply('ይህን ትዕዛዝ ለመጠቀም ፈቃድ የለዎትም።');
  }

  const all = await getAllRegistrations();
  const pending = all.filter((r) => r.verificationStatus === 'Pending Approval').length;
  const approved = all.filter((r) => r.verificationStatus === 'Approved').length;
  const rejected = all.filter((r) => r.verificationStatus === 'Rejected').length;

  await ctx.reply(
    `👑 <b>የአስተዳዳሪ (Admin) መቆጣጠሪያ ሰሌዳ</b>\n\n` +
      `የተፈቀደሎት አስተዳዳሪ፦ <b>@${ADMIN_USERNAME}</b> (ID: <code>${ADMIN_USER_ID}</code>)\n` +
      `📊 <b>ጠቅላላ የተመዘገቡ አባላት፦</b> ${all.length} አባላት\n` +
      `• ⏳ ማረጋገጫ የሚጠብቁ፦ <b>${pending}</b>\n` +
      `• ✅ የጸደቁ አባላት፦ <b>${approved}</b>\n` +
      `• ❌ ውድቅ የተደረጉ፦ <b>${rejected}</b>\n\n` +
      `የሚከተሉትን ትዕዛዞች መጠቀም ይችላሉ፦\n` +
      `• /pending — ማረጋገጫ የሚጠብቁትን ለማየትና ለማጽደቅ\n` +
      `• /delete &lt;ስም ወይም ስልክ&gt; — አባልን ከዳታቤዝ በቋሚነት ለመሰረዝ\n` +
      `• /count — የአባላት ስታትስቲክስ ዝርዝር\n` +
      `• /members — የተመዘገቡ አባላትን ማየት (ከመሰረዝ ቁልፍ ጋር)\n` +
      `• /search &lt;ስም ወይም ስልክ&gt; — አባል መፈለግ\n` +
      `• /export — መረጃዎችን በCSV ፋይል ማውረድ`,
    { parse_mode: 'HTML' }
  );
});

bot.command('pending', async (ctx) => {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    return ctx.reply('ይህን ትዕዛዝ ለመጠቀም ፈቃድ የለዎትም።');
  }

  const all = await getAllRegistrations();
  const pending = all.filter((r) => r.verificationStatus === 'Pending Approval');

  if (pending.length === 0) {
    return ctx.reply('✅ በአሁኑ ሰዓት ማረጋገጫ የሚጠብቅ ምንም አዲስ የምዝገባ ጥያቄ የለም። ሁሉም ተጣርተዋል።');
  }

  await ctx.reply(
    `⏳ <b>ማረጋገጫ የሚጠብቁ አባላት፦ ጠቅላላ ${pending.length}</b>\nእባክዎ እያንዳንዱን ከታች ያለውን አጽድቅ፣ ውድቅ አድርግ ወይም ሰርዝ በማለት ይወስኑ፦`,
    { parse_mode: 'HTML' }
  );

  for (const r of pending.slice(0, 5)) {
    const isProxy = Boolean(r.isProxyRegistration);
    const text =
      `👤 <b>ስም፦</b> ${r.fullName}\n` +
      `📱 <b>ስልክ፦</b> <code>${r.phoneNumber}</code>\n` +
      `📍 <b>ቦታ፦</b> ${r.livingPlace} | 💼 <b>ስራ፦</b> ${r.occupation}\n` +
      (isProxy ? `🤝 <b>የመዘገበው፦</b> ${r.registeredByName}\n` : `📱 <b>ቴሌግራም፦</b> ${r.telegramUsername || r.telegramUserId}\n`) +
      `📅 <b>ቀን፦</b> ${new Date(r.registrationDate).toLocaleDateString('am-ET')}`;

    const inlineKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ አጽድቅ (Approve)', `approve_${r.id}`),
        Markup.button.callback('❌ ውድቅ አድርግ (Reject)', `reject_${r.id}`),
      ],
      [Markup.button.callback('🗑️ በቋሚነት ሰርዝ (Delete)', `del_${r.id}`)],
    ]);

    await ctx.reply(text, { parse_mode: 'HTML', ...inlineKeyboard });
  }
});

bot.command('delete', async (ctx) => {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    return ctx.reply('ይህን ትዕዛዝ ለመጠቀም ፈቃድ የለዎትም።');
  }

  const queryText = ctx.message.text.replace('/delete', '').trim();
  if (!queryText) {
    return ctx.reply(
      'እባክዎ የሚሰረዘውን አባል ስም ወይም ስልክ ቁጥር ከትዕዛዙ ጋር ይጻፉ።\nምሳሌ፦ <code>/delete 0911223344</code> ወይም <code>/delete አበበ</code>',
      { parse_mode: 'HTML' }
    );
  }

  const results = await searchRegistrations(queryText);
  if (results.length === 0) {
    return ctx.reply(`"<b>${queryText}</b>" የሚል አባል አልተገኘም።`, { parse_mode: 'HTML' });
  }

  await ctx.reply(`🗑️ <b>የተገኙ አባላት (${results.length})፦</b>\nየሚፈልጉትን አባል ለመሰረዝ ከስሙ በታች ያለውን ቁልፍ ይጫኑ፦`, {
    parse_mode: 'HTML',
  });

  for (const r of results.slice(0, 3)) {
    const inline = Markup.inlineKeyboard([
      [Markup.button.callback('🗑️ በቋሚነት ሰርዝ (Delete)', `del_${r.id}`)],
    ]);
    await ctx.reply(
      `👤 <b>${r.fullName}</b>\n📱 ስልክ፦ <code>${r.phoneNumber}</code>\n📍 ቦታ፦ ${r.livingPlace} | 💼 ስራ፦ ${r.occupation}\n🛡️ ሁኔታ፦ ${r.verificationStatus}`,
      { parse_mode: 'HTML', ...inline }
    );
  }
});

bot.command('count', async (ctx) => {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    return ctx.reply('ይህን ትዕዛዝ ለመጠቀም ፈቃድ የለዎትም።');
  }

  const all = await getAllRegistrations();
  const direct = all.filter((r) => !r.isProxyRegistration).length;
  const proxy = all.filter((r) => r.isProxyRegistration).length;
  const pending = all.filter((r) => r.verificationStatus === 'Pending Approval').length;
  const approved = all.filter((r) => r.verificationStatus === 'Approved').length;

  const places: Record<string, number> = {};
  for (const r of all) {
    const p = (r.livingPlace || 'ያልታወቀ').trim();
    places[p] = (places[p] || 0) + 1;
  }

  const topPlaces = Object.entries(places)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([p, c]) => `  • ${p}፦ ${c} ሰው`)
    .join('\n');

  await ctx.reply(
    `📊 <b>የሳንኮራ የመኖሪያ መሬት ፍላጎት አባላት ስታትስቲክስ</b>\n\n` +
      `👥 <b>ጠቅላላ የተመዘገቡ አባላት፦</b> <b>${all.length}</b> ሰው\n\n` +
      `🛡️ <b>የማረጋገጫ ሁኔታ፦</b>\n` +
      `• ✅ የጸደቁ (Approved)፦ ${approved}\n` +
      `• ⏳ ማረጋገጫ የሚጠብቁ (Pending)፦ ${pending}\n\n` +
      `📱 <b>የምዝገባ ዓይነት፦</b>\n` +
      `• በቀጥታ በቴሌግራም የተመዘገቡ፦ ${direct}\n` +
      `• ቴሌግራም የሌላቸው (በጓደኛ የተመዘገቡ)፦ ${proxy}\n\n` +
      `📍 <b>ዋና ዋና የመኖሪያ አካባቢዎች፦</b>\n` +
      (topPlaces || '  • መረጃ አልተገኘም'),
    { parse_mode: 'HTML' }
  );
});

bot.command('members', async (ctx) => {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    return ctx.reply('ይህን ትዕዛዝ ለመጠቀም ፈቃድ የለዎትም።');
  }

  const all = await getAllRegistrations();
  if (all.length === 0) {
    return ctx.reply('እስካሁን የተመዘገበ አባል የለም።');
  }

  const recent = all.slice(0, 6);
  await ctx.reply(`👥 <b>የተመዘገቡ አባላት ዝርዝር (ከጠቅላላ ${all.length} ውስጥ ${recent.length})፦</b>`, {
    parse_mode: 'HTML',
  });

  for (let idx = 0; idx < recent.length; idx++) {
    const r = recent[idx];
    const statusIcon = r.verificationStatus === 'Approved' ? '✅' : r.verificationStatus === 'Rejected' ? '❌' : '⏳';
    const inline = Markup.inlineKeyboard([
      [Markup.button.callback('🗑️ በቋሚነት ሰርዝ', `del_${r.id}`)],
    ]);

    await ctx.reply(
      `<b>${idx + 1}. ${r.fullName}</b> ${statusIcon}\n` +
        `   📱 ስልክ፦ <code>${r.phoneNumber}</code>\n` +
        `   📍 ቦታ፦ ${r.livingPlace} | 💼 ስራ፦ ${r.occupation}\n` +
        (r.isProxyRegistration
          ? `   🤝 የመዘገበው፦ ${r.registeredByName || 'የቴሌግራም አባል'}\n`
          : `   📱 ቴሌግራም፦ ${r.telegramUsername || r.telegramUserId}\n`),
      { parse_mode: 'HTML', ...inline }
    );
  }

  if (all.length > 6) {
    await ctx.reply(`<i>ሁሉንም አባላት በሙሉ ለማውረድ /export ይጠቀሙ።</i>`, { parse_mode: 'HTML' });
  }
});

bot.command('search', async (ctx) => {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    return ctx.reply('ይህን ትዕዛዝ ለመጠቀም ፈቃድ የለዎትም።');
  }

  const queryText = ctx.message.text.replace('/search', '').trim();
  if (!queryText) {
    return ctx.reply('እባክዎ የሚፈልጉትን ስም ወይም ስልክ ቁጥር ከትዕዛዙ ጋር ይጻፉ።\nምሳሌ፦ <code>/search 0911</code> ወይም <code>/search አበበ</code>', {
      parse_mode: 'HTML',
    });
  }

  const results = await searchRegistrations(queryText);
  if (results.length === 0) {
    return ctx.reply(`"<b>${queryText}</b>" የሚል ውጤት አልተገኘም።`, { parse_mode: 'HTML' });
  }

  let text = `🔍 <b>የፍለጋ ውጤቶች ("${queryText}")፦ ${results.length} ተገኝተዋል</b>\n\n`;
  for (let i = 0; i < Math.min(results.length, 5); i++) {
    const r = results[i];
    const statusIcon = r.verificationStatus === 'Approved' ? '✅' : r.verificationStatus === 'Rejected' ? '❌' : '⏳';
    const inline = Markup.inlineKeyboard([
      [Markup.button.callback('🗑️ በቋሚነት ሰርዝ', `del_${r.id}`)],
    ]);

    await ctx.reply(
      `<b>${i + 1}. ${r.fullName}</b> ${statusIcon}\n` +
        `   📱 ስልክ፦ <code>${r.phoneNumber}</code> | 📍 ቦታ፦ ${r.livingPlace}\n` +
        `   💼 ስራ፦ ${r.occupation}\n` +
        (r.isProxyRegistration ? `   🤝 የመዘገበው፦ ${r.registeredByName}\n` : ''),
      { parse_mode: 'HTML', ...inline }
    );
  }
});

bot.command('export', async (ctx) => {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    return ctx.reply('ይህን ትዕዛዝ ለመጠቀም ፈቃድ የለዎትም።');
  }

  const all = await getAllRegistrations();
  if (all.length === 0) {
    return ctx.reply('ለማውረድ የሚሆን የተመዘገበ አባል እስካሁን የለም።');
  }

  const csv = generateCSV(all);
  const buffer = Buffer.from(csv, 'utf-8');

  await ctx.replyWithDocument(
    { source: buffer, filename: `Sankora_Land_Members_${new Date().toISOString().slice(0, 10)}.csv` },
    { caption: `📥 የሳንኮራ የመኖሪያ መሬት ፍላጎት አባላት ጠቅላላ ዝርዝር (${all.length} አባላት)` }
  );
});

// ---------------------------------------------
// CONVERSATIONAL REGISTRATION FLOW
// ---------------------------------------------

bot.on('contact', async (ctx) => {
  if (!ctx.from || !ctx.message.contact) return;
  const userId = String(ctx.from.id);
  const session = await getSession(userId, ctx.from.username);

  if (session.step === 'ASK_PHONE') {
    let phone = ctx.message.contact.phone_number;
    if (!phone.startsWith('+')) phone = `+${phone}`;
    session.draft.phoneNumber = phone;
    session.step = 'ASK_LIVING_PLACE';
    await saveSession(session);

    await ctx.reply(
      `እናመሰግናለን! ስልክ ቁጥርዎ <b>${phone}</b> ተመዝግቧል።\n\n` +
        `👉 <b>3. በአሁኑ ሰዓት በቋሚነት የት ነው የሚኖሩት?</b> (ከተማ፣ ክፍለ ከተማ ወይም ቀበሌ ይጥቀሱ)፦`,
      { parse_mode: 'HTML', ...removeKeyboard }
    );
  }
});

bot.on('text', async (ctx) => {
  if (!ctx.from || !ctx.message.text) return;
  const userId = String(ctx.from.id);
  const text = ctx.message.text.trim();

  // If text is a command handled above, ignore
  if (text.startsWith('/')) return;

  // Handle Registered User Quick Actions
  if (text === '📋 የምዝገባ መረጃዬን አሳይ') {
    const existing = await getRegistrationByTelegramId(userId);
    if (existing) {
      return ctx.reply(formatRecordSummary(existing), {
        parse_mode: 'HTML',
        ...registeredUserKeyboard,
      });
    }
  }

  if (
    text === '➕ ሌላ ፍላጎት ያለው ሰው መመዝገብ (ቴሌግራም የሌለው)' ||
    text === '➕ አዎ፣ ሌላ ፍላጎት ያለው ሰው መመዝገብ እፈልጋለሁ'
  ) {
    const session = await getSession(userId, ctx.from.username);
    const existing = await getRegistrationByTelegramId(userId);

    session.step = 'ASK_FRIEND_NAME';
    session.friendDraft = {
      registeredByTelegramId: userId,
      registeredByTelegramUsername: ctx.from.username ? `@${ctx.from.username}` : '',
      registeredByName: existing?.fullName || ctx.from.first_name || 'የቴሌግራም አባል',
      isProxyRegistration: true,
    };
    await saveSession(session);

    return ctx.reply(
      `🤝 <b>ቴሌግራም የማይጠቀም ፍላጎት ያለው ሰው መመዝገቢያ</b>\n\n` +
        `ስለ ፍላጎታቸው እርግጠኛ የሆኑበትን ሰው መረጃ በታማኝነት ማስገባት ይችላሉ።\n\n` +
        `👉 <b>1. እባክዎ የሰውየውን/የሴትየዋን ሙሉ ስም (የአባትና የአያት ስም ጨምሮ) ጽፈው ይላኩ፦</b>`,
      { parse_mode: 'HTML', ...removeKeyboard }
    );
  }

  if (text === '✅ የለም፣ ምዝገባውን ጨርሻለሁ' || text === '✅ የለም፣ ሁሉንም ጨርሻለሁ') {
    await clearSession(userId);
    return ctx.reply(
      `በጣም እናመሰግናለን! ምዝገባው ተጠናቋል። አዳዲስ መረጃዎችን በዚህ ቦት እናሳውቆታለን። መልካም ቀን ይሁንልዎ! 🙏`,
      registeredUserKeyboard
    );
  }

  if (text === '✏️ መረጃዬን ማስተካከል' || text === '✏️ መረጃዬን ማስተካከል እፈልጋለሁ') {
    const session = await getSession(userId, ctx.from.username);
    session.step = 'ASK_FULL_NAME';
    session.draft = { telegramUserId: userId, telegramUsername: ctx.from.username || '' };
    await saveSession(session);

    return ctx.reply(
      `መረጃዎን እንደገና ለማስተካከል ተዘጋጅተናል።\n\n` +
        `👉 <b>እባክዎ ሙሉ ስምዎን (የአባትና የአያት ስም ጨምሮ) በትክክል ጽፈው ይላኩ፦</b>`,
      { parse_mode: 'HTML', ...removeKeyboard }
    );
  }

  // Regular members cannot delete data: protect data security
  if (text === '🗑️ ምዝገባዬን ሰርዝ') {
    return ctx.reply(
      `🔒 <b>የመረጃ ደህንነት ማስታወሻ፦</b>\n\n` +
        `ያቀረቡት መረጃ በደህንነት ዳታቤዝ ውስጥ ተጠብቆ ተቀምጧል። የተመዘገበን አባል ከዳታቤዝ ውስጥ በቋሚነት የመሰረዝ ፈቃድ ያለው ዋናው አስተዳዳሪ (@${ADMIN_USERNAME}) ብቻ ነው።\n\n` +
        `መሰረዝ የሚፈልጉበት ምክንያት ካለ እባክዎ አስተዳዳሪውን ያነጋግሩ።`,
      { parse_mode: 'HTML', ...registeredUserKeyboard }
    );
  }

  if (text === '❌ ምዝገባውን አቋርጥ' || text === '❌ ሰርዝ') {
    await clearSession(userId);
    return ctx.reply(
      `ምዝገባው ተቋርጧል። በማንኛውም ጊዜ እንደገና ለመጀመር /start ብለው መላክ ይችላሉ።`,
      removeKeyboard
    );
  }

  const session = await getSession(userId, ctx.from.username);

  // STEP 1: CONFIRM INTEREST
  if (session.step === 'ASK_CONFIRM_INTEREST') {
    if (text === '❌ አይ፣ አልፈልግም' || text.toLowerCase().includes('አይ')) {
      await clearSession(userId);
      return ctx.reply(
        `ምርጫዎን እናከብራለን። ስለ ጊዜዎ እናመሰግናለን!\n\nበማንኛውም ጊዜ ፍላጎትዎ ሲኖር /start ብለው በመጀመር መመዝገብ ይችላሉ። መልካም ቀን ይሁንልዎ!`,
        removeKeyboard
      );
    }

    if (text === '✅ አዎ፣ መሳተፍ እፈልጋለሁ' || text.toLowerCase().includes('አዎ')) {
      session.draft.interestConfirmation = 'Yes';
      session.step = 'ASK_FULL_NAME';
      await saveSession(session);

      return ctx.reply(
        `በጣም ጥሩ! በመቀጠል ጥቂት መሰረታዊ መረጃዎችን እንጠይቆታለን።\n\n` +
          `👉 <b>1. እባክዎ ሙሉ ስምዎን (የአባትና የአያት ስም ጨምሮ) በትክክል ጽፈው ይላኩ፦</b>`,
        { parse_mode: 'HTML', ...removeKeyboard }
      );
    }

    return ctx.reply(`እባክዎ ከታች ካሉት አማራጮች አንዱን ይምረጡ፦`, interestKeyboard);
  }

  // STEP 2: FULL NAME
  if (session.step === 'ASK_FULL_NAME') {
    if (text.length < 3) {
      return ctx.reply('እባክዎ ትክክለኛ ሙሉ ስምዎን (ቢያንስ 2 ቃላት) ያስገቡ፦');
    }

    session.draft.fullName = text;
    session.step = 'ASK_PHONE';
    await saveSession(session);

    return ctx.reply(
      `እናመሰግናለን <b>${text}</b>!\n\n` +
        `👉 <b>2. እባክዎ ስልክ ቁጥርዎን ያስገቡ፦</b>\n` +
        `ከታች ያለውን <b>"📱 ስልክ ቁጥሬን አጋራ"</b> የሚለውን ቁልፍ በመንካት ወይም በጽሁፍ (ለምሳሌ፦ 0911223344) ማስገባት ይችላሉ።`,
      { parse_mode: 'HTML', ...phoneKeyboard }
    );
  }

  // STEP 3: PHONE NUMBER
  if (session.step === 'ASK_PHONE') {
    const cleanPhone = text.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 9) {
      return ctx.reply(
        'እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ (ለምሳሌ፦ 0911223344 ወይም +251911223344)፦',
        phoneKeyboard
      );
    }

    session.draft.phoneNumber = text;
    session.step = 'ASK_LIVING_PLACE';
    await saveSession(session);

    return ctx.reply(
      `እናመሰግናለን!\n\n` +
        `👉 <b>3. በአሁኑ ሰዓት በቋሚነት የት ነው የሚኖሩት?</b> (ከተማ፣ ክፍለ ከተማ ወይም ቀበሌ ይጥቀሱ)፦`,
      { parse_mode: 'HTML', ...removeKeyboard }
    );
  }

  // STEP 4: LIVING PLACE
  if (session.step === 'ASK_LIVING_PLACE') {
    if (text.length < 2) {
      return ctx.reply('እባክዎ የሚኖሩበትን ቦታ በትክክል ይጥቀሱ፦');
    }

    session.draft.livingPlace = text;
    session.step = 'ASK_OCCUPATION';
    await saveSession(session);

    return ctx.reply(
      `እናመሰግናለን!\n\n` +
        `👉 <b>4. የስራ ዘርፍዎ ወይም ሙያዎ ምንድን ነው?</b> (ለምሳሌ፦ ነጋዴ፣ የመንግስት ሰራተኛ፣ የግል ስራ፣ የጉልበት ሰራተኛ፣ ተማሪ፣ ወዘተ)፦`,
      { parse_mode: 'HTML', ...removeKeyboard }
    );
  }

  // STEP 5: OCCUPATION -> Confirmation
  if (session.step === 'ASK_OCCUPATION') {
    if (text.length < 2) {
      return ctx.reply('እባክዎ የስራ ዘርፍዎን በትክክል ይጥቀሱ፦');
    }

    session.draft.occupation = text;
    session.step = 'CONFIRMATION';
    await saveSession(session);

    return ctx.reply(
      formatRecordSummary(session.draft) +
        `\n\n👉 <b>ያቀረቡት መረጃ ትክክል መሆኑን ያረጋግጣሉ?</b>`,
      { parse_mode: 'HTML', ...confirmKeyboard }
    );
  }

  // STEP 6: CONFIRMATION
  if (session.step === 'CONFIRMATION') {
    if (text === '✅ አረጋግጣለሁ፣ ላክ' || text === '✅ አረጋግጣለሁ፣ መዝግበኝ' || text.toLowerCase().includes('አረጋግጣለሁ')) {
      try {
        const draft = session.draft;
        const saved = await saveRegistration({
          fullName: draft.fullName || '',
          phoneNumber: draft.phoneNumber || '',
          livingPlace: draft.livingPlace || '',
          occupation: draft.occupation || '',
          interestConfirmation: 'Yes',
          telegramUserId: userId,
          telegramUsername: ctx.from.username || draft.telegramUsername || '',
          verificationStatus: 'Pending Approval',
        });

        // Notify Admin in Telegram with Interactive Inline Approval & Delete buttons
        await notifyAdminNewRegistration(saved);

        // Move to friend check
        session.step = 'ASK_HAS_INTERESTED_FRIEND';
        await saveSession(session);

        await ctx.reply(
          `🎉 <b>እናመሰግናለን! የምዝገባ ጥያቄዎ በተሳካ ሁኔታ ቀርቧል።</b>\n\n` +
            `👤 <b>ሙሉ ስም፦</b> ${saved.fullName}\n` +
            `📱 <b>ስልክ ቁጥር፦</b> ${saved.phoneNumber}\n` +
            `📍 <b>የመኖሪያ ቦታ፦</b> ${saved.livingPlace}\n` +
            `💼 <b>የስራ ዘርፍ፦</b> ${saved.occupation}\n` +
            `⏳ <b>ሁኔታ፦</b> <b>በአስተዳዳሪው ማረጋገጫ በመጠባበቅ ላይ (Pending Approval)</b>\n\n` +
            `መረጃዎ በደህንነት ዳታቤዝ ውስጥ ተጠብቋል። አስተዳዳሪው ሲያረጋግጡና ሲያጸድቁ በዚህ ቦት ማረጋገጫ መልእክት ይደርሶዎታል።`,
          { parse_mode: 'HTML', ...removeKeyboard }
        );

        // Ask for friends who don't use Telegram
        return ctx.reply(
          `🤝 <b>ተጨማሪ ጠቃሚ ጥያቄ፦</b>\n\n` +
            `በሳንኮራ ከተማ የመኖሪያ ቤት መሬት ለማግኘት ፍላጎት ኖሯቸው ነገር ግን <b>ቴሌግራም የማይጠቀሙ</b> ወይም በቴሌግራም ግሩፑ ውስጥ የሌሉ የሚያውቋቸው ሰዎች አሉ?\n\n` +
            `ስለ ፍላጎታቸው እርግጠኛ ከሆኑ በእርስዎ በኩል ሊመዘግቧቸው ይችላሉ። ሌላ ሰው መመዝገብ ይፈልጋሉ?`,
          { parse_mode: 'HTML', ...askFriendKeyboard }
        );
      } catch (err: any) {
        console.error('Error completing registration:', err);
        return ctx.reply(
          'ይቅርታ፣ መረጃውን በመመዝገብ ላይ እክል አጋጥሟል። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ ወይም /start ብለው ይጀምሩ።'
        );
      }
    }

    if (text === '✏️ መረጃዬን ማስተካከል እፈልጋለሁ') {
      session.step = 'ASK_FULL_NAME';
      await saveSession(session);
      return ctx.reply(`እባክዎ ሙሉ ስምዎን እንደገና ጽፈው ይላኩ፦`, removeKeyboard);
    }

    return ctx.reply(`እባክዎ ከታች ካሉት አማራጮች አንዱን ይምረጡ፦`, confirmKeyboard);
  }

  // ---------------------------------------------
  // FRIEND REGISTRATION (On Behalf of Non-Telegram Members)
  // ---------------------------------------------

  if (session.step === 'ASK_HAS_INTERESTED_FRIEND') {
    if (text === '➕ አዎ፣ ሌላ ፍላጎት ያለው ሰው መመዝገብ እፈልጋለሁ') {
      const existing = await getRegistrationByTelegramId(userId);
      session.step = 'ASK_FRIEND_NAME';
      session.friendDraft = {
        registeredByTelegramId: userId,
        registeredByTelegramUsername: ctx.from.username ? `@${ctx.from.username}` : '',
        registeredByName: existing?.fullName || ctx.from.first_name || 'የቴሌግራም አባል',
        isProxyRegistration: true,
      };
      await saveSession(session);

      return ctx.reply(
        `በጣም መልካም! እባክዎ ስለ ፍላጎታቸው እርግጠኛ የሆኑበትን ሰው መረጃ ያስገቡ፦\n\n` +
          `👉 <b>1. እባክዎ የሰውየውን/የሴትየዋን ሙሉ ስም (የአባትና የአያት ስም ጨምሮ) ጽፈው ይላኩ፦</b>`,
        { parse_mode: 'HTML', ...removeKeyboard }
      );
    }

    if (text === '✅ የለም፣ ምዝገባውን ጨርሻለሁ') {
      await clearSession(userId);
      return ctx.reply(
        `በጣም እናመሰግናለን! ምዝገባው ተጠናቋል። አዳዲስ መረጃዎችን በዚህ ቦት እናሳውቆታለን። መልካም ቀን ይሁንልዎ! 🙏`,
        registeredUserKeyboard
      );
    }

    return ctx.reply(`እባክዎ ከታች ካሉት አማራጮች አንዱን ይምረጡ፦`, askFriendKeyboard);
  }

  // FRIEND STEP 1: NAME
  if (session.step === 'ASK_FRIEND_NAME') {
    if (text.length < 3) {
      return ctx.reply('እባክዎ የሰውየውን/የሴትየዋን ትክክለኛ ሙሉ ስም ያስገቡ፦');
    }

    if (!session.friendDraft) session.friendDraft = {};
    session.friendDraft.fullName = text;
    session.step = 'ASK_FRIEND_PHONE';
    await saveSession(session);

    return ctx.reply(
      `እናመሰግናለን!\n\n` +
        `👉 <b>2. እባክዎ የ${text}ን ስልክ ቁጥር ያስገቡ፦</b> (ለምሳሌ፦ 0911223344)`,
      { parse_mode: 'HTML', ...removeKeyboard }
    );
  }

  // FRIEND STEP 2: PHONE
  if (session.step === 'ASK_FRIEND_PHONE') {
    const cleanPhone = text.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 9) {
      return ctx.reply('እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ (ለምሳሌ፦ 0911223344)፦');
    }

    if (!session.friendDraft) session.friendDraft = {};
    session.friendDraft.phoneNumber = text;
    session.step = 'ASK_FRIEND_LIVING_PLACE';
    await saveSession(session);

    return ctx.reply(
      `እናመሰግናለን!\n\n` +
        `👉 <b>3. ሰውየው/ሴትየዋ በአሁኑ ሰዓት በቋሚነት የት ነው የሚኖሩት?</b> (ከተማ፣ ክፍለ ከተማ ወይም ቀበሌ ይጥቀሱ)፦`,
      { parse_mode: 'HTML', ...removeKeyboard }
    );
  }

  // FRIEND STEP 3: LIVING PLACE
  if (session.step === 'ASK_FRIEND_LIVING_PLACE') {
    if (text.length < 2) {
      return ctx.reply('እባክዎ የሚኖሩበትን ቦታ በትክክል ይጥቀሱ፦');
    }

    if (!session.friendDraft) session.friendDraft = {};
    session.friendDraft.livingPlace = text;
    session.step = 'ASK_FRIEND_OCCUPATION';
    await saveSession(session);

    return ctx.reply(
      `እናመሰግናለን!\n\n` +
        `👉 <b>4. የስራ ዘርፋቸው ወይም ሙያቸው ምንድን ነው?</b> (ለምሳሌ፦ ነጋዴ፣ የመንግስት ሰራተኛ፣ የግል ስራ፣ ወዘተ)፦`,
      { parse_mode: 'HTML', ...removeKeyboard }
    );
  }

  // FRIEND STEP 4: OCCUPATION -> CONFIRM
  if (session.step === 'ASK_FRIEND_OCCUPATION') {
    if (text.length < 2) {
      return ctx.reply('እባክዎ የስራ ዘርፋቸውን በትክክል ይጥቀሱ፦');
    }

    if (!session.friendDraft) session.friendDraft = {};
    session.friendDraft.occupation = text;
    session.step = 'CONFIRM_FRIEND';
    await saveSession(session);

    return ctx.reply(
      formatRecordSummary(session.friendDraft, true) +
        `\n\n👉 <b>የቀረበው መረጃ ትክክል መሆኑን ያረጋግጣሉ?</b>`,
      { parse_mode: 'HTML', ...friendConfirmKeyboard }
    );
  }

  // FRIEND STEP 5: CONFIRM
  if (session.step === 'CONFIRM_FRIEND') {
    if (text === '✅ አረጋግጣለሁ፣ ላክ' || text === '✅ አረጋግጣለሁ፣ መዝግበው' || text.toLowerCase().includes('አረጋግጣለሁ')) {
      try {
        const friend = session.friendDraft || {};
        const savedFriend = await saveRegistration({
          fullName: friend.fullName || '',
          phoneNumber: friend.phoneNumber || '',
          livingPlace: friend.livingPlace || '',
          occupation: friend.occupation || '',
          interestConfirmation: 'Yes',
          telegramUserId: userId,
          telegramUsername: ctx.from.username || '',
          isProxyRegistration: true,
          registeredByTelegramId: userId,
          registeredByTelegramUsername: ctx.from.username ? `@${ctx.from.username}` : '',
          registeredByName: friend.registeredByName || ctx.from.first_name || 'የቴሌግራም አባል',
          verificationStatus: 'Pending Approval',
        });

        // Notify Admin of new friend registration
        await notifyAdminNewRegistration(savedFriend);

        session.step = 'ASK_HAS_INTERESTED_FRIEND';
        session.friendDraft = {};
        await saveSession(session);

        await ctx.reply(
          `🎉 <b>የጓደኛዎ/የዘመድዎ መረጃ ለአስተዳዳሪው ማረጋገጫ ተልኳል!</b>\n\n` +
            `👤 <b>ሙሉ ስም፦</b> ${friend.fullName}\n` +
            `📱 <b>ስልክ ቁጥር፦</b> ${friend.phoneNumber}\n` +
            `📍 <b>የመኖሪያ ቦታ፦</b> ${friend.livingPlace}\n` +
            `💼 <b>የስራ ዘርፍ፦</b> ${friend.occupation}\n` +
            `⏳ <b>ሁኔታ፦</b> <b>በአስተዳዳሪው ማረጋገጫ በመጠባበቅ ላይ</b>\n\n` +
            `መረጃው በደህንነት ዳታቤዝ ውስጥ ተጠብቆ ተቀምጧል። እናመሰግናለን! 🙏`,
          { parse_mode: 'HTML', ...removeKeyboard }
        );

        return ctx.reply(`ሌላ ተጨማሪ ፍላጎት ያለው ሰው መመዝገብ ይፈልጋሉ?`, askFriendKeyboard);
      } catch (err: any) {
        console.error('Error saving friend registration:', err);
        return ctx.reply('ይቅርታ፣ መረጃውን በመመዝገብ ላይ እክል አጋጥሟል። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።');
      }
    }

    if (text === '✏️ መረጃውን ማስተካከል እፈልጋለሁ') {
      session.step = 'ASK_FRIEND_NAME';
      await saveSession(session);
      return ctx.reply(`እባክዎ የሰውየውን/የሴትየዋን ሙሉ ስም እንደገና ጽፈው ይላኩ፦`, removeKeyboard);
    }

    return ctx.reply(`እባክዎ ከታች ካሉት አማራጮች አንዱን ይምረጡ፦`, friendConfirmKeyboard);
  }

  // Default fallback if not in any active step
  return ctx.reply(
    `ሰላም! ምዝገባ ለመጀመር ወይም ሁኔታዎን ለማየት /start ብለው ይላኩ። ተጨማሪ መረጃ ለማግኘት /help ይጠቀሙ።`,
    removeKeyboard
  );
});
