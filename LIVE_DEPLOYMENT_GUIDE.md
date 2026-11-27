# Elijah AI — Production & Local Server Deployment Guide
**Target Audience:** DevOps / Backend Engineers bringing `backend` (Core REST API) and `AiService` (Docker Microservices Stack) live on a company local server or staging VM.

---

## 1. High-Level Architecture Overview

Elijah AI operates as a coordinated multi-service ecosystem:

```
                           ┌──────────────────────────────────────────────┐
                           │            External Carriers / WebRTC        │
                           │   (Retell AI Voice, Twilio SMS, Browser)     │
                           └──────────────────────┬───────────────────────┘
                                                  │ Public Webhook / SSL Tunnel
                                                  ▼
                                      ┌───────────────────────┐
                                      │     voice-service     │ (Port 4002 - Docker)
                                      │  Retell Event Handler │
                                      └───────────┬───────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 │ S2S Token                      │ S2S Token                      │ S2S Token
                 ▼                                ▼                                ▼
    ┌──────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────┐
    │       backend API        │     │        ai-service        │     │     workflow-service     │
    │   (Port 5000 - Express)  │     │   (Port 4003 - FastAPI)  │     │   (Port 4004 - FastAPI)  │
    │ PostgreSQL (Prisma ORM)  │     │   Groq/OpenAI Reasoning  │     │  Temporal Orchestration  │
    └────────────┬─────────────┘     └──────────────────────────┘     └────────────┬─────────────┘
                 │                                                                 │
                 ▼                                                                 ▼
    ┌──────────────────────────┐                                      ┌──────────────────────────┐
    │     Core PostgreSQL      │                                      │   Temporal Dev Server    │
    │       (Port 5432)        │                                      │    (Ports 7233 & 8233)   │
    └──────────────────────────┘                                      └──────────────────────────┘
```

---

## 2. Server Prerequisites

Ensure the target server has the following installed and operational:
1. **Docker & Docker Compose v2** (e.g. `Docker version 24+` or Docker Desktop)
2. **Node.js LTS (v20+ or v22+) & npm**
3. **PostgreSQL 16+** (can run natively on port 5432 or in a dedicated container)
4. **Git**
5. **Ngrok CLI** (or domain reverse proxy like Nginx/Cloudflare Tunnel) if connecting live Retell telephone calls to the local server.

---

## 3. Environment Configuration & Sanitization

> 🔒 **Security Rules:**
> * Never commit `.env` or `.env.local` to Git. (All repositories already ignore `.env*` via `.gitignore`).
> * Never hardcode Retell API tokens, LLM keys, or SMTP credentials in code files.
> * Ensure `JWT_SECRET` in `backend` matches `AUTH_JWT_SECRET` in `AiService`.
> * Ensure `CORE_SERVICE_TOKEN` in `backend` matches `CORE_SERVICE_TOKEN` in `AiService`.

### A. Core Backend Configuration (`backend/.env`)

In the `backend/` directory, create `.env` from `.env.example`:

```env
# PostgreSQL Database Connection
DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@localhost:5432/elijah_db?schema=public"

# Environment & Server Port
NODE_ENV="production" # or "development" for local staging
PORT=5000

# JWT Auth Secret (Must match AUTH_JWT_SECRET in AiService)
JWT_SECRET="super-secret-jwt-key-elijah-ai-2026-very-secure"
JWT_EXPIRES_IN="7d"

# SuperAdmin Initial Seed Credentials
SUPERADMIN_EMAIL="superadmin@elijah.ai"
SUPERADMIN_PASSWORD="YourSecurePassword123!"
SUPERADMIN_NAME="Platform SuperAdmin"

# Allowed CORS Origins (Frontend apps)
CORS_ORIGIN="http://localhost:3000,http://localhost:3001,http://YOUR_SERVER_IP:3000"
COMPANY_APP_URL="http://localhost:3000"

# Mail Service (Gmail / Google Workspace SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_USER="your-email@yourdomain.com"
SMTP_PASS="your-16-char-app-password"
SMTP_FROM='"Elijah AI" <your-email@yourdomain.com>'

# Core Service Internal API Token (Must match CORE_SERVICE_TOKEN in AiService)
CORE_SERVICE_TOKEN="replace-with-a-long-random-string"

# Retell API Key (For syncing call recordings & transcripts directly with Retell)
RETELL_API_KEY="key_your_actual_retell_key"
```

---

### B. AI Microservices Stack Configuration (`AiService/.env`)

In the `AiService/` directory, create `.env` from `.env.example`:

```env
# ---- LLM Reasoning (Groq or OpenAI) --------------------------------------
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_groq_api_key
GROQ_MODEL=qwen/qwen3.8-27b
# or OPENAI_API_KEY=sk-... and OPENAI_MODEL=gpt-4.1-mini

# Knowledge Base Embeddings: local (downloads model once) | openai
EMBEDDING_PROVIDER=local

# ---- Retell AI Telephony ------------------------------------------------
RETELL_API_KEY=key_your_actual_retell_key
RETELL_PHONE_NUMBER=+13183296809
RETELL_AGENT_ID=agent_your_retell_agent_id

# ---- Ngrok Tunnel (for carrier webhooks from Retell) -------------------
NGROK_AUTHTOKEN=your_ngrok_authtoken
NGROK_DOMAIN=your-static-subdomain.ngrok-free.dev

# ---- Service-to-Service Tokens & URLs ------------------------------------
AUTH_JWT_SECRET=super-secret-jwt-key-elijah-ai-2026-very-secure
CORE_SERVICE_URL=http://host.docker.internal:5000
OPERATIONS_SERVICE_URL=http://host.docker.internal:5000
CORE_SERVICE_TOKEN=replace-with-a-long-random-string
OPERATIONS_SERVICE_TOKEN=replace-with-a-long-random-string
WORKFLOW_SERVICE_TOKEN=replace-with-a-long-random-string-workflow
VOICE_SERVICE_TOKEN=replace-with-a-long-random-string-voice
FEEDBACK_CALLS_ENABLED=false
```

---

## 4. Step-by-Step Deployment Instructions

### Step 1: Start `AiService` Microservices Stack

1. Open a terminal on the server:
   ```bash
   cd /path/to/ElijahAi/AiService
   ```

2. Build and start all Docker containers:
   ```bash
   docker compose up -d --build
   ```

3. Check health status of all containers:
   ```bash
   docker compose ps
   ```
   **Expected Running Containers:**
   * `aiservice-postgres-1` (port 5434:5432 - dedicated vector/ai DB)
   * `aiservice-redis-1` (port 6381:6379 - event stream)
   * `aiservice-temporal-1` (ports 7233 & 8233 - state machine workflow server)
   * `aiservice-voice-service-1` (port 4002:4002 - Retell event handler)
   * `aiservice-ai-service-1` (port 4003:4003 - Python LLM & RAG search)
   * `aiservice-workflow-api-1` (port 4004:4004 - Dispatch workflows)
   * `aiservice-core-simulator-1` (port 4001:4001 - FSM test simulator)

4. *(Optional)* Start the Ngrok webhook tunnel if using live telephony:
   ```bash
   docker compose --profile webhooks up -d ngrok
   ```

---

### Step 2: Start the Core Backend (`backend`)

1. Open a terminal in the `backend/` folder:
   ```bash
   cd /path/to/ElijahAi/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run Prisma database migrations and seed default tenants and demo users:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   npm run prisma:seed
   ```
   *(This provisions Desert Air HVAC, tenant settings, default trade services, and demo accounts with password `password123`)*.

4. Start the backend:
   * **For Development / Staging:**
     ```bash
     npm run dev
     ```
   * **For Production (via PM2 or systemd):**
     ```bash
     npm run build
     npm run start
     # Or using PM2:
     pm2 start dist/server.js --name "elijah-backend"
     ```

5. Verify the backend health:
   ```bash
   curl http://localhost:5000/health
   # Expected response: {"status":"healthy", ...}
   ```

---

## 5. Port Reference & Firewall Rules

| Port | Service | Bound To | Accessible By |
|---|---|---|---|
| `5000` | Core Backend REST API | `0.0.0.0:5000` | Frontend clients & AiService container (`host.docker.internal:5000`) |
| `4002` | Voice Service | `0.0.0.0:4002` | Core Backend & Ngrok / Retell Webhook |
| `4003` | AI Knowledge Service | `0.0.0.0:4003` | Voice Service & Workflow Service |
| `4004` | Workflow Service | `0.0.0.0:4004` | Voice Service & Core Backend |
| `8233` | Temporal Web UI | `127.0.0.1:8233` | Internal Developers (state inspection) |
| `5432` | Core PostgreSQL | `127.0.0.1:5432` | Core Backend only |
| `5434` | Microservice PostgreSQL | `127.0.0.1:5434` | Docker microservices only |
| `6381` | Redis | `127.0.0.1:6381` | Docker microservices only |
| `4040` | Ngrok Web Inspector | `127.0.0.1:4040` | Developer monitoring |

---

## 6. Verification & Health Check Checklist

Run these quick checks after starting both services:

```bash
# 1. Core Backend Health
curl -s http://localhost:5000/health

# 2. Voice Service Health
curl -s http://localhost:4002/health

# 3. AI Service Health
curl -s http://localhost:4003/docs

# 4. Workflow Service Health
curl -s http://localhost:4004/docs

# 5. Core Backend Service Areas Check
curl -s http://localhost:5000/api/v1/service-areas -H "x-tenant-id: cmwexxk6u0001nrstmjy98yz5"

# 6. Core Backend Technician Check-Ins Check
curl -s http://localhost:5000/api/v1/technician-check-ins -H "x-tenant-id: cmwexxk6u0001nrstmjy98yz5"
```

If all 6 return valid HTTP 200 responses, both the Core Backend and AI Service stack are live, linked, and ready to serve requests!

---

## 7. Retell AI Webhook Setup (For Live Telephone Calls)

In the [Retell AI Dashboard](https://beta.retellai.com/dashboard):
1. Navigate to **Agents** -> Select your Agent (or the one matching `RETELL_AGENT_ID`).
2. Under **Webhook URL**, set:
   ```
   https://YOUR_NGROK_DOMAIN.ngrok-free.dev/webhook
   ```
   *(or your company server's public domain if using a static IP with SSL: `https://your-domain.com/webhook`)*.
3. In **Inbound Numbers**, attach your phone number (`RETELL_PHONE_NUMBER`) to this agent.
4. Call the phone number — Elijah will answer, check service coverage via Port 5000, transcribe the conversation, and book the appointment automatically!
