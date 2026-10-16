#!/usr/bin/env tsx

import { Command } from "commander";
import { anyApi } from "convex/server";
import { getOperatorClient } from "./lib/operator-client";

const apiRef = anyApi;

const program = new Command();
program
  .name("test-event-generation-bulk")
  .description("Generate events for multiple years in parallel and summarize results")
  .option("--years <list>", "Comma-separated list of years (e.g. 1969,1914,-44)")
  .option("--count <count>", "Number of years to select via selector", "3")
  .option("--verbose", "Print full event lists for each year", false);

program.action(async (options) => {
  const client = getOperatorClient();
  let years: number[] = [];

  if (options.years) {
    years = options.years.split(",").map((year: string) => Number(year.trim()));
  } else {
    const count = Number(options.count) || 3;
    const selector = await client.action(apiRef.lib.workSelector.testSelectWorkYears, {
      count,
    });
    years = selector.years;
  }

  console.log(`Running pipeline for years: ${years.join(", ")}`);

  const summaries = await Promise.all(
    years.map(async (year) => {
      const result = await client.action(
        apiRef.actions.eventGeneration.orchestrator.testGenerateYearEvents,
        {
          year,
        },
      );

      if (options.verbose && result.status === "success") {
        console.log(`\nYear ${year}`);
        result.events.forEach((event: any, index: number) => {
          console.log(`  ${index + 1}. ${event.event_text}`);
        });
      }

      return { year, result };
    }),
  );

  const successes = summaries.filter((entry) => entry.result.status === "success");
  const failures = summaries.filter((entry) => entry.result.status === "failed");

  console.log(`\nSummary: ${successes.length} succeeded / ${failures.length} failed.`);

  failures.forEach((entry) => {
    const reason = entry.result.status === "failed" ? entry.result.reason : "unknown";
    console.warn(`Year ${entry.year} failed: ${reason}`);
  });
});

program.parseAsync();
