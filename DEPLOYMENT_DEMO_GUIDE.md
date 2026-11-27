# 🚀 Elijah AI: Local Server Deployment & Demo Startup Guide

This document is for the developer setting up and running the **Core Backend** and **AI Services** on the company's local server (or staging machine) for the live demo.

---

## 🏗️ 1. Architecture & Port Mapping

When running live, the services listen on the following ports:

| Service | Port | Technology | Purpose | Health Check URL |
| :--- | :--- | :--- | :--- | :--- |
| **Core Backend** | `5000` | Node.js 22 + Express + Prisma | Multi-tenant auth, customers, dispatch, jobs, service areas, billing, SSE | `http://<SERVER_IP>:5000/api/v1/internal/health` |
| **AI Knowledge Service** | `4003` | Python 3.11+ / FastAPI + pgvector | Document ingestion (PDF, MD, TXT), RAG Q&A, vector similarity search | `http://<SERVER_IP>:4003/health` |
| **Voice Service** | `4002` | Node.js + Express + Retell AI | Inbound/outbound calling, prompt tuning, speech tools, web-call simulator | `http://<SERVER_IP>:4002/health` |
| **Workflow Engine** | `4004` | Python / FastAPI + Temporal | Service request state machine, trade catalog, pricing tier engine | `http://<SERVER_IP>:4004/health` |
| **PostgreSQL** | `5432` / `5434` | PostgreSQL 16+ with `pgvector` | Persistent database with schemas for `public`, `ai`, and `ops` | `pg_isready` |
| **Redis** | `6379` / `6381` | Redis 7+ | Event queue and background tasks | `redis-cli ping` |

---

## ⚙️ 2. Prerequisites on Company Local Server

Ensure the server has:
1. **Git**: To clone/pull the latest repo commits.
2. **Docker & Docker Compose** (Recommended): Simplifies Postgres with `pgvector`, Redis, Temporal, and AI services.
3. **Node.js 22+ & npm**: For running the Core Backend.
4. **Local Network IP**: Find the server's local IPv4 address:
   - **Windows**: Run `ipconfig` (e.g. `192.168.1.150` or `10.0.0.50`)
   - **Linux / macOS**: Run `ip a` or `ifconfig`

---

## 🚀 3. Step-by-Step Deployment (Recommended Hybrid Mode)

The cleanest, most reliable way to run on a local company server is:
- **Docker Compose** handles the AI infrastructure (Postgres with `pgvector`, Redis, Temporal, and the AI microservices).
- **Node.js** runs the Core Backend on port `5000`.

---

### Step 3.1: Configure Environment Variables

#### A. AI Services Environment (`AiService/.env`)
Navigate to `AiService/` and ensure `.env` exists:
```bash
cd AiService
cp .env.example .env
```
Ensure the following key variables are configured in `AiService/.env`:
```env
# LLM & Embeddings
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.8-27b
EMBEDDING_PROVIDER=local

# Retell AI Telephony
RETELL_API_KEY=key_your_retell_api_key_here
RETELL_PHONE_NUMBER=+13183296809
RETELL_AGENT_ID=agent_1477c743cde2e09689626836cd

# Shared Security Secrets
AUTH_JWT_SECRET=super-secret-jwt-key-elijah-ai-2026-very-secure
CORE_SERVICE_TOKEN=replace-with-a-long-random-string
CORE_SERVICE_URL=http://host.docker.internal:5000
OPERATIONS_SERVICE_URL=http://host.docker.internal:5000
OPERATIONS_SERVICE_TOKEN=replace-with-a-long-random-string
AI_SERVICE_TOKEN=replace-with-a-long-random-string
VOICE_SERVICE_TOKEN=replace-with-a-long-random-string-voice

# Allowed CORS Origins (Include frontend developer IP)
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```
*(Replace `http://localhost:3000` with the IP of the frontend machine if connecting across the LAN, e.g. `http://192.168.1.55:3000`).*

---

#### B. Core Backend Environment (`backend/.env`)
Navigate to `backend/` and verify `.env`:
```env
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/elijah_db?schema=public"
NODE_ENV="development"
PORT=5000

JWT_SECRET="super-secret-jwt-key-elijah-ai-2026-very-secure"
JWT_EXPIRES_IN="7d"

SUPERADMIN_EMAIL="superadmin@elijah.ai"
SUPERADMIN_PASSWORD="SuperSecretPassword123!"
SUPERADMIN_NAME="Platform SuperAdmin"

# Allow CORS for the frontend developer's machine:
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"

CORE_SERVICE_TOKEN="replace-with-a-long-random-string"
RETELL_API_KEY="key_your_retell_api_key_here"
```
*(Tip: To allow any local LAN frontend, you can set `CORS_ORIGIN="*"` for the demo).*

---

### Step 3.2: Start the AI Stack via Docker Compose

In `AiService/`:
```bash
cd AiService
docker compose up -d --build
```
This automatically starts:
- `postgres` (with `pgvector` enabled for document embedding)
- `redis`
- `temporal` (workflow orchestration)
- `ai-service` on port `4003`
- `voice-service` on port `4002`
- `workflow-service` on port `4004`

Verify the containers are healthy:
```bash
docker compose ps
```

---

### Step 3.3: Initialize and Start Core Backend

In `backend/`:
```bash
cd backend

# 1. Install dependencies
npm install

# 2. Push Prisma database schema to PostgreSQL
npx prisma db push

# 3. Seed demo company, users, and technicians
npm run prisma:seed

# 4. Start the Core Backend server
npm run dev
```
*(The backend should output: `🚀 Server running on port 5000`)*.

---

## 🌐 4. Configuring the Frontend (For the Frontend Developer)

On the developer's laptop running the frontend:

Create or edit `company-frontend/.env.local`:
```env
# Replace <LOCAL_SERVER_IP> with the company local server's IP address (e.g. 192.168.1.150)
NEXT_PUBLIC_API_URL=http://<LOCAL_SERVER_IP>:5000/api/v1
NEXT_PUBLIC_VOICE_API_URL=http://<LOCAL_SERVER_IP>:4002/api/v1
NEXT_PUBLIC_AI_API_URL=http://<LOCAL_SERVER_IP>:4003/api/v1
NEXT_PUBLIC_WORKFLOW_API_URL=http://<LOCAL_SERVER_IP>:4004/api/v1
```
*(If running frontend on the same machine as the backend, simply use `http://localhost:5000/api/v1`, etc.)*

Start the frontend:
```bash
cd company-frontend
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 🧪 5. Health Checks & Verification Commands

Run these fast curl checks on the server or from any computer on the local network:

```bash
# 1. Core Backend Health
curl -s http://<SERVER_IP>:5000/api/v1/internal/health
# Expected: {"status":"ok","timestamp":"..."}

# 2. AI Knowledge Service Health
curl -s http://<SERVER_IP>:4003/health
# Expected: {"data":{"status":"ok"}}

# 3. Voice Service Health
curl -s http://<SERVER_IP>:4002/health
# Expected: {"status":"ok"}

# 4. Workflow Service Health
curl -s http://<SERVER_IP>:4004/health
# Expected: {"status":"ok"}

# 5. Service Areas Check
curl -s -H "x-tenant-id: cmwexxk6u0001nrstmjy98yz5" http://<SERVER_IP>:5000/api/v1/service-areas
# Expected: {"data":[ ... ]}
```

---

## 🔑 6. Demo Credentials & Test Data

Use these accounts to sign into the frontend:

| Role | Email | Password | What to Demo |
| :--- | :--- | :--- | :--- |
| **Business Owner** | `michael@desertairhvac.com` *(or from seed)* | `Password123!` | Full operations hub: Knowledge Base RAG, Service Areas, Follow-up Recipes, AI Dispatch policy, Billing |
| **Super Admin** | `superadmin@elijah.ai` | `SuperSecretPassword123!` | Multi-tenant company switcher, license activation, system configuration |
| **Dispatcher** | `dispatcher@desertairhvac.com` | `Password123!` | Schedule board, technician recommendations, real-time job triage |
| **Field Technician** | `tech1@desertairhvac.com` | `Password123!` | Mobile field portal (`/tech`), job accept/decline, mid-job status |

---

## 🛠️ 7. Troubleshooting Common Issues

### A. Port Conflict (E.g. Port 5432 or 5000 already in use)
- If a local PostgreSQL instance is already running on the server, you can point `DATABASE_URL` to port `5434` (mapped by Docker):
  ```env
  DATABASE_URL="postgresql://elijah:elijah_local_only@localhost:5434/elijah?schema=public"
  ```

### B. CORS Error in Browser Console
- If the browser blocks API calls with `CORS policy`:
  - Open `backend/.env` and add your client's IP to `CORS_ORIGIN`, or set `CORS_ORIGIN="*"` for the demo.
  - Open `AiService/.env` and update `CORS_ALLOWED_ORIGINS`.

### C. Retell Webhooks for Inbound Calling
- If testing **real telephone calls** to the Retell phone number (`+13183296809`):
  - In `AiService/`, start ngrok to create a public URL:
    ```bash
    docker compose --profile webhooks up -d ngrok
    ```
  - Or run ngrok locally:
    ```bash
    ngrok http 4002
    ```
  - Copy the public HTTPS URL into the Retell dashboard webhook settings.
- For **in-browser audio testing** (without phone carriers), use the `/call-simulator` page in the dashboard; it uses browser WebRTC and requires no public webhooks.
