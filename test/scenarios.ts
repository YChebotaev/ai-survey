import request from "supertest";
import pino from "pino";
import knex, { type Knex } from "knex";
import path from "path";
import { createApp } from "../index";
import type { App } from "../src/lib/app/App";
import { seed } from "../seed";

type UserMessage = {
  text: string;
};

type TestScenario = {
  name: string;
  messages: UserMessage[];
  expectedData: Array<{
    key: string;
    type: "freeform" | "extracted";
    value: string;
  }>;
};

const EXTERNAL_ID_SCRUM_RU = "demo-scrum-daily-ru";

const createTestDb = async (): Promise<Knex> => {
  // Use in-memory database for tests
  const k = knex({
    client: "sqlite3",
    connection: {
      filename: ":memory:",
    },
    useNullAsDefault: true,
  });

  // Enable foreign keys for SQLite
  await k.raw("PRAGMA foreign_keys = ON");

  // Run migrations
  const migrationDir = path.join(process.cwd(), "src/lib/migrations");
  await k.migrate.latest({
    directory: migrationDir,
  });

  return k;
};

const runScenario = async (
  app: App,
  db: Knex,
  externalId: string,
  messages: UserMessage[],
): Promise<{ sessionId: number; reportData: any }> => {
  // Initialize session
  const initResponse = await request(app.fastify.server)
    .post(`/s/${externalId}/init`)
    .expect(200);

  const sessionId = initResponse.body.sessionId;
  expect(sessionId).toBeDefined();

  // Send each user message
  for (const message of messages) {
    const respondResponse = await request(app.fastify.server)
      .post(`/s/${externalId}/respond`)
      .send({
        sessionId,
        answerText: message.text,
      })
      .expect(200);

    // If survey is completed, break
    if (respondResponse.body.completed) {
      break;
    }
  }

  // Get the report using the demo endpoint
  const reportResponse = await request(app.fastify.server)
    .get(`/demo/report/${sessionId}`)
    .expect(200);

  const reportData = reportResponse.body.report;

  return { sessionId, reportData };
};

describe("Scrum Daily Survey Scenarios", () => {
  let app: App;
  let db: Knex;

  beforeAll(async () => {
    db = await createTestDb();
    
    // Seed the test database
    await seed(db);
    
    app = await createApp({
      db,
      logger: pino({ level: "silent" }),
    });

    await app.start({ host: "127.0.0.1", port: 0 });
  });

  afterAll(async () => {
    if (app) {
      await app.stop();
    }
    if (db) {
      await db.destroy();
    }
  });

  const scenarios: TestScenario[] = [
    {
      name: "Scenario 1 (simplest possible)",
      messages: [
        { text: "KCD-12" },
        { text: "KCD-14" },
        { text: "No, thanks" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "KCD-12" },
        { key: "todayPlan", type: "freeform", value: "KCD-14" },
        { key: "roadblocks", type: "freeform", value: "No, thanks" },
      ],
    },
    {
      name: "Scenario 2 (not simple)",
      messages: [
        { text: "Yesterday KCD-12" },
        { text: "Will continue" },
        { text: "No, thanks" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "Yesterday KCD-12" },
        { key: "todayPlan", type: "freeform", value: "Will continue" },
        { key: "roadblocks", type: "freeform", value: "No, thanks" },
      ],
    },
    {
      name: "Scenario 3 (tough)",
      messages: [
        { text: "Today KCD-12" },
        { text: "Will continue" },
        { text: "No, thanks" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "Today KCD-12" },
        { key: "todayPlan", type: "freeform", value: "Will continue" },
        { key: "roadblocks", type: "freeform", value: "No, thanks" },
      ],
    },
    {
      name: "Scenario 4",
      messages: [
        { text: "KCD-12 and 14" },
        { text: "KCD-15" },
        { text: "No, thanks" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "KCD-12 and 14" },
        { key: "todayPlan", type: "freeform", value: "KCD-15" },
        { key: "roadblocks", type: "freeform", value: "No, thanks" },
      ],
    },
    {
      name: "Scenario 5 (skipping)",
      messages: [
        { text: "Today KCD-12, tommorow KCD-13" },
        { text: "No, thanks" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "Today KCD-12, tommorow KCD-13" },
        { key: "todayPlan", type: "extracted", value: "KCD-13" },
        { key: "roadblocks", type: "freeform", value: "No, thanks" },
      ],
    },
    {
      name: "Scenario 6 (High Conscientiousness - Detailed)",
      messages: [
        { text: "Yesterday I completed the implementation of the user authentication module (KCD-12). I wrote unit tests covering 95% of the code, fixed 3 bugs related to session management, and updated the documentation. The code review was approved and merged to main branch." },
        { text: "Today I plan to start working on the payment integration feature (KCD-15). I'll begin by reviewing the API documentation, setting up the development environment, and creating the initial data models. I expect to complete the basic structure by end of day." },
        { text: "No blockers at the moment. Everything is proceeding as planned." },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "Yesterday I completed the implementation of the user authentication module (KCD-12). I wrote unit tests covering 95% of the code, fixed 3 bugs related to session management, and updated the documentation. The code review was approved and merged to main branch." },
        { key: "todayPlan", type: "freeform", value: "Today I plan to start working on the payment integration feature (KCD-15). I'll begin by reviewing the API documentation, setting up the development environment, and creating the initial data models. I expect to complete the basic structure by end of day." },
        { key: "roadblocks", type: "freeform", value: "No blockers at the moment. Everything is proceeding as planned." },
      ],
    },
    {
      name: "Scenario 7 (High Extraversion - Enthusiastic)",
      messages: [
        { text: "Hey! So yesterday was awesome! I finished KCD-12 and it's looking great! Really excited about this feature!" },
        { text: "Today I'm going to tackle KCD-14! Can't wait to get started, it's going to be fun!" },
        { text: "Nope, all good! Everything is smooth sailing!" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "Hey! So yesterday was awesome! I finished KCD-12 and it's looking great! Really excited about this feature!" },
        { key: "todayPlan", type: "freeform", value: "Today I'm going to tackle KCD-14! Can't wait to get started, it's going to be fun!" },
        { key: "roadblocks", type: "freeform", value: "Nope, all good! Everything is smooth sailing!" },
      ],
    },
    {
      name: "Scenario 8 (High Neuroticism - Anxious)",
      messages: [
        { text: "I worked on KCD-12 yesterday but I'm not sure if it's correct. I think there might be issues with it." },
        { text: "I'll try to continue with KCD-14 today, but I'm worried I might not finish it on time." },
        { text: "I'm concerned about the deadline. I don't know if I can make it." },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "I worked on KCD-12 yesterday but I'm not sure if it's correct. I think there might be issues with it." },
        { key: "todayPlan", type: "freeform", value: "I'll try to continue with KCD-14 today, but I'm worried I might not finish it on time." },
        { key: "roadblocks", type: "freeform", value: "I'm concerned about the deadline. I don't know if I can make it." },
      ],
    },
    {
      name: "Scenario 9 (Low Openness - Brief and Structured)",
      messages: [
        { text: "KCD-12" },
        { text: "KCD-14" },
        { text: "None" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "KCD-12" },
        { key: "todayPlan", type: "freeform", value: "KCD-14" },
        { key: "roadblocks", type: "freeform", value: "None" },
      ],
    },
    {
      name: "Scenario 10 (High Agreeableness - Collaborative)",
      messages: [
        { text: "Yesterday I helped Sarah with KCD-12. We pair-programmed and got it done together. Also reviewed John's PR for KCD-10." },
        { text: "Today I'll continue helping the team. I'm available to pair on KCD-14 if anyone needs help, or I can work on KCD-15 solo." },
        { text: "No blockers, but I noticed the team might need some support on the new API integration. Happy to help!" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "Yesterday I helped Sarah with KCD-12. We pair-programmed and got it done together. Also reviewed John's PR for KCD-10." },
        { key: "todayPlan", type: "freeform", value: "Today I'll continue helping the team. I'm available to pair on KCD-14 if anyone needs help, or I can work on KCD-15 solo." },
        { key: "roadblocks", type: "freeform", value: "No blockers, but I noticed the team might need some support on the new API integration. Happy to help!" },
      ],
    },
    {
      name: "Scenario 11 (All-in-One - High Efficiency)",
      messages: [
        { text: "Yesterday: KCD-12 done. Today: KCD-14 and KCD-15. Blockers: waiting for API access from DevOps." },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "Yesterday: KCD-12 done. Today: KCD-14 and KCD-15. Blockers: waiting for API access from DevOps." },
        { key: "todayPlan", type: "extracted", value: expect.stringContaining("KCD-14") },
        { key: "roadblocks", type: "extracted", value: expect.stringContaining("API access") },
      ],
    },
    {
      name: "Scenario 12 (Ambiguous Time References)",
      messages: [
        { text: "I did KCD-12" },
        { text: "Will do KCD-14" },
        { text: "Nothing blocking" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "I did KCD-12" },
        { key: "todayPlan", type: "freeform", value: "Will do KCD-14" },
        { key: "roadblocks", type: "freeform", value: "Nothing blocking" },
      ],
    },
    {
      name: "Scenario 13 (Mixed Format - Casual)",
      messages: [
        { text: "yday: KCD-12, fixed some bugs too" },
        { text: "gonna work on KCD-14 today" },
        { text: "nah, all good" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "yday: KCD-12, fixed some bugs too" },
        { key: "todayPlan", type: "freeform", value: "gonna work on KCD-14 today" },
        { key: "roadblocks", type: "freeform", value: "nah, all good" },
      ],
    },
    {
      name: "Scenario 14 (Technical Details)",
      messages: [
        { text: "Completed KCD-12: implemented OAuth2 flow, added JWT token validation, wrote integration tests. Deployed to staging." },
        { text: "Starting KCD-14: need to refactor the database schema, add migration scripts, update ORM models." },
        { text: "Blocked on KCD-14: waiting for DBA approval on schema changes. Estimated delay: 2 days." },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "Completed KCD-12: implemented OAuth2 flow, added JWT token validation, wrote integration tests. Deployed to staging." },
        { key: "todayPlan", type: "freeform", value: "Starting KCD-14: need to refactor the database schema, add migration scripts, update ORM models." },
        { key: "roadblocks", type: "freeform", value: "Blocked on KCD-14: waiting for DBA approval on schema changes. Estimated delay: 2 days." },
      ],
    },
    {
      name: "Scenario 15 (Negative Response - No Work)",
      messages: [
        { text: "Nothing yesterday, was in meetings all day" },
        { text: "Will start KCD-12 today" },
        { text: "No blockers" },
      ],
      expectedData: [
        { key: "yesterdayWork", type: "freeform", value: "Nothing yesterday, was in meetings all day" },
        { key: "todayPlan", type: "freeform", value: "Will start KCD-12 today" },
        { key: "roadblocks", type: "freeform", value: "No blockers" },
      ],
    },
  ];

  scenarios.forEach((scenario) => {
    test(scenario.name, async () => {
      const { reportData } = await runScenario(
        app,
        db,
        EXTERNAL_ID_SCRUM_RU,
        scenario.messages,
      );

      // Validate that reportData has a "data" array
      expect(reportData).toHaveProperty("data");
      expect(Array.isArray(reportData.data)).toBe(true);

      // Validate each expected data entry
      for (const expected of scenario.expectedData) {
        // Find all entries with this key (there might be multiple extracted entries)
        const dataEntries = reportData.data.filter(
          (d: any) => d.key === expected.key && d.type === expected.type,
        );

        expect(dataEntries.length).toBeGreaterThan(0);
        
        // For "freeform" type, there should be exactly one entry
        if (expected.type === "freeform") {
          expect(dataEntries.length).toBe(1);
        }

        const dataEntry = dataEntries[0];
        expect(dataEntry).toHaveProperty("id");
        expect(dataEntry).toHaveProperty("key", expected.key);
        expect(dataEntry).toHaveProperty("type", expected.type);
        expect(dataEntry).toHaveProperty("value");
        expect(typeof dataEntry.value).toBe("string");
        
        // Handle dynamic expectations (using expect.stringContaining)
        if (expected.value && typeof expected.value === "object" && "asymmetricMatch" in expected.value) {
          // Jest matcher like expect.stringContaining
          expect(dataEntry.value).toEqual(expected.value);
        } else if (scenario.name === "Scenario 5 (skipping)" && expected.key === "todayPlan") {
          // For scenario 5, todayPlan might be extracted differently
          expect(dataEntry.value.toLowerCase()).toContain("kcd-13");
        } else if (scenario.name === "Scenario 11 (All-in-One - High Efficiency)") {
          // For scenario 11, check that extracted values contain expected content
          if (expected.key === "todayPlan") {
            expect(dataEntry.value.toLowerCase()).toMatch(/kcd-1[45]/);
          } else if (expected.key === "roadblocks") {
            expect(dataEntry.value.toLowerCase()).toMatch(/api|devops|access/);
          } else {
            expect(dataEntry.value).toBe(expected.value);
          }
        } else {
          expect(dataEntry.value).toBe(expected.value);
        }
      }

      // Ensure all expected keys are present
      const dataKeys = reportData.data.map((d: any) => d.key);
      const expectedKeys = scenario.expectedData.map((e) => e.key);
      for (const key of expectedKeys) {
        expect(dataKeys).toContain(key);
      }
    });
  });
});
