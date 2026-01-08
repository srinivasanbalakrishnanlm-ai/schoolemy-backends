// =====================================================================
// ⚠️ DEPRECATED: This file is no longer used in AWS Lambda deployment
// =====================================================================
// This node-cron implementation works for traditional Node.js servers
// but DOES NOT work in AWS Lambda environment because:
// 1. Lambda is stateless and event-driven
// 2. Lambda instances are created/destroyed dynamically
// 3. Cron jobs require continuous server runtime
//
// ✅ NEW APPROACH FOR AWS LAMBDA:
// - Use AWS EventBridge (CloudWatch Events) instead
// - Separate Lambda function: cron-handler.js
// - Configured in Terraform: modules/eventbridge/
//
// 📝 NOTE: Keep this file for local development if needed
// =====================================================================

// cron job import
import cron from "node-cron";
import { processOverdueEmis, sendPaymentReminders } from "./EMI-Service.js";

// =====================================================================
// CRON JOB CONFIGURATION
// =====================================================================
// Schedule: Every day at 10:00 AM IST (Asia/Kolkata timezone)
// Tasks:
// 1. processOverdueEmis() - Lock access for overdue EMI payments
// 2. sendPaymentReminders() - Send reminder emails to users
//
// ⚠️ This will only run in local development or traditional server
// ⚠️ For AWS Lambda, use EventBridge with cron-handler.js
// =====================================================================

cron.schedule(
  "0 10 * * *", // Every day at 10:00 AM
  async () => {
    try {
      console.log("⏰ [LOCAL-CRON] Running scheduled EMI cron tasks...");

      // Task 1: Process overdue EMIs
      console.log("📧 [EMI-1] Running processOverdueEmis...");
      await processOverdueEmis();
      console.log("✅ [EMI-1] processOverdueEmis completed");

      // Task 2: Send payment reminders
      console.log("📧 [EMI-2] Running sendPaymentReminders...");
      await sendPaymentReminders();
      console.log("✅ [EMI-2] sendPaymentReminders completed");

      console.log("✅ [LOCAL-CRON] EMI cron tasks completed successfully.");
    } catch (error) {
      console.error(
        "❌ [LOCAL-CRON] An error occurred during a scheduled EMI task:",
        error
      );
    } finally {
      console.log("🛑 [LOCAL-CRON] EMI cron job finished");
    }
  },
  {
    // timezone: "UTC",
    timezone: "Asia/Kolkata", // IST timezone
  }
);

// =====================================================================
// 📚 ALTERNATIVE CRON SCHEDULE EXAMPLES (for reference):
// =====================================================================
// Every 1 minute (for testing):
// cron.schedule("*/1 * * * *", async () => { ... });
//
// Every hour:
// cron.schedule("0 * * * *", async () => { ... });
//
// Every day at midnight:
// cron.schedule("0 0 * * *", async () => { ... });
//
// Every Monday at 9 AM:
// cron.schedule("0 9 * * 1", async () => { ... });
// =====================================================================
