require("dotenv").config();
const { Telegraf } = require("telegraf");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);
const channel = process.env.CHANNEL_USERNAME;
const adminUsername = process.env.ADMIN_USERNAME;
const referralFile = "referrals.json";

// 🔄 Load Referral Data
function loadReferrals() {
  if (fs.existsSync(referralFile)) {
    return JSON.parse(fs.readFileSync(referralFile));
  }
  return {};
}

// 💾 Save Referral Data
function saveReferrals(referrals) {
  fs.writeFileSync(referralFile, JSON.stringify(referrals, null, 2));
}

let referrals = loadReferrals();
const withdrawRequests = new Map(); // Store withdrawal codes

// 🟢 Start Command
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ");

  await ctx.reply("🚀 Checking if you have joined the channel...");

  try {
    const chatMember = await ctx.telegram.getChatMember(channel, userId);
    if (["member", "administrator", "creator"].includes(chatMember.status)) {
      // ✅ User is a member, check referral
      if (args.length > 1) {
        const referrerId = args[1];

        if (referrerId !== userId.toString()) {
          if (!referrals[referrerId]) referrals[referrerId] = [];
          if (!referrals[referrerId].includes(userId)) {
            referrals[referrerId].push(userId);
            saveReferrals(referrals);

            ctx.telegram.sendMessage(
              referrerId,
              `🎉 *Someone joined using your link!* 🎯\n\n📊 Total referrals: ${referrals[referrerId].length}`,
              { parse_mode: "Markdown" }
            );
          }
        }
      }
      showMainMenu(ctx);
    } else {
      ctx.reply(
        '❌ <b>You must join the channel to continue!</b>\n\n👉 <a href="https://t.me/netflixpremiumdaily">Click Here to Join</a>\n\n✅ Then, type /start again.',
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    ctx.reply("⚠ *Error checking membership:* " + error.message);
  }
});

// 📌 Function to Show Main Menu
function showMainMenu(ctx) {
  ctx.reply(
    "🎉 *Welcome to the Referral Bot!* 🎉\n\n" +
      "📢 *Earn rewards by referring friends!*\n\n" +
      "🎯 *How It Works?*\n" +
      "1️⃣ Invite your friends using your referral link.\n" +
      "2️⃣ Earn 1 point per referral.\n" +
      "3️⃣ Collect 5 points to withdraw!\n\n" +
      "👇 Choose an option below to get started!",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👥 Invite & Earn", callback_data: "refer" }],
          [{ text: "📊 My Points", callback_data: "mypoints" }],
          [{ text: "💰 Withdraw Rewards", callback_data: "withdraw" }],
        ],
      },
      parse_mode: "Markdown",
    }
  );
}

// 🔗 Referral System
bot.action("refer", (ctx) => {
  const userId = ctx.from.id;
  const refLink = `https://t.me/${ctx.botInfo.username}?start=${userId}`;

  ctx.reply(
    `👥 *Refer & Earn Rewards!*\n\n🔗 Your unique referral link:\n\`${refLink}\`\n\n🎯 Share this link with friends and earn *1 point per referral!*`,
    { parse_mode: "Markdown" }
  );
});

// 📊 My Points
bot.action("mypoints", (ctx) => {
  const userId = ctx.from.id;
  const points = referrals[userId]?.length || 0;

  ctx.reply(
    `📊 *Your Points:*\n\n✅ Total referrals: *${points}*\n\n${
      points >= 5 ? "🎉 You can now withdraw your reward!" : "⏳ Refer *5 people* to unlock withdrawals!"
    }`,
    { parse_mode: "Markdown" }
  );
});

// 💰 Withdraw Request
bot.action("withdraw", (ctx) => {
  const userId = ctx.from.id;
  const points = referrals[userId]?.length || 0;

  if (points < 5) {
    ctx.reply("❌ *You need at least 5 referrals to withdraw rewards!*", { parse_mode: "Markdown" });
    return;
  }

  const uniqueCode = Math.floor(100000 + Math.random() * 900000).toString();
  withdrawRequests.set(userId, uniqueCode);

  ctx.reply(
    `✅ *Withdrawal Approved!*\n\n🔢 Your unique withdrawal code: \`${uniqueCode}\`\n\n📩 *DM the admin* [${adminUsername}](https://t.me/${adminUsername.replace(
      "@",
      ""
    )})\n📌 Send this code to claim your reward!`,
    { parse_mode: "Markdown" }
  );
});

// 🔍 Admin Command: Lookup Codes
bot.command("lookupcodes", (ctx) => {
  const adminId = ctx.from.id;
  if (adminId.toString() !== process.env.ADMIN_ID) {
    ctx.reply("❌ *Only the admin can access this command!*", { parse_mode: "Markdown" });
    return;
  }

  if (withdrawRequests.size === 0) {
    ctx.reply("📜 *No withdrawal codes have been issued yet!*", { parse_mode: "Markdown" });
    return;
  }

  let message = "📜 *Withdrawal Codes:*\n\n";
  withdrawRequests.forEach((code, user) => {
    message += `👤 *User ID:* ${user} | 🔢 Code: \`${code}\`\n`;
  });

  ctx.reply(message, { parse_mode: "Markdown" });
});

// Start bot
bot.launch();
console.log("🤖 Bot is running...");
