# Hive Roadmap Aggregator API – The Hive (Minecraft Bedrock)

> **Node.js/Express** API for aggregating, normalizing and re-exposing **The Hive** roadmap (Featurebase) — with status-wise aggregation, full-page crawling, structured responses, and webhook dispatch with HMAC signatures. Designed as a thin, read-optimized façade over `updates.playhive.com`.

[![Runtime](https://img.shields.io/badge/runtime-Node.js_18%2B-339933?logo=node.js)](#)
[![Framework](https://img.shields.io/badge/framework-Express-000?logo=express)](#)
[![OpenAPI](https://img.shields.io/badge/docs-/api-docs-blue)](#)
[![Source](https://img.shields.io/badge/upstream-Featurebase-purple)](#)
[![Status](https://img.shields.io/badge/stability-experimental-yellow)](#)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Quickstart](#quickstart)
- [Configuration (Environment)](#configuration-environment)
- [Runtime & Architecture](#runtime--architecture)
- [Security Model](#security-model)
- [HTTP API](#http-api)
  - [Global Conventions](#global-conventions)
  - [Routes Summary](#routes-summary)
  - [Routes — Detailed Reference](#routes--detailed-reference)
  - [Usage Examples (cURL)](#usage-examples-curl)
- [Pagination & Aggregation](#pagination--aggregation)
- [Error Model](#error-model)
- [Rate Limiting](#rate-limiting)
- [Webhooks](#webhooks)
- [OpenAPI & Swagger UI](#openapi--swagger-ui)
- [Logging](#logging)
- [Data Model (Normalized Item)](#data-model-normalized-item)
- [Directory Layout](#directory-layout)
- [Development & Utilities](#development--utilities)
- [Performance Notes](#performance-notes)
- [Deployment](#deployment)
  - [Docker](#docker)
  - [docker-compose](#docker-compose)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [License](#license)

---

## Overview

**Hive Roadmap Aggregator API** provides a clean, REST-style wrapper around **The Hive** public roadmap hosted on `updates.playhive.com` (Featurebase).

Instead of hitting Featurebase endpoints directly and dealing with pagination, filters and raw structures, this service:

- Crawls **all roadmap columns** (statuses) with full pagination
- Normalizes each card into a rich, consistent shape
- Exposes **status snapshots** and a **global aggregate** view
- Emits **webhook events** when snapshots are requested with `broadcast=true`
- Resolves human-friendly **public card URLs** by slug

The service is read-only and stateless (no database), using only in-memory structures and upstream HTTP calls with keep-alive agents for throughput.

---

## Key Features

- 🌐 **Featurebase wrapper** for `updates.playhive.com` organization `hivegameslimited`
- 🧱 **Structured roadmap metadata**: organization, statuses, and roadmaps
- 📊 **Status snapshots**: collect all cards for a given status id in one call
- 🧮 **Aggregate snapshots**: all active (or all) statuses in a single response
- 🔗 **Public URL resolution**: `slug → https://updates.playhive.com/en/p/<slug>`
- 🧾 **Rich normalized item model**: status, category, tags, URLs, timestamps, stats
- 📡 **Webhooks**: `roadmap.status.snapshot`, `roadmap.aggregate.snapshot`, `webhook.test`
- 🔑 **HMAC signatures** on webhook deliveries (HMAC-SHA256 over body+secret)
- ⚙️ **Configurable** via environment (timeouts, rate limits, webhook defaults)
- 🛡️ **Helmet + CORS + rate limiting** for sane defaults
- 📘 **OpenAPI 3.0 spec** and **Swagger UI** at `/openapi.json` and `/api-docs`

---

## Quickstart

```bash
# 1) Clone & install
git clone https://github.com/Daniel-Ric/Hive-Roadmap-API.git
cd Hive-Roadmap-API
npm ci

# 2) Configure environment
cp .env.example .env
# IMPORTANT: at least review HIVE_BASE_URL, HIVE_ORGANIZATION_SLUG, WEBHOOK_DEFAULT_SECRET

# 3) Start (development)
NODE_ENV=development node src/server.js

# 4) Production (example)
NODE_ENV=production LOG_PRETTY=false SWAGGER_ENABLED=false node src/server.js
```

**Base URL** (default): `http://localhost:8095`

---

## Configuration (Environment)

The service validates environment variables on startup using Joi in `src/config/env.js`.  
If validation fails, the process exits with a descriptive error.

### General

| Variable       | Default      | Description                                               |
| -------------- | ------------ | --------------------------------------------------------- |
| `PORT`         | `8095`       | HTTP port                                                 |
| `NODE_ENV`     | `development`| `development` \| `production` \| `test`                   |
| `CORS_ORIGIN`  | `*`          | Comma-separated origins; `*` allows all                  |
| `LOG_PRETTY`   | `true`       | Colored, human-readable logs in development              |
| `SWAGGER_ENABLED` | `true`    | Serve Swagger UI and `/openapi.json`                     |
| `SWAGGER_SERVER_URL` | —      | Optional explicit server URL in OpenAPI                  |
| `TRUST_PROXY`  | `loopback`   | Express `trust proxy` setting                             |

### Hive / Featurebase

| Variable                 | Default                        | Description                                               |
| ------------------------ | ------------------------------ | --------------------------------------------------------- |
| `HIVE_BASE_URL`          | `https://updates.playhive.com` | Base URL of the Hive updates portal                       |
| `HIVE_ORGANIZATION_SLUG` | `hivegameslimited`             | Organization slug (`name` field from `/api/v1/organization`) |

### HTTP & Webhooks

| Variable                     | Default | Description                                   |
| ---------------------------- | ------- | --------------------------------------------- |
| `HTTP_TIMEOUT_MS`            | `15000` | Default timeout for upstream HTTP calls (ms)  |
| `WEBHOOK_HTTP_TIMEOUT_MS`    | `5000`  | Timeout for webhook HTTP deliveries (ms)      |
| `WEBHOOK_DEFAULT_SECRET`     | —       | Default HMAC secret for webhooks (must be set in prod) |

### Rate Limiting

| Variable                          | Default | Description                                                |
| --------------------------------- | ------- | ---------------------------------------------------------- |
| `GLOBAL_RATE_LIMIT_WINDOW_MS`     | `60000` | Global rate limit window (ms)                             |
| `GLOBAL_RATE_LIMIT_MAX`           | `600`   | Max requests per window per IP                            |
| `ROADMAP_RATE_LIMIT_WINDOW_MS`    | `60000` | Window for heavy roadmap endpoints (aggregate, status)    |
| `ROADMAP_RATE_LIMIT_MAX`          | `60`    | Max heavy roadmap requests per window per IP              |
| `WEBHOOK_RATE_LIMIT_WINDOW_MS`    | `60000` | Window for `/webhooks` management & test                  |
| `WEBHOOK_RATE_LIMIT_MAX`          | `60`    | Max webhook operations per window per IP                  |

> See `src/config/env.js` and `.env.example` for the definitive list and defaults.

---

## Runtime & Architecture

```text
Client ───► Express (app.js)
              │
              ├─ middleware
              │   ├─ CORS, helmet, compression
              │   ├─ rate limiting
              │   └─ structured error handler
              │
              ├─ /roadmap routes
              │      └─ hive.service.js
              │            ├─ getOrganization()
              │            ├─ getRoadmapMetadata()
              │            ├─ getStatusItems()
              │            ├─ getAggregateRoadmap()
              │            ├─ getSubmissionById()
              │            └─ buildPublicSlugUrl()
              │
              └─ /webhooks routes
                     └─ webhook.service.js
                           ├─ in-memory registry
                           ├─ signWebhookPayload()
                           ├─ dispatchWebhook()
                           └─ testWebhook()
```

**Highlights**

- A single **Axios instance** (`utils/http.js`) with HTTP/HTTPS keep-alive agents for all upstream requests.
- **Request context** via `AsyncLocalStorage` to propagate a `requestId` into upstream headers (`x-correlation-id`).
- **Centralized error model** via `HttpError` and `errorHandler` middleware.
- No external database: webhooks are stored in memory (per-process).

---

## Security Model

This service is primarily intended to expose a **read-only** view of an already public roadmap.

- No JWT or user-level authentication by default.
- CORS is restricted via `CORS_ORIGIN` – in production you should set this to trusted frontends only.
- Helmet is enabled with a relaxed CSP and cross-origin resource policy to keep Swagger UI working.
- Rate limiting is used to avoid abuse on heavy endpoints.  
- Webhook secrets are never returned once stored; only the presence of a secret is visible.

If you deploy this on the public Internet, you should:

- Restrict CORS origins
- Place it behind a reverse proxy or API gateway with IP filtering / WAF
- Optionally add your own auth middleware (e.g. API keys, JWT) around the routers

---

## HTTP API

### Global Conventions

- All responses are JSON: `Content-Type: application/json; charset=utf-8`
- Errors follow a unified shape (see [Error Model](#error-model)).
- `X-Request-Id` is echoed back if provided on the request; otherwise a random UUID is generated.
- Paths are **read-only** – there is no mutation of upstream roadmap data.

### Routes Summary

#### Health

| Method | Path        | Description                        |
| ------ | ----------- | ---------------------------------- |
| GET    | `/healthz`  | Liveness probe (`{ "ok": true }`)  |
| GET    | `/readyz`   | Readiness probe (`{ "ready": true }`) |

#### Roadmap Meta

| Method | Path                  | Description                                             |
| ------ | --------------------- | ------------------------------------------------------- |
| GET    | `/roadmap/organization` | Raw organization snapshot from Featurebase            |
| GET    | `/roadmap/meta`       | Normalized roadmap metadata (org, statuses, roadmaps)  |
| GET    | `/roadmap/statuses`   | List of post statuses (IDs, names, colors, types)      |

#### Roadmap Items & Aggregation

| Method | Path                               | Description                                         |
| ------ | ---------------------------------- | --------------------------------------------------- |
| GET    | `/roadmap/status/{statusId}/items` | Full snapshot of items for a single status          |
| GET    | `/roadmap/aggregate`               | Aggregated snapshot across multiple statuses        |
| GET    | `/roadmap/item/{id}`               | Single item by internal submission id               |
| GET    | `/roadmap/item/by-slug/{slug}`     | Resolve slug to public URL                          |

#### Webhooks

| Method | Path               | Description                               |
| ------ | ------------------ | ----------------------------------------- |
| GET    | `/webhooks`        | List registered webhooks                  |
| POST   | `/webhooks`        | Register a new webhook                    |
| GET    | `/webhooks/{id}`   | Get webhook by id                         |
| DELETE | `/webhooks/{id}`   | Delete webhook by id                      |
| POST   | `/webhooks/{id}/test` | Trigger a `webhook.test` event for a webhook |

#### OpenAPI & Docs

| Method | Path            | Description                          |
| ------ | --------------- | ------------------------------------ |
| GET    | `/openapi.json` | OpenAPI 3.0 spec (JSON)              |
| GET    | `/api-docs`     | Swagger UI (when `SWAGGER_ENABLED`)  |

---

## Routes — Detailed Reference

Below, `BASE=http://localhost:8095` (default dev port).

### Health

#### `GET /healthz`

Liveness check. Returns:

```json
{ "ok": true }
```

#### `GET /readyz`

Readiness check. Returns:

```json
{ "ready": true }
```

---

### Roadmap Meta

#### `GET /roadmap/organization`

Fetches the upstream organization object from Featurebase, focusing on roadmap-related fields.

- No parameters.
- Returns a structure similar to:

```json
{
  "organization": {
    "id": "673d13339c3ddf39e7042840",
    "slug": "hivegameslimited",
    "displayName": "The Hive",
    "color": "#4652f2",
    "baseUrl": "https://updates.playhive.com",
    "language": "en",
    "createdAt": "2024-11-19T22:37:39.937Z",
    "updatedAt": "2025-11-03T20:55:42.731Z",
    "roadmapStatuses": ["In Review", "In Progress", "Completed"],
    "postStatuses": [/* raw upstream */],
    "roadmaps": [/* raw upstream */]
  }
}
```

Use this endpoint if you want a view close to the original Featurebase structure.

---

#### `GET /roadmap/meta`

Returns a normalized snapshot of the roadmap configuration:

```json
{
  "organization": {
    "id": "673d13339c3ddf39e7042840",
    "slug": "hivegameslimited",
    "displayName": "The Hive",
    "color": "#4652f2",
    "baseUrl": "https://updates.playhive.com",
    "language": "en",
    "createdAt": "2024-11-19T22:37:39.937Z",
    "updatedAt": "2025-11-03T20:55:42.731Z"
  },
  "statuses": [
    {
      "id": "673d43a8b479f2dff6f8b74b",
      "name": "Coming Next...",
      "color": "Yellow",
      "type": "active",
      "isDefault": false
    }
  ],
  "roadmaps": [
    {
      "id": "673d13339c3ddf39e7042865",
      "name": "Main Roadmap",
      "slug": "main",
      "description": "",
      "color": "Blue",
      "items": [
        {
          "id": "673d42f17cf162b4547abd01",
          "title": "In Progress",
          "color": "Orange",
          "icon": {
            "value": "CodeIcon",
            "type": "predefined"
          },
          "filter": "s=673d43b2b479f2dff6f8b96e&sortBy=date%3Adesc&inReview=false"
        }
      ]
    }
  ]
}
```

---

#### `GET /roadmap/statuses`

Returns all known post statuses:

```json
{
  "count": 3,
  "statuses": [
    {
      "id": "673d43a8b479f2dff6f8b74b",
      "name": "Coming Next...",
      "color": "Yellow",
      "type": "active",
      "isDefault": false
    },
    {
      "id": "673d43b2b479f2dff6f8b96e",
      "name": "In Progress",
      "color": "Orange",
      "type": "active",
      "isDefault": true
    }
  ]
}
```

Use these IDs with `/roadmap/status/{statusId}/items`.

---

### Roadmap Items & Aggregation

#### `GET /roadmap/status/{statusId}/items`

Aggregates **all cards** for a particular status in one response.  
Internally, it:

1. Validates the `statusId` against the roadmap metadata.
2. Walks all pages of `GET /api/v1/submission` with `s={statusId}`.
3. Normalizes each submission.
4. Computes per-category counts.

**Parameters**

- `statusId` (path, required): ID from `/roadmap/statuses`
- `sortBy` (query, optional, default `upvotes:desc`): upstream sort expression
- `inReview` (query, optional, default `false`): filter by review status
- `includePinned` (query, optional, default `true`): whether to include pinned posts
- `broadcast` (query, optional, default `false`): if `true`, emits a webhook event

**Example**

```bash
curl -s "$BASE/roadmap/status/673d43a8b479f2dff6f8b74b/items"
```

**Response (shape)**

```json
{
  "organization": { /* org summary */ },
  "status": { /* status info */ },
  "totals": {
    "totalItems": 3,
    "totalResults": 3,
    "totalPages": 1,
    "pageSize": 10,
    "categories": [
      { "key": "Minigames", "name": "Minigames", "count": 2 },
      { "key": "Cosmetics", "name": "Cosmetics", "count": 1 }
    ]
  },
  "items": [/* normalized items, see model below */],
  "generatedAt": "2025-11-29T10:00:00.000Z"
}
```

If `broadcast=true`, a `roadmap.status.snapshot` webhook is dispatched after the snapshot is generated.

---

#### `GET /roadmap/aggregate`

Aggregates multiple statuses into a single snapshot.

**Parameters**

- `includeCompleted` (bool, default `true`): if `false`, filters out statuses with `type=completed`
- `sortBy` (string, default `upvotes:desc`)
- `inReview` (bool, default `false`)
- `includePinned` (bool, default `true`)
- `broadcast` (bool, default `false`): if `true`, dispatches `roadmap.aggregate.snapshot` webhook

**Example**

```bash
curl -s "$BASE/roadmap/aggregate?includeCompleted=false"
```

**Response (shape)**

```json
{
  "organization": { /* org summary */ },
  "totals": {
    "statuses": 2,
    "items": 123,
    "results": 123
  },
  "statuses": [
    {
      "status": { /* status info */ },
      "totals": {
        "totalItems": 50,
        "totalResults": 50,
        "totalPages": 5,
        "pageSize": 10
      },
      "items": [/* normalized items */]
    }
  ],
  "generatedAt": "2025-11-29T10:00:00.000Z"
}
```

---

#### `GET /roadmap/item/{id}`

Fetches a single submission by internal `id` and returns a normalized item.

This uses the upstream `GET /api/v1/submission?id={id}` endpoint and **does not** paginate.

- `id` (path, required): Featurebase submission id
- Returns `404` if the submission is not found.

**Example**

```bash
curl -s "$BASE/roadmap/item/67a0d545820a7bed38f0bcb6"
```

---

#### `GET /roadmap/item/by-slug/{slug}`

Resolves a card slug into a public URL on `updates.playhive.com`.

- Does **not** call the upstream API; it just composes the URL:

```bash
curl -s "$BASE/roadmap/item/by-slug/bedwars-season-4"
```

Response:

```json
{
  "slug": "bedwars-season-4",
  "url": "https://updates.playhive.com/en/p/bedwars-season-4"
}
```

---

### Webhooks

Webhooks allow you to be notified when snapshots are created or when you manually trigger tests.

#### Events

- `roadmap.status.snapshot` — emitted on `GET /roadmap/status/{statusId}/items?broadcast=true`
- `roadmap.aggregate.snapshot` — emitted on `GET /roadmap/aggregate?broadcast=true`
- `webhook.test` — emitted on `POST /webhooks/{id}/test`

#### Payload Shape

```json
{
  "id": "uuid-of-delivery",
  "type": "roadmap.status.snapshot",
  "timestamp": "2025-11-29T10:00:00.000Z",
  "payload": {
    "snapshot": { /* status or aggregate snapshot */ }
  }
}
```

#### Signature

Each POST includes an `x-hive-roadmap-signature` header:

```text
x-hive-roadmap-signature: sha256=<hex-hmac>
```

Where the HMAC is computed as:

```text
HMAC_SHA256(secret, JSON.stringify(body))
```

If the webhook has its own `secret`, that is used; otherwise `WEBHOOK_DEFAULT_SECRET` is used.

#### `GET /webhooks`

Returns:

```json
{
  "count": 1,
  "webhooks": [
    {
      "id": "45b6e1b3-6c60-4f60-9cd2-2b7ee4f81fa7",
      "url": "https://example.com/hive-webhook",
      "events": ["roadmap.status.snapshot","roadmap.aggregate.snapshot"],
      "active": true,
      "createdAt": "2025-11-29T10:00:00.000Z",
      "lastSuccessAt": null,
      "lastErrorAt": null,
      "lastError": null
    }
  ]
}
```

Secrets are **not** returned.

---

#### `POST /webhooks`

Registers a new webhook.

**Body**

```json
{
  "url": "https://example.com/hive-webhook",
  "events": ["roadmap.status.snapshot","roadmap.aggregate.snapshot"],
  "secret": "my-very-strong-secret",
  "active": true
}
```

- `url` (required): HTTPS URL strongly recommended.
- `events` (optional): list of events to subscribe to; if omitted, defaults to `["roadmap.status.snapshot","roadmap.aggregate.snapshot"]`.
- `secret` (optional): per-webhook secret; if omitted, `WEBHOOK_DEFAULT_SECRET` is used internally.
- `active` (optional, default `true`): whether deliveries are sent immediately.

Returns `201` with:

```json
{
  "webhook": { /* webhook object */ }
}
```

---

#### `GET /webhooks/{id}`

Returns a single webhook object:

```json
{
  "webhook": { /* webhook */ }
}
```

Returns `404` if not found.

---

#### `DELETE /webhooks/{id}`

Deletes a webhook by id.

Response:

```json
{
  "deleted": true,
  "id": "45b6e1b3-6c60-4f60-9cd2-2b7ee4f81fa7"
}
```

---

#### `POST /webhooks/{id}/test`

Triggers a `webhook.test` event to the given webhook URL.

Payload:

```json
{
  "id": "delivery-id",
  "type": "webhook.test",
  "timestamp": "2025-11-29T10:00:00.000Z",
  "payload": {
    "message": "This is a test webhook from Hive Roadmap API"
  }
}
```

Response:

```json
{
  "ok": true,
  "webhook": { /* webhook */ }
}
```

---

### Usage Examples (cURL)

```bash
BASE="http://localhost:8095"
```

**Fetch roadmap metadata**

```bash
curl -s "$BASE/roadmap/meta" | jq '.statuses'
```

**Fetch all items in "Coming Next..."**

```bash
COMING_NEXT_ID="673d43a8b479f2dff6f8b74b"

curl -s "$BASE/roadmap/status/$COMING_NEXT_ID/items" \
  | jq '.items[] | {id, title, upvotes: .stats.upvotes}'
```

**Fetch aggregate snapshot without completed**

```bash
curl -s "$BASE/roadmap/aggregate?includeCompleted=false" \
  | jq '.totals, .statuses[].status.name'
```

**Resolve slug to public URL**

```bash
curl -s "$BASE/roadmap/item/by-slug/bedwars-season-4"
```

**Register a webhook and broadcast a snapshot**

```bash
# Register webhook
curl -s -X POST "$BASE/webhooks" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/hive-webhook",
    "events": ["roadmap.status.snapshot"],
    "secret": "super-secret",
    "active": true
  }'

# Trigger snapshot + webhook
curl -s "$BASE/roadmap/status/$COMING_NEXT_ID/items?broadcast=true" > /dev/null
```

---

## Pagination & Aggregation

The upstream Featurebase API uses classic pagination (`page`, `limit`, `totalPages`, `totalResults`).  
This service hides that complexity:

- For **status snapshots** and **aggregate snapshots**, it:
  - Fetches page `1` to know `totalPages`.
  - Fetches the remaining pages in parallel.
  - Concatenates `results` and exposes:
    - `totalPages`
    - `totalResults`
    - `pageSize` (equals `limit` from upstream)

There is currently no client-facing pagination on these endpoints because the primary goal is **full snapshots** suitable for dashboards and bots.

If you want client-side paging, fetch the snapshot once and paginate locally.

---

## Error Model

All errors are normalized via `HttpError` and `errorHandler`.

**Shape**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Submission not found",
    "details": {
      "id": "67a0d545820a7bed38f0bcb6"
    },
    "stack": "..."  // only in non-production
  }
}
```

- `code` – machine-friendly error code (e.g., `BAD_REQUEST`, `NOT_FOUND`, `INTERNAL`).
- `message` – human-readable message.
- `details` – optional structured info (e.g. `{ statusId }`, `{ id }`).
- `stack` – only included when `NODE_ENV !== "production"`.

---

## Rate Limiting

Rate limiting is implemented via `express-rate-limit`:

- **Global limiter** (all routes):
  - Window: `GLOBAL_RATE_LIMIT_WINDOW_MS` (default 60s)
  - Max: `GLOBAL_RATE_LIMIT_MAX` (default 600)
  - Skips: `/healthz`, `/readyz`, and `/api-docs` routes

- **Roadmap-heavy limiter** (internally used around aggregate/status endpoints):
  - Window: `ROADMAP_RATE_LIMIT_WINDOW_MS`
  - Max: `ROADMAP_RATE_LIMIT_MAX`

- **Webhook management limiter**:
  - Window: `WEBHOOK_RATE_LIMIT_WINDOW_MS`
  - Max: `WEBHOOK_RATE_LIMIT_MAX`

When exceeding a limit, clients receive `429 Too Many Requests` with a JSON error body.

---

## Webhooks

See [Webhooks](#webhooks) section above for details.

### Signature Verification Example (Node.js)

```js
import crypto from "node:crypto";

function verifyHiveSignature(headerValue, body, secret) {
  if (!headerValue || !headerValue.startsWith("sha256=")) return false;
  const expected = headerValue.slice("sha256=".length);
  const computed = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(computed, "hex")
  );
}
```

---

## OpenAPI & Swagger UI

- **OpenAPI JSON**: `GET /openapi.json`
- **Swagger UI**: `GET /api-docs` (if `SWAGGER_ENABLED=true`)

The specification is generated via `swagger-jsdoc` in `src/utils/swagger.js` and includes:

- Detailed schemas (`OrganizationSummary`, `RoadmapStatus`, `RoadmapItem`, `StatusItemsSnapshot`, `AggregateSnapshot`, `Webhook`, etc.)
- Descriptions and examples for query/path parameters
- Error responses using a shared `ErrorResponse` schema

Use `/openapi.json` as a source for API clients (e.g., OpenAPI Generator).

---

## Logging

Logging is handled centrally in `src/app.js`:

- Each request has a **correlation id** (`X-Request-Id` or random UUID).
- On response, a log line is printed (unless muted for health/docs) including:
  - Time
  - Method
  - URL
  - Status (color-coded)
  - Latency
  - Short request id

Example (pretty mode):

```text
12:34:56 OK   GET /roadmap/aggregate 200 123ms #2c8751
```

In non-pretty mode (production), logs are simpler and easier to parse for log shippers.

---

## Data Model (Normalized Item)

Each upstream submission is normalized into a richer, predictable structure:

```ts
type RoadmapItem = {
  id: string;
  slug: string;
  title: string;
  status: {
    id?: string;
    name?: string;
    color?: string;
    type?: string;
    isDefault?: boolean;
  };
  category: {
    id?: string;
    key?: string;   // e.g. "Minigames"
    name?: string;  // localized, e.g. "Minigames"
    private: boolean;
  };
  tags: Array<{
    id?: string;
    name: string;
    color?: string;
    private: boolean;
  }>;
  organizationSlug: string; // "hivegameslimited"
  upvotes: number;
  eta: string | null;  // ISO date or null
  stats: {
    upvotes: number;
    comments: number;
    mergedSubmissions: number;
  };
  timestamps: {
    createdAt: string;        // ISO
    lastModified: string;     // ISO
    stalePostDate: string | null;
    lastUpvoted: string | null;
  };
  translations: {
    count: number;
    languages: string[];
  };
  urls: {
    public: string | null;    // https://updates.playhive.com/en/p/<slug>
    api: string;              // upstream submission URL with id param
  };
  meta: {
    categoryId?: string;
    inReview: boolean;
    isSpam: boolean;
    pinned: boolean;
    sourceLanguage?: string;
    sourceLanguageHash?: string;
  };
  raw: any; // full upstream payload (for advanced consumers)
};
```

---

## Directory Layout

```text
src/
  app.js               # Express app with middleware and route wiring
  server.js            # HTTP server bootstrap & graceful shutdown
  config/
    env.js             # Joi-based env validation and export
  routes/
    health.routes.js   # /healthz, /readyz
    roadmap.routes.js  # /roadmap/* endpoints
    webhook.routes.js  # /webhooks* endpoints
  services/
    hive.service.js    # Featurebase/Hive integration and normalization
    webhook.service.js # In-memory webhook registry and dispatcher
  middleware/
    error.js           # notFoundHandler, errorHandler
    rateLimit.js       # specialized rate limiters (if any)
  utils/
    http.js            # Axios instance with keep-alive & correlation-id
    httpError.js       # HttpError, badRequest, notFound, internal, ...
    context.js         # AsyncLocalStorage-based request context
    swagger.js         # Swagger / OpenAPI spec definition
```

---

## Development & Utilities

- Use `LOG_PRETTY=true` and `NODE_ENV=development` while iterating locally.
- For swagger changes, edit `src/utils/swagger.js` and restart the server.
- You can mock Featurebase/Hive by pointing `HIVE_BASE_URL` to a local HTTP server for tests.

Example for verbose debugging of upstream issues:

```bash
NODE_ENV=development LOG_PRETTY=true DEBUG=axios node src/server.js
```

---

## Performance Notes

- Upstream calls are parallelized when walking multiple pages for a status or across statuses for the aggregate endpoint.
- HTTP agents use keep-alive with shared agents for all calls.
- There is currently no persistent cache; clients are expected to cache the responses they care about (e.g. per-minute snapshot polling).

If you need heavier caching:

- Place a CDN or reverse proxy (e.g. Nginx, Varnish) in front and configure `Cache-Control` based on your use case.
- Add a memory or Redis-based cache layer around `getStatusItems` and `getAggregateRoadmap` in `hive.service.js`.

---

## Deployment

### Docker

Example `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=8095

EXPOSE 8095

CMD ["node", "src/server.js"]
```

### docker-compose

```yaml
version: "3.8"
services:
  hive-roadmap-api:
    build: .
    ports:
      - "8095:8095"
    environment:
      NODE_ENV: "production"
      PORT: 8095
      HIVE_BASE_URL: "https://updates.playhive.com"
      HIVE_ORGANIZATION_SLUG: "hivegameslimited"
      SWAGGER_ENABLED: "true"
      WEBHOOK_DEFAULT_SECRET: "change-me-in-prod"
      LOG_PRETTY: "false"
    restart: unless-stopped
```

For production, consider:

- Running multiple replicas behind a load balancer.
- Externalizing logs (stdout) into a centralized logging system.
- Storing webhook config externally if you need persistence beyond process lifetime.

---

## Troubleshooting

- **404 on `/roadmap/item/{id}`**  
  Ensure the ID comes from a live snapshot (`items[].id`) and not from an outdated dataset. If upstream no longer knows this id, a 404 is expected.

- **404 on `/roadmap/status/{statusId}/items`**  
  Status ID does not exist in `/roadmap/statuses`. Double-check ID spelling.

- **Slow `/roadmap/aggregate`**  
  This endpoint can be heavy: it walks all pages for every status. Reduce status count via `includeCompleted=false`, or cache the response on your side.

- **Webhooks not firing**  
  Make sure you call snapshot endpoints with `broadcast=true`. Verify your webhook `active` flag and URL. Check logs for errors.

- **Signature mismatch**  
  Make sure you’re using the correct secret (per-webhook or `WEBHOOK_DEFAULT_SECRET`) and that you compute HMAC-SHA256 over the exact JSON string body.

---

## FAQ

**Does this API modify The Hive roadmap?**  
No. It is strictly read-only and only consumes public endpoints.

**Is authentication supported?**  
Not built-in. You can wrap the routers with your own auth middleware (e.g. API keys, JWT) if needed.

**Can I filter aggregate snapshots by category or tag?**  
Not yet at the API level. You receive all items and can filter client-side.

**Can I change the language of content?**  
The API returns whatever the upstream Featurebase instance provides. Translations are exposed in the `raw` payload; the normalized model only tracks which languages exist.

**Does the API support SSE or push?**  
No native SSE; push-like behavior is achieved via webhooks triggered on demand (`broadcast=true`).

---

## License

This project wraps public endpoints of **The Hive** (`updates.playhive.com`).  
You are responsible for using this code and the upstream API in accordance with The Hive’s and Featurebase’s terms of service and any applicable legal requirements.
