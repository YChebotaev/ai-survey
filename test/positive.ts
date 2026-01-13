import request from "supertest";
import pino from "pino";
import path from "path";
import { mkdirSync } from "fs";
import knex, { type Knex } from "knex";
import { createApp } from "../index";
import type { App } from "../src/lib/app/App";

const createTestDb = async () => {
  // Use in-memory database for tests to avoid file permission issues
  const k = knex({
    client: "sqlite3",
    connection: {
      filename: ":memory:",
    },
    useNullAsDefault: true,
  });

  // Manually run all migrations since knex might have issues with TypeScript files
  try {
    // Import and run each migration manually (knex has issues with TypeScript migrations in tests)
    const migration1 = await import("../src/lib/migrations/00001_accounts");
    await migration1.up(k);
    
    const migration2 = await import("../src/lib/migrations/00002_users");
    await migration2.up(k);
    
    const migration3 = await import("../src/lib/migrations/00003_account_memberships");
    await migration3.up(k);
    
    const migration4 = await import("../src/lib/migrations/00004_account_invites");
    await migration4.up(k);
    
    const migration5 = await import("../src/lib/migrations/00005_projects");
    await migration5.up(k);
    
    const migration6 = await import("../src/lib/migrations/00006_project_memberships");
    await migration6.up(k);
    
    const migration7 = await import("../src/lib/migrations/00007_surveys");
    await migration7.up(k);
    
    const migration8 = await import("../src/lib/migrations/00008_question_templates");
    await migration8.up(k);
    
    const migration9 = await import("../src/lib/migrations/00009_survey_sessions");
    await migration9.up(k);
    
    const migration10 = await import("../src/lib/migrations/00010_session_questions");
    await migration10.up(k);
    
    const migration11 = await import("../src/lib/migrations/00011_session_answers");
    await migration11.up(k);
    
    const migration12 = await import("../src/lib/migrations/00012_session_reports");
    await migration12.up(k);
  } catch (error: any) {
    throw error;
  }

  return k;
};

describe("Positive flow test", () => {
  let app: App;
  let db: Knex;
  let accountId: number;
  let userId: number;
  let projectId: number;
  let surveyId: number;
  let externalId: string;
  let sessionId: number;

  beforeAll(async () => {
    db = await createTestDb();
    app = await createApp({
      db,
      logger: pino({ level: "silent" }),
    });

    // Use port 0 to get an available port
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

  test("should register a user", async () => {
    const response = await request(app.fastify.server)
      .post("/iam/registration")
      .send({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      });

    if (response.status !== 201) {
      console.error("Registration failed:", JSON.stringify(response.body, null, 2));
      throw new Error(`Registration failed with status ${response.status}: ${JSON.stringify(response.body)}`);
    }

    expect(response.body).toHaveProperty("account");
    expect(response.body).toHaveProperty("user");
    expect(response.body).toHaveProperty("membership");

    accountId = response.body.account.id;
    userId = response.body.user.id;

    expect(accountId).toBeDefined();
    expect(userId).toBeDefined();
  });

  test("should create a project", async () => {
    const response = await request(app.fastify.server)
      .post(`/${accountId}/projects`)
      .send({
        name: "Test Project",
      })
      .expect(201);

    expect(response.body).toHaveProperty("project");
    expect(response.body.project).toHaveProperty("id");
    expect(response.body.project.name).toBe("Test Project");

    projectId = response.body.project.id;
    expect(projectId).toBeDefined();
  });

  test("should create a survey with three questions", async () => {
    externalId = `test-survey-${Date.now()}`;

    const response = await request(app.fastify.server)
      .post(`/${accountId}/projects/${projectId}/survey`)
      .send({
        externalId,
        questionTemplates: [
          {
            order: 1,
            dataKey: "name",
            questionTemplate: "What is your name?",
            successTemplate: "Thank you!",
            failTemplate: "Please provide your name.",
            final: false,
            type: "freeform",
          },
          {
            order: 2,
            dataKey: "email",
            questionTemplate: "What is your email?",
            successTemplate: "Great!",
            failTemplate: "Please provide a valid email.",
            final: false,
            type: "freeform",
          },
          {
            order: 3,
            dataKey: "feedback",
            questionTemplate: "Any feedback?",
            successTemplate: "Thank you for your feedback!",
            failTemplate: "Please provide feedback.",
            final: true,
            type: "freeform",
          },
        ],
      })
      .expect(201);

    expect(response.body).toHaveProperty("survey");
    expect(response.body.survey).toHaveProperty("id");
    expect(response.body.survey.externalId).toBe(externalId);

    surveyId = response.body.survey.id;
    expect(surveyId).toBeDefined();
  });

  test("should initialize a survey session", async () => {
    const response = await request(app.fastify.server)
      .post(`/s/${externalId}/init`)
      .expect(200);

    expect(response.body).toHaveProperty("sessionId");
    expect(response.body).toHaveProperty("question");
    expect(response.body.question).toBe("What is your name?");

    sessionId = response.body.sessionId;
    expect(sessionId).toBeDefined();
  });

  test("should answer first question", async () => {
    const response = await request(app.fastify.server)
      .post(`/s/${externalId}/respond`)
      .send({
        sessionId,
        answerText: "John Doe",
      })
      .expect(200);

    expect(response.body).toHaveProperty("message");
    expect(response.body.message).toContain("Thank you!");
    expect(response.body.message).toContain("What is your email?");
    expect(response.body).toHaveProperty("sessionId");
  });

  test("should answer second question", async () => {
    const response = await request(app.fastify.server)
      .post(`/s/${externalId}/respond`)
      .send({
        sessionId,
        answerText: "john@example.com",
      })
      .expect(200);

    expect(response.body).toHaveProperty("message");
    expect(response.body.message).toContain("Great!");
    expect(response.body.message).toContain("Any feedback?");
    expect(response.body).toHaveProperty("sessionId");
  });

  test("should answer final question and complete survey", async () => {
    const response = await request(app.fastify.server)
      .post(`/s/${externalId}/respond`)
      .send({
        sessionId,
        answerText: "This is great!",
      })
      .expect(200);

    expect(response.body).toHaveProperty("message");
    expect(response.body.message).toBe("Thank you for your feedback!");
    expect(response.body).toHaveProperty("completed");
    expect(response.body.completed).toBe(true);
  });

  test("should get report and validate data", async () => {
    // Query the database directly to get the report
    const report = await db("session_reports")
      .where({ sessionId, deleted: false })
      .first();

    expect(report).toBeDefined();
    expect(report).toHaveProperty("data");

    const reportData = JSON.parse(report.data);

    expect(reportData).toHaveProperty("name");
    expect(reportData.name).toBeDefined();
    expect(reportData.name).toHaveProperty("text");
    expect(reportData.name.text).toBe("John Doe");

    expect(reportData).toHaveProperty("email");
    expect(reportData.email).toBeDefined();
    expect(reportData.email).toHaveProperty("text");
    expect(reportData.email.text).toBe("john@example.com");

    expect(reportData).toHaveProperty("feedback");
    expect(reportData.feedback).toBeDefined();
    expect(reportData.feedback).toHaveProperty("text");
    expect(reportData.feedback.text).toBe("This is great!");
  });
});
