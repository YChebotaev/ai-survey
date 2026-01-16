# Design overview

This app is intended to serve as backend-microservice, called ai-survey (working title)

The purpose of this service is to conduct surveys in chat manner but with questions asked by ai

How microservice works from bird's view:

1. Service are integrated in some manner, let's say to the site as a chat-bot
2. User of the site enters and starts conversation in the chat-bot window, starting survey session
3. Chat widget have questionary id where stored the question templates one-after-another
4. Widget sends request to initiate chat and ai-survey sends first question from survey
5. The question tempate passes throu AI (let's say DeepSeek or ChatGPT) and reformulate original template
6. The questions sends in response to initiate request and shows to user via widget
7. User enters response to question and hit "send"
8. This response is passed throu AI with original question and extracts meaningful data what actual answering to meaning of the question
9. This data are saved as response
10. (Alternative) If answer not contain meaningful data, the ai-syrvey sends `failTemplate` with combination of question again
11. Ai-survey sends `successTemplate` combined with next question and then, steps 7-11 repeats until question with `final` flag in this case, step 12 are performed
12. Question with `final` flag will just send it's `successTemplate` and chat session are closed
13. All anwsers should be saved in database

Well, this is a glimpse how architecture of a project are aligned

# Coding standards

## Import order

1. First go node core modules
2. Then, libraries imports
   2.1. If needs type import from library alongside with object import, it goes here

```typescript
import knex, { type Knex } from "knex";
```

3. Then, goes "../" imports
   3.1. Most distant imports goes lastest
   3.2. Types imports alongside with object imports goes here also

```typescript
import foo from "./foo";
import bar from "../bar";
```

4. Then, goes type-only imports from libraries:

```typescript
import type { Knex } from "knex";
```

5. Then, goes type-only imports from local files

```typescript
import type { Foo } from "./types";
import type { Bar } from "../types";
```

## Exports convention

Everything should be exported

No naming clash allowed

By importing "./lib" I should be able import every possible classes inside all of the tree

Use bare exports `export * from './foo'`

File name must match the exported class name or function name (if exported function are singular)

One file = one class

camelCase in file names

PascalCase in class names

Use snake-case in folder names

Each folder should contain bare export `index.ts`

Prefer to include single function to each file

Types closely related to class should lay in same file and be exported

Common for whole app types are located in `lib/types`

Functions should be defined as `export const foo = () => {}`, not as function declarations

Classes should be defined as `export class Foo {}`

## Dependency injection

Class should generally accept single config parameter as first argument and no more

```typescript
export type FooConfig = {};

export class Foo {
  constructor({}: FooConfig) {}
}
```

Sometimes possible to pass additioan arguments in class before config, in this case, config should go last

```typescript
export type FooConfig = {};

export class Foo {
  constructor(fastify: FastifyInstance, {}: FooConfig) {}
}
```

Most of the classes should accept and store in `this` a `logger` instance

```typescript
import type { Logger } from "pino";

export type FooConfig = {
  logger: Logger;
};

export class Foo {
  private readonly logger: Logger;

  constructor({ logger }: FooConfig) {
    this.logger = logger;
  }
}
```

Logger always go last in `*Config` types, in class definition and in a constuctor's destructuring

Only thing that may go after logger in class definition is `ready: Promise<void>` or `_ready`:

```typescript
import type { Logger } from "pino";

export type FooConfig = {
  logger: Logger;
};

export class Foo {
  private readonly logger: Logger;
  private readonly ready: Promise<void>;

  constructor({ logger }: FooConfig) {
    this.logger = logger;
    this.ready = this.initialize(config);
  }

  private async initialize({}: FooConfig) {}
}
```

All meaningful actions should be logged

If class are depends on another class, it should be passed as parameter in config (same as `logger`)

```typescript
import type { Logger } from "pino";

export type FooConfig = {
  myRepository: MyRepository;
  logger: Logger;
};

export class Foo {
  private readonly myRepository: MyRepository;
  private readonly logger: Logger;

  constructor({ myRepository, logger }: FooConfig) {
    this.myRepository = myRepository;
    this.logger = logger;
  }
}
```

Well, this means if dependency needed on multiple levels of code it should pass explicitely (props drilling)

Dependencies must generally pass of most generic to most concrete instances all the way down

Sometimes it's possible to construct dependencies in constructor:

```typescript
class Foo {
  constructor() {
    this.bar = new Bar();
  }
}
```

In such case, a config of parent class should accept a config of a child class as a config prop:

```typescript
import { Bar, type BarConfig } from "../bar";

export type FooConfig = {
  bar: BarConfig;
};

class Foo {
  constructor({ bar }: FooConfig) {
    this.bar = new Bar(bar);
  }
}
```

## Class shape

Explicit visibility modfiers for each of class members

If class are base class intended to be inherited, it should ends with `*Base`

Try to use `private readonly` as often as possible

If class intended to be inherited, don't bother to use `protected` modifier

First go `private` fields

Then go `public` fields separated by newline

Then go static methods

Then go `constructor`

Then go `public` getters/setters

Then go `public` methods

Then go `protected` methods

Then go `private` methods

Sometimes, if method are used as callback to a function, it should be initialized as function expression

If method calls another methods, they should go after this method and in order of call

### Example of all above:

```typescript
class Foo {
  private readonly priv1;
  private readonly priv2;

  public readonly pub1;
  public readonly pub2;

  public static fromJSON() {}

  constructor() {}

  public pubMet1() {
    await this.pubMet2();

    return this.privMet1();
  }

  public async pubMet2() {}

  private async privMet1() {}
}
```

## Defensive programming

Generally, application is a web-service which processes multiple requests, so:

Application as a whole should generally not fail

The only permitted way to fail-fast is misconfiguration which checked as soon as app started

If something configured at a run-time, it also should not fail

If something configured at start-time and/or first few seconds after start, it may fail

So, try-catches, null-and-undefined-checks, checks for empty values should be performed

App uses try-cathces for all external network and database access

Every external input should be validated and parsed

Most of the time external input is something that comes by network

Don't trust data blindly, validate it before use

Every error are logged as `this.logger.error(error, "Optional message")`

If error are not fatal, it should not move app in failing mode

If some of the shared resources are aquired, they should be freed on error

Use try-catch blocks extensively

Treat `null` and `undefined` as same (`if (foo == null) ...`)

Generally, trust types that goes from TypeScript, do not defence against it

Try to reduce overloading as much as possible

Methods should generally accept 0-3 arguments

And prefer to pass method argumens as object and then destructure them

Try to be wise about object vs parameter dillema:

If method's parameters count may be extended in the future, prefer to pass them as object

If method's parameters are simple and/or not intendend to extend, pass as direct parameter

# Files with special meanings

This project is a part of virtual-monorepo

A single folder of a project as a whole contains folders for microservices

But microservices are distinct repositories

There are not unified build-step for project as a whole

So, some unification takes place

Even if project are not bundled, `src` folder exists in case if project are actually will be bundled

`lib` is default node location for everything

`index.js` is a special file that pretends like project may be linked outside (in case if it will be bundled)

The exports of `index.js` should provide configuration in broad sense

`server.js` is actual entry-point of application

The project generally consists of `services`

App consists of three main building blocks: services, repositories and fastify plugins

Service is a business-logic block. It may be reusable or ad-hoc

Service may be referenced from another service or from plugin

Generally, only one instance of service are in app, them are singletons

Service must pass as a dependency as described in a "Dependency injection" chapter

Repositories abstracts database calls from other modules

Generally, only service may call repository's methods

(But, in simple cases, it may be exclusion)

Most of the time, service method corresponds with repository method, but:

Service method are business-action and may leverage another services or multiple repositories

Repository methods are intended to only ensure database correctness

Repositories should not call another repositories

A fastify plugin is a place where http-handlers are configured

Most of the time handler calls single method of service

But it actually may call multiple services

Handler abstract parameters fetching; parameters may come from different places: body, props or query, in handler every source are unified into a single service method call, most of the time with config methods

Each service must be extended from `ServiceBase`

Each repository must be extended from `RepositoryBase`

And each plugin must be extended from `PluginBase`

# Repositories

A repositort is a special object that abstracts database access from other parts of the apps

As a rule of thumb repository are invoked from services

Most of the repositories follow simple rules:

A repository class file also exports a type of record, this repository handles

Most of the repositories have following methods:

```typescript
import { BaseRepository, type BaseRepositoryConfig } from "./BaseRepository";

export interface FooRepositoryConfig extends BaseRepositoryConfig {}

export type Foo = {
  id: number;
  bar: string;
  baz: string;
  deleted: boolean | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

export type FooCreateArgs = Omit<
  Foo,
  "id" | "deleted" | "createdAt" | "updatedAt" | "deletedAt"
>;

export class FooRepository extends BaseRepository<AccountsRepositoryConfig> {
  public async create({}: FooCreateArgs) {}

  public async getById(id: Foo["id"]) {}

  public async deleteById(id: Foo["id"]) {}

  public async findByBar(bar: Foo["bar"]) {}

  public async findByFooAndBar(foo: Foo["foo"], bar: Foo["bar"]) {}
}
```

As You can see, basic functionality of repository is to create, get or delete entities

Entities are anemic: they not contain any methods and represended as plain-old-js-objects

Entities are passed around from and to services

`*CreateArgs` are inherited by omitting some of the keys of entity type

There are generally no rich filter functionality, so `find*` methods are constructed by joining them with `And`

But, in reality filters will be, so...

# Models of the project

All models have common props:

```js
createdAt: string; // Date in ISO format
updatedAt: string | null; // Date in ISO format, not filled when record just created
deletedAt: string | null; // Date in ISO format, not filled if record not deleted
deleted: boolean; // False until deleted
```

```js
Account(id, name)
User(id, name, email, phone, passwordHash, passwordSalt)
AccountMembership(id, accountId, userId, role = "admin" | "owner")
AccountInvite(id, accountId, email, phone, telegram)
Project(id, accountId, name)
ProjectMembership(id, accountId, userId, projectId, role = "admin" | "owner")
Survey(id, accountId, projectId, externalId /* Special token which with client are integrated by */, lang)
QuestionTemplate(
  id,
  accountId,
  projectId,
  order,
  surveyId,
  questionTemplate,
  successTemplate,
  failTemplate,
  final: boolean,
  type = "freeform",
)
SurveySession(id, accountId, projectId, surveyId, sessionState: JSON)
SessionMessage(
  id,
  accountId
  projectId
  surveyId
  sessionId
  order: number // Index within session. From 0 to initial agent's message
  partialReport: JSON
  author: "agent" | "client"
  text: string
)
SessionReport(
  id,
  accountId,
  projectId,
  surveyId,
  sessionId,
  data: JSON // All the data gathered within session combined
)
```

`SessionReport` are live-updated: it means with each new interaction, it's data are updated

# Repositories of the project

For now (MVP), most of repositories allow only creation of records

```js
AccountRepository(create)
UserRepository(create)
AccountMembershipRepository(create)
AccountInviteRepository(create)
ProjectRepository(create)
SurveyRepository(create)
QuestionTemplateRepository(create)
SurveySessionRepository(create)
SurveyMessageRepository(create, getById)
SessionReportRepository(create)
```

# Services of the project

```js
IamService(
  createAccount
  createUser
  joinUserToAccount
)
InviteService(
  createInvite
  sendInvite
)
ProjectsService(
  createProject
  joinUserToProject
  createSurvey // One big object with all of the data
)
SurveySessionService(
  startSession
  endSession
  getNextQuestion
  addQuestionAnswer
  listReports
  getReport
  getConversationData
  getConversation
)
```

# Public routes of the project

Authz are performed by JWT where current user are coded

```bash
POST /iam/registration # For now, creates user and account and joins this user into this account
POST /iam/token # Gets JWT token

GET /:accountId/projects # Lists projects that current user are member of
POST /:accountId/projects # Creates project
POST /:accountId/projects/:projectId/survey # Creates survey

POST /s/:externalId/init # Initial request to start conversation (externalId is Survey#externalId)
POST /s/:externalId/respond # Answer to question
```

# Combination logic

When `/init` request are received, it finds survey with highest order and passes through AI it's `questionTemplate` which sends in response

When `/respond` request are issued, it finds the original question and and next question and combines them into single messsage:

```js
```
${successTemplate}

${questionTemplate}
```
```

Where `successTemplate` goes from question on which it's answer at

And `questionTemplate` is next question's

# Ai service

For now, it's a mock service, but we can shape interface

```typescript
AiService(
  rephraseQuestion(question)
  rephraseCompletion(text)
  combineSuccessWithQuestion(
    success,
    question
  )
  combineFailWithQuestion(
    fail,
    question
  )
  extractData(text): JSON // In this JSON data should be stored by dataKey
)
```

Logic is following:

1. On initial message first question are issued and it's rephrased using `rephraseQuestion`
2. In response if `extractData` are successfully extracts meaningful data, success of current question and question text of next question are combined (and rephrased)
3. If can't `extractData`, the fail of current question are issued and question are combined and repeated
4. If question with `final` flag, the `successTemplate` are rephrased using `rephraseCompletion`

For now, for mocking purposes combine messages with just an empty newline. If message are just rephrased, just return passed text

# Report shape

This is endpoint-output report shape

In reality, report should be formed from two sources:

1. `getConversation` method of `SurveySessionService`
2. `getConversationData` method of same service

```typescript
{
  conversation: [
    {
       id: string, // random id
       author: string // "agent" | "client"
       text: string // Text of question if author agent and answer if author client
       dataId?: string // And id of record in "data" array in same report
    }
  ],
  data: [
    {
       id: string // random id
       key: string // dataKey,
       value: string,
       type: string // Type of the question, "freeform" or "extracted" for now
    }
  ]
}
```

In contrary with question type, "type" of data record may be (for now):

1. "freeform" when all data of the reply goes into data
2. "extracted" when only portion of reply fills data

"freeform"'s "key" alsways unqie within array

But "extracted" may have duplicate keys but different ids

For example:

In this scrum scenario if user answer questions one by one, his answers goes as freeform data records and it's ok

But if client provides all necessary data in first message, all of the records will be type: "extracted" and may be duplicated keys if user have much to say

In case if user provides yesterdayWork and todayPlan in first reply, then waits for question about roadblock and ansers it in the second reply, the first two data should be type extracted and last (roadblock) should be freeform

# Chat testing scenarios

Only replies of client are provided:

Scenario 1 (simplest possible):
1. KCD-12
2. KCD-14
3. No, thanks

Scenario 2 (not simple):
1. Yesterday KCD-12
2. Will continue
3. No, thanks

Scenario 3 (tough):
1. Today KCD-12
2. Will continue
3. No, thanks

Scenario 4:
1. KCD-12 and 14
2. KCD-15
3. No, thanks

Scenario 5 (skipping):
1. Today KCD-12, tommorow KCD-13
2. No, thanks
