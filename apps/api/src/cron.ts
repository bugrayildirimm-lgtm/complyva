import { runDailyAlerts, sendWeeklyDigest } from "./emails";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  try {
    if (command === "daily") {
      console.log(`[${new Date().toISOString()}] Running daily alerts...`);
      await runDailyAlerts();
    } else if (command === "weekly") {
      console.log(`[${new Date().toISOString()}] Running weekly digest...`);
      await sendWeeklyDigest();
    } else if (command === "all") {
      console.log(`[${new Date().toISOString()}] Running all notifications...`);
      await runDailyAlerts();
      await sendWeeklyDigest();
    } else {
      console.log("Usage: npx tsx src/cron.ts [daily|weekly|all]");
    }
  } catch (err) {
    console.error("Cron error:", err);
  }
  process.exit(0);
}

main();
