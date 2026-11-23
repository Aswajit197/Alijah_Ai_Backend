# Elijah AI — Architecture & Service Boundary Guide

> **Developer Reference Guide for Full-Stack & AI Engineers**  
> This document clarifies the exact responsibilities of **`backend/`** vs. **`AiService/`**, explains the migration of `/internal/v1/*` endpoints, lists active vs. retired components, and establishes a clear development decision matrix.

---

## 1. The Core Architecture: System of Record vs. System of Intelligence

| Feature | `backend/` (Core Business Server) | `AiService/` (AI & Voice Cluster) |
|---|---|---|
| **Role** | **System of Record (ERP & CRM)** | **System of Intelligence (AI & Audio)** |
| **Port** | **`5000`** (`http://localhost:5000`) | **`4002`** (Voice), **`4003`** (AI), **`4004`** (Workflow) |
| **Tech Stack** | Node.js (v22), Express, TypeScript, Prisma ORM | Python (FastAPI), Node.js, Temporal, Redis |
| **Primary Database** | **PostgreSQL on `5432`** (`elijah_db`) | **PostgreSQL on `5434`** (Voice & vector schemas) |
| **Data Owned** | Tenants, Users, Roles, Customers, Equipment, Official Work Orders (`JOB-XXXX`), Notifications | Audio recordings, Retell turn transcripts, vector embeddings, Temporal workflow state |
| **Who Calls It?** | `company-frontend` (3000), `superadmin-frontend` (3001), and `AiService` microservices | Retell AI webhooks, Twilio telephony, browser WebRTC calls |

---

## 2. High-Level System Topology

```
                     ┌─────────────────────────────────────────────────────────┐
                     │               HOMEOWNER / CALLER                        │
                     └───────────────────┬─────────────────────────────────────┘
                                         │
                   Phone Call (Twilio)   │   Browser WebRTC Call / Form
                         │               │                 │
                         ▼               ▼                 ▼
              ┌─────────────────────┐       ┌────────────────────────────────┐
              │      Retell AI      │       │        company-frontend        │
              │   Voice Carrier     │       │       (Port 3000 / Next.js)    │
              └──────────┬──────────┘       └──────────────┬─────────────────┘
                         │ Ngrok (4040)                    │
                         ▼                                 │ REST API (/api/v1/*)
              ┌─────────────────────┐                      ▼
              │    voice-service    │◄───────────────►┌──────────────────────────┐
              │     (Port 4002)     │                 │       backend API        │
              └──────────┬──────────┘  /internal/v1/* │  (Port 5000 / Express)   │
                         │                            │                          │
          ┌──────────────┴──────────────┐             │ • Customer CRM           │
          ▼                             ▼             │ • Postgres (Prisma 5432) │
┌──────────────────┐          ┌───────────────────┐   │ • RBAC Permissions       │
│    ai-service    │          │ workflow-service  │◄──┤ • Dispatch & Jobs        │
│   (Port 4003)    │          │    (Port 4004)    │   │ • Retell Direct Fallback │
│ LLM / Embeddings │          │ Temporal (8233)   │   │ • Customer SSE Tracker   │
└──────────────────┘          └───────────────────┘   └────────────┬─────────────┘
                                                                   │
                                                                   ▼
                                                      ┌──────────────────────────┐
                                                      │   superadmin-frontend    │
                                                      │  (Port 3001 / Next.js)   │
                                                      └──────────────────────────┘
```

---

## 3. What Was Moved to `backend/` (The `/internal/v1/*` Move)

### Background: Why the Move Happened
Previously, `AiService` had mock simulator services (`simulators/core-service:4001` and `simulators/auth-service:4000`). Because of those mocks, when the AI agent booked an appointment, it was only saved in temporary simulator memory and **never appeared in the real CRM or Schedule Board**.

We retired the mock simulators and moved the entire business tool contract into **`backend/src/modules/internal/`** on port **5000**:

```
Caller speaks with Retell AI 
      │
      ▼
voice-service (Port 4002 in AiService)
      │
      ▼ (Calls /internal/v1/* on http://host.docker.internal:5000)
backend API (Port 5000) 
      │
      ▼ (Writes directly to real PostgreSQL)
Customer & Job Tables ──► Instantly visible on company-frontend (/customers & /schedule)
```

### The `/internal/v1/*` Endpoints in `backend/`:

| Endpoint | Method | Header | Description |
|:---|:---|:---|:---|
| `/internal/v1/health` | `GET` | — | Internal microservice healthcheck. |
| `/internal/v1/tenants/by-phone/:e164` | `GET` | `x-service-token` | Identifies which company owns the dialed inbound phone number. |
| `/internal/v1/service-areas/check` | `GET` | `x-service-token`, `x-tenant-id` | Validates if caller's ZIP code is within service coverage (`isServed: true/false`). |
| `/internal/v1/availability` | `GET` | `x-service-token`, `x-tenant-id` | Calculates open 2-hour appointment windows based on active technician capacity minus booked jobs. |
| `/internal/v1/customers/by-phone/:phone` | `GET` | `x-service-token`, `x-tenant-id` | Identifies returning callers by caller ID. |
| `/internal/v1/customers` | `POST` | `x-service-token`, `x-tenant-id` | Inserts/updates real customers in PostgreSQL. |
| `/internal/v1/jobs` | `POST` | `x-service-token`, `x-tenant-id` | Creates real official work orders (`JOB-XXXX`) and triggers live SSE updates. |
| `/internal/v1/technicians` | `GET` | `x-service-token`, `x-tenant-id` | Lists active field technicians for assignment. |
| `/internal/v1/estimates` | `GET` | `x-service-token`, `x-tenant-id` | Returns diagnostic fees ($129) and repair pricing for the AI speech script. |
| `/internal/v1/jobs/:id/assignment` | `PUT` | `x-service-token`, `x-tenant-id` | Assigns technician, sends email alert via `MailService`, and broadcasts SSE. |
| `/internal/v1/jobs/:id/status` | `POST` | `x-service-token`, `x-tenant-id` | Updates job status (`DISPATCHED`, `ON_SITE`, `COMPLETED`). |

---

## 4. What We Are Actively Using From `AiService/`

### 1. `voice-service` (Port `4002` — Node.js)
- **Retell Integration:** Connects to Retell AI SDK for speech synthesis, speech-to-text, and audio streaming.
- **Browser Web Calls:** Issues WebRTC access tokens for the "Call AI Agent" button on `/book`.
- **Call History (`/api/v1/calls`):** Stores audio recording URLs and call durations (proxied by `backend` to populate the Unified Inbox).
- **Tool Dispatcher:** When the LLM decides to call tools (`find_customer`, `check_service_area`, `book_service`), `voice-service` dispatches HTTP calls to `backend:5000/internal/v1/*`.

### 2. `ai-service` (Port `4003` — Python / FastAPI)
- **Vector Embeddings & RAG:** Uses FastEmbed/Sentence-Transformers to ingest company PDF manuals and retrieve policy/pricing context for the receptionist.
- **Intent Triage:** Provides deep intent classification and prompt context assembly.

### 3. `workflow-service` (Port `4004` — Python / Temporal)
- **Temporal Engine (Port `8233`):** Manages autonomous dispatch state machines (e.g. technician acceptance countdown timers, cascades to backup technicians, and auto-escalations).

### 4. Supporting Infrastructure (in Docker)
- **`postgres` (Port `5434`):** Voice call records schema (`voice.calls`) and vector embeddings schema (`ai.knowledge_embeddings`).
- **`redis` (Port `6381`):** Message queues for voice events and background workers.
- **`temporal` (Port `7233` / `8233`):** State machine workflow orchestrator and Web UI.
- **`ngrok` (Port `4040`):** Inbound public tunnel for Retell live phone carrier webhooks.

---

## 5. What Was Removed / Retired

| Component | Status | Reason |
|:---|:---|:---|
| ❌ `simulators/core-service` (Port `4001`) | **Removed** | Replaced by the real `backend/src/modules/internal/` module writing to PostgreSQL `5432`. |
| ❌ `simulators/auth-service` (Port `4000`) | **Removed** | Replaced by production JWT authentication in `backend/src/modules/tenant-auth/`. |
| ❌ `scripts/dev/test-ui` (Port `4010`) | **Removed** | Replaced by official Next.js app in `company-frontend/` (Port `3000`). |
| ❌ `contracts/drafts/` & old mock scripts | **Removed** | Consolidated into production schema and OpenAPI specs. |
| ❌ Temporary test seeding scripts (`cleanDemoData.cjs`, etc.) | **Removed** | Cleaned up after database reset. |

---

## 6. Simple Rule of Thumb for Developers

```
                       ┌──────────────────────────────────────────────┐
                       │           WHAT ARE YOU BUILDING?             │
                       └──────────────────────┬───────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         [ BUSINESS & USER DATA ]                            [ AI & VOICE LOGIC ]
  • Customer CRM fields or filters                   • Retell AI prompts or voice tone
  • Schedule swimlanes & dispatch rules              • Audio WebRTC stream handling
  • Role permissions & Auth logins                   • Temporal dispatch timers
  • Invoicing & Billing calculation                  • Vector RAG search on company PDFs
  • Frontend screens in Next.js 14                   • Inbound Twilio carrier hooks
                      │                                               │
                      ▼                                               ▼
        Work in: backend/ (Port 5000)                   Work in: AiService/ (Ports 4002-4004)
        & company-frontend/ (Port 3000)
```

- **If it deals with data, users, login, billing, CRM, or frontend UI APIs:**  
  👉 Work in **`backend/`** (port `5000`) and **`company-frontend/`** (port `3000`).
- **If it deals with AI voice prompts, audio streaming, LLM search, or Retell webhooks:**  
  👉 Work in **`AiService/`** (ports `4002`, `4003`, `4004`).
