/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as actions_eventGeneration_critic from "../actions/eventGeneration/critic.js";
import type * as actions_eventGeneration_generator from "../actions/eventGeneration/generator.js";
import type * as actions_eventGeneration_orchestrator from "../actions/eventGeneration/orchestrator.js";
import type * as actions_eventGeneration_reviser from "../actions/eventGeneration/reviser.js";
import type * as actions_eventGeneration_schemas from "../actions/eventGeneration/schemas.js";
import type * as actions_eventGeneration_values from "../actions/eventGeneration/values.js";
import type * as actions_historicalContext from "../actions/historicalContext.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as generationLogs from "../generationLogs.js";
import type * as lib_alerts from "../lib/alerts.js";
import type * as lib_errorSanitization from "../lib/errorSanitization.js";
import type * as lib_eventValidation from "../lib/eventValidation.js";
import type * as lib_llmClient from "../lib/llmClient.js";
import type * as lib_logging from "../lib/logging.js";
import type * as lib_migrationHelpers from "../lib/migrationHelpers.js";
import type * as lib_observability from "../lib/observability.js";
import type * as lib_orderScoring from "../lib/orderScoring.js";
import type * as lib_puzzleHelpers from "../lib/puzzleHelpers.js";
import type * as lib_puzzleType from "../lib/puzzleType.js";
import type * as lib_responsesClient from "../lib/responsesClient.js";
import type * as lib_streakCalculation from "../lib/streakCalculation.js";
import type * as lib_streakHelpers from "../lib/streakHelpers.js";
import type * as lib_workSelector from "../lib/workSelector.js";
import type * as migration_anonymous from "../migration/anonymous.js";
import type * as migrations_generateMissingContext from "../migrations/generateMissingContext.js";
import type * as migrations_migrateEvents from "../migrations/migrateEvents.js";
import type * as migrations_regenerateHistoricalContextGPT5 from "../migrations/regenerateHistoricalContextGPT5.js";
import type * as orderPlays_queries from "../orderPlays/queries.js";
import type * as orderPlays from "../orderPlays.js";
import type * as orderPuzzles_generation from "../orderPuzzles/generation.js";
import type * as orderPuzzles_mutations from "../orderPuzzles/mutations.js";
import type * as orderPuzzles_queries from "../orderPuzzles/queries.js";
import type * as orderPuzzles from "../orderPuzzles.js";
import type * as plays_queries from "../plays/queries.js";
import type * as puzzles_context from "../puzzles/context.js";
import type * as puzzles_generation from "../puzzles/generation.js";
import type * as puzzles_mutations from "../puzzles/mutations.js";
import type * as puzzles_queries from "../puzzles/queries.js";
import type * as puzzles from "../puzzles.js";
import type * as system_scheduling from "../system/scheduling.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as users_statistics from "../users/statistics.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "actions/eventGeneration/critic": typeof actions_eventGeneration_critic;
  "actions/eventGeneration/generator": typeof actions_eventGeneration_generator;
  "actions/eventGeneration/orchestrator": typeof actions_eventGeneration_orchestrator;
  "actions/eventGeneration/reviser": typeof actions_eventGeneration_reviser;
  "actions/eventGeneration/schemas": typeof actions_eventGeneration_schemas;
  "actions/eventGeneration/values": typeof actions_eventGeneration_values;
  "actions/historicalContext": typeof actions_historicalContext;
  crons: typeof crons;
  events: typeof events;
  generationLogs: typeof generationLogs;
  "lib/alerts": typeof lib_alerts;
  "lib/errorSanitization": typeof lib_errorSanitization;
  "lib/eventValidation": typeof lib_eventValidation;
  "lib/llmClient": typeof lib_llmClient;
  "lib/logging": typeof lib_logging;
  "lib/migrationHelpers": typeof lib_migrationHelpers;
  "lib/observability": typeof lib_observability;
  "lib/orderScoring": typeof lib_orderScoring;
  "lib/puzzleHelpers": typeof lib_puzzleHelpers;
  "lib/puzzleType": typeof lib_puzzleType;
  "lib/responsesClient": typeof lib_responsesClient;
  "lib/streakCalculation": typeof lib_streakCalculation;
  "lib/streakHelpers": typeof lib_streakHelpers;
  "lib/workSelector": typeof lib_workSelector;
  "migration/anonymous": typeof migration_anonymous;
  "migrations/generateMissingContext": typeof migrations_generateMissingContext;
  "migrations/migrateEvents": typeof migrations_migrateEvents;
  "migrations/regenerateHistoricalContextGPT5": typeof migrations_regenerateHistoricalContextGPT5;
  "orderPlays/queries": typeof orderPlays_queries;
  orderPlays: typeof orderPlays;
  "orderPuzzles/generation": typeof orderPuzzles_generation;
  "orderPuzzles/mutations": typeof orderPuzzles_mutations;
  "orderPuzzles/queries": typeof orderPuzzles_queries;
  orderPuzzles: typeof orderPuzzles;
  "plays/queries": typeof plays_queries;
  "puzzles/context": typeof puzzles_context;
  "puzzles/generation": typeof puzzles_generation;
  "puzzles/mutations": typeof puzzles_mutations;
  "puzzles/queries": typeof puzzles_queries;
  puzzles: typeof puzzles;
  "system/scheduling": typeof system_scheduling;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "users/statistics": typeof users_statistics;
  users: typeof users;
}>;
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
