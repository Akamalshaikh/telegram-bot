require("dotenv").config();
const { Telegraf } = require("telegraf");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);
const channelId = process.env.CHANNEL_ID; // Single forced join channel
const channelInvite = process.env.CHANNEL_INVITE; // Private channel invite link
const adminUsername = process.env.ADMIN_USERNAME;
const referralFile = "referrals.json";
const usersFile = "users.json"; // Stores all user IDs

// 🔄 Load User Data
function loadUsers() {
  if (fs.existsSync(usersFile)) {
    return JSON.parse(fs.readFileSync(usersFile));
  }
  return [];
}

// 💾 Save User Data
function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

let users = loadUsers();
let referrals = loadReferrals();
const withdrawRequests = new Map();

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

// 🟢 Start Command
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  // Store users who interact with the bot
  if (!users.includes(userId)) {
    users.push(userId);
    saveUsers(users);
  }

  const args = ctx.message.text.split(" ");
  await ctx.reply("🚀 Checking if you have joined the required channel...");

  try {
    const chatMember = await ctx.telegram.getChatMember(channelId, userId);
    if (["member", "administrator", "creator"].includes(chatMember.status)) {
      // ✅ User has joined, proceed with referral
      if (args.length > 1) {
        const referrerId = args[1];
        if (referrerId !== userId.toString()) {
          if (!referrals[referrerId]) referrals[referrerId] = [];
          if (referrals[referrerId].length < 5 && !referrals[referrerId].includes(userId)) {
            referrals[referrerId].push(userId);
            saveReferrals(referrals);

            ctx.telegram.sendMessage(
              referrerId,
              `🎉 *Someone joined using your link!* 🎯\n\n📊 Total referrals: ${referrals[referrerId].length}/5`,
              { parse_mode: "Markdown" }
            );
          }
        }
      }
      showMainMenu(ctx);
    } else {
      ctx.reply(
        `❌ <b>You must join the channel to continue!</b>\n\n👉 <a href="${channelInvite}">Click Here to Join</a>\n\n✅ Then, type /start again.`,
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
    `📊 *Your Points:*\n\n✅ Total referrals: *${points}/5*\n\n${
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

  ctx.reply(
    "⚠️ *Warning:* Your points will reset to 0 after withdrawal!\n\nDo you still want to proceed?",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Yes, Withdraw", callback_data: "confirm_withdraw" }],
          [{ text: "❌ No, Cancel", callback_data: "cancel_withdraw" }],
        ],
      },
      parse_mode: "Markdown",
    }
  );
});

// ✅ Confirm Withdrawal
bot.action("confirm_withdraw", (ctx) => {
  const userId = ctx.from.id;
  const uniqueCode = Math.floor(100000 + Math.random() * 900000).toString();
  withdrawRequests.set(userId, uniqueCode);

  referrals[userId] = []; // Reset referrals
  saveReferrals(referrals);

  ctx.reply(
    `✅ *Withdrawal Approved!*\n\n🔢 Your unique withdrawal code: \`${uniqueCode}\`\n\n📩 *DM the admin* [${adminUsername}](https://t.me/${adminUsername.replace(
      "@",
      ""
    )})\n📌 Send this code to claim your reward!\n\n⚠️ Your points have been reset to *0* after withdrawal.`,
    { parse_mode: "Markdown" }
  );
});

// 🔊 Broadcast Message (Admin Only)
bot.command("broadcast", async (ctx) => {
  const adminId = ctx.from.id.toString();

  if (adminId !== process.env.ADMIN_ID) {
    return ctx.reply("❌ *Only the admin can use this command!*", { parse_mode: "Markdown" });
  }

  const messageText = ctx.message.text.split(" ").slice(1).join(" ");
  if (!messageText) {
    return ctx.reply("⚠️ *Please provide a message to broadcast!*", { parse_mode: "Markdown" });
  }

  let successCount = 0, failureCount = 0;
  for (const userId of users) {
    try {
      await bot.telegram.sendMessage(userId, `📢 *Broadcast from Admin:*\n\n${messageText}`, { parse_mode: "Markdown" });
      successCount++;
    } catch (error) {
      console.error(`Failed to send message to ${userId}:`, error.message);
      failureCount++;
    }
  }

  ctx.reply(`✅ Broadcast completed!\n📤 Sent: ${successCount}\n❌ Failed: ${failureCount}`);
});

// Start bot
bot.launch();
console.log("🤖 Bot is running...");
