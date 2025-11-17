import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { summarizeGenerationLogs } from "../generationLogs";

const DAYS_FOR_ALERTS = 2;

export async function runAlertChecks(ctx: ActionCtx): Promise<void> {
  await Promise.all([checkZeroEvents(ctx), checkCostSpike(ctx), checkPassRate(ctx)]);
}

async function checkZeroEvents(ctx: ActionCtx): Promise<void> {
  const { start, end } = dayRange(-1);
  const yesterday = await ctx.runQuery(internal.generationLogs.getDailyGenerationStats, {
    date: new Date(start).toISOString().slice(0, 10),
  });
  const today = await ctx.runQuery(internal.generationLogs.getDailyGenerationStats, {});

  if (yesterday.eventsGenerated === 0 && today.eventsGenerated === 0) {
    alert("Zero events generated for 2 consecutive days");
  }
}

async function checkCostSpike(ctx: ActionCtx): Promise<void> {
  const logs = [];
  for (let i = DAYS_FOR_ALERTS; i >= 0; i -= 1) {
    const { start } = dayRange(-i);
    const dateString = new Date(start).toISOString().slice(0, 10);
    const stats = await ctx.runQuery(internal.generationLogs.getDailyGenerationStats, {
      date: dateString,
    });
    logs.push(stats);
  }

  if (logs.length < 3) return;
  const last = logs.at(-1)!;
  const previous = logs.slice(0, -1);
  const avg = previous.reduce((sum, stat) => sum + stat.totalCost, 0) / previous.length;
  if (avg > 0 && last.totalCost > avg * 2) {
    alert(`Daily cost spike detected: ${last.totalCost.toFixed(2)} > 2x avg ${avg.toFixed(2)}`);
  }
}

async function checkPassRate(ctx: ActionCtx): Promise<void> {
  const { start } = dayRange(0);
  const recentLogs = await ctx.runQuery(internal.generationLogs.getFailedYears, { limit: 100 });
  const logs = summarizeGenerationLogs(recentLogs);
  if (logs.failedYears > logs.successfulYears) {
    alert("Validation pass rate dropped below 50% over recent failures");
  }
}

function alert(message: string): void {
  console.warn(`[ALERT] ${message}`);
}

function dayRange(offset: number) {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + offset);
  const start = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  const end = start + 24 * 60 * 60 * 1000;
  return { start, end };
}
