# Solo — Rails API Backend

A Rails 8 API-only backend for Solo, a freelance invoicing and time tracking application. Handles clients, projects, charge codes, time tracking, task management, estimates, invoice generation with PDF output, file attachments, SOW import via AI, and email delivery.

## Tech Stack

- **Ruby** 3.4 / **Rails** 8.1
- **PostgreSQL** 15
- **Redis** + **Sidekiq** — background job processing
- **Prawn** — PDF generation
- **Active Storage** — file storage (PDFs, project attachments)
- **Action Mailer** + **letter_opener_web** (dev) — email delivery
- **Ollama** (via Docker) — local AI for SOW parsing

## Environments

Two isolated environments, each with its own PostgreSQL instance, credentials, and data volume.

| | Development | Production (local) |
|---|---|---|
| Database | `invoice_dev` | `invoice_prod` |
| PostgreSQL port | 5432 | 5433 |
| Rails env | `development` | `production` |
| Email | letter_opener_web | SMTP (configure separately) |
| Compose file | `docker-compose.yml` | `docker-compose.yml` + `docker-compose.prod.yml` |
| Env file | `.env` | `.env.prod` |

## Getting Started

### Prerequisites

- Docker and Docker Compose
- `.env` file based on `.env.example`

```bash
cp .env.example .env
```

Fill in values before starting.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY_BASE` | Rails secret key | required |
| `DB_USER` | PostgreSQL username | required |
| `DB_PASS` | PostgreSQL password | required |
| `SOW_PROVIDER` | AI provider for SOW import (`ollama`, `groq`, `anthropic`, `gemini`) | `ollama` |
| `SOW_API_KEY` | API key (not needed for ollama) | — |
| `SOW_OLLAMA_HOST` | Ollama service URL | `http://ollama:11434` |
| `SOW_OLLAMA_MODEL` | Model to use with Ollama | `phi3:mini` |

### Build and Run

```bash
docker compose up -d
```

### First Run — Pull the AI Model

On first startup, pull the Ollama model (one-time, ~2.3GB):

```bash
docker compose exec ollama ollama pull phi3:mini
```

The model is stored in a named Docker volume and persists across restarts.

### Database Setup (first run)

```bash
docker compose exec web bundle exec rails db:migrate db:seed
```

### Update User Credentials

```bash
docker compose exec web bundle exec rails console
User.first.update(email: "you@example.com", name: "Your Name", password: "yourpassword")
```

### Run Production (local)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up
```

Recommended: add a shell alias to `~/.bashrc`:

```bash
alias solo-prod="docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod"
```

Then use `solo-prod up`, `solo-prod exec web ...`, etc.

### Production — First Run

```bash
solo-prod run --rm web bundle exec rails db:create db:migrate db:seed
solo-prod exec ollama ollama pull phi3:mini
```

## Backups

A backup script is provided at `scripts/backup.sh`. It dumps the database and copies Active Storage files.

```bash
bash scripts/backup.sh
```

Run from the project root with production containers up (`.env.prod` must exist). Backups are written to `~/backups/invoice/prod/` with timestamps and 14-day retention.

## API Endpoints

### Auth
```
POST   /auth/login
```

### Business Profile
```
GET    /business_profile
PATCH  /business_profile
```

### Clients
```
GET    /clients
POST   /clients
GET    /clients/:id
PATCH  /clients/:id
DELETE /clients/:id
GET    /clients/:id/rate
PATCH  /clients/:id/rate
```

### Projects
```
GET    /projects
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id
GET    /projects/:id/rate
PATCH  /projects/:id/rate
POST   /projects/:id/sow_import
```

### Task Groups & Tasks
```
GET    /projects/:project_id/task_groups
POST   /projects/:project_id/task_groups
PATCH  /projects/:project_id/task_groups/:id
DELETE /projects/:project_id/task_groups/:id
PATCH  /projects/:project_id/task_groups/reorder
POST   /projects/:project_id/task_groups/:task_group_id/tasks
PATCH  /projects/:project_id/task_groups/:task_group_id/tasks/:id
DELETE /projects/:project_id/task_groups/:task_group_id/tasks/:id
PATCH  /projects/:project_id/task_groups/:task_group_id/tasks/reorder
```

### Project Attachments
```
GET    /projects/:project_id/attachments
POST   /projects/:project_id/attachments
GET    /projects/:project_id/attachments/:id   (download)
DELETE /projects/:project_id/attachments/:id
```

### Time Entries
```
GET    /projects/:project_id/time_entries      (project-scoped)
POST   /projects/:project_id/time_entries
PATCH  /projects/:project_id/time_entries/:id
DELETE /projects/:project_id/time_entries/:id

GET    /time_entries                           (top-level, supports ?client_id, ?project_id, ?status, ?hide_charge_codes)
GET    /time_entries/:id
POST   /time_entries                           (charge code entries)
PATCH  /time_entries/:id
DELETE /time_entries/:id
```

### Charge Codes
```
GET    /charge_codes
POST   /charge_codes
PATCH  /charge_codes/:id
DELETE /charge_codes/:id
```

### Timer
```
GET    /timer
POST   /timer/start
POST   /timer/stop
PATCH  /timer
DELETE /timer
```

### Estimates
```
GET    /estimates
POST   /estimates
GET    /estimates/:id
PATCH  /estimates/:id
DELETE /estimates/:id
GET    /estimates/:id/pdf
POST   /estimates/:id/regenerate_pdf
POST   /estimates/:id/send_estimate
```

### Invoices
```
GET    /invoices
POST   /invoices
GET    /invoices/:id
PATCH  /invoices/:id
DELETE /invoices/:id
GET    /invoices/unbilled_entries              (?client_id, ?start_date, ?end_date)
GET    /invoices/:id/pdf
POST   /invoices/:id/regenerate_pdf
POST   /invoices/:id/send_invoice
```

## Key Concepts

### Authentication

All endpoints except `POST /auth/login` require an `Authorization: Bearer <token>` header. Tokens are JWT, valid for 24 hours.

### Charge Codes

Charge codes allow billing for work not tied to a project (consultations, training, admin, etc.). A `ChargeCode` has a short `code` identifier, an optional `description`, and an optional `rate` override. Time entries belong to either a project or a charge code — not both. Charge code entries carry a `client_id` directly for invoicing purposes.

### Invoice Generation

`POST /invoices` accepts `client_id`, optional `start_date`/`end_date`, and optional `time_entry_ids`.

- If `time_entry_ids` is provided, only those specific entries are included. The service validates that none are already billed.
- Otherwise, all unbilled entries for the client in the date range are included — both project-based and charge-code-based.

**Rate hierarchy:**
- Project entries: project rate → client rate → $0
- Charge code entries: charge code rate → client rate → $0

### Task Management

Projects have task groups, and task groups have tasks. Tasks have a status (`todo`, `in_progress`, `done`), a position for drag-to-reorder, and optional time estimates. Tasks can be linked to timer sessions and time entries.

### SOW Import

`POST /projects/:id/sow_import` accepts a `.md`, `.txt`, or `.docx` file (or raw `text` param) and uses an AI model to extract a task group with a flat list of tasks. The response is synchronous.

To switch providers, set `SOW_PROVIDER` in `.env`:
- `ollama` — local, private, free (default)
- `groq` — fast cloud inference, free tier available
- `anthropic` — Claude API
- `gemini` — Google Gemini API

### Project Attachments

Files up to 20MB can be attached to projects. Stored via Active Storage. In production, files persist in a named Docker volume (`storage_prod`).

### Email Delivery

Invoices and estimates are emailed via Action Mailer. In development, emails are captured by letter_opener_web at:

```
http://localhost:3000/letter_opener
```

### Invoice Statuses

`pending` → `sent` → `paid`

## Models

| Model | Key Fields |
|-------|-----------|
| `Client` | name, contact_name, email1/2, phone1/2, address, sales_terms |
| `Project` | name, client_id |
| `TaskGroup` | title, position, project_id |
| `Task` | title, status, estimated_hours, position, task_group_id |
| `TimeEntry` | date, hours, description, project_id (optional), charge_code_id (optional), client_id (optional), task_id |
| `ChargeCode` | code, description, rate (optional), user_id |
| `TimerSession` | started_at, stopped_at, project_id, task_id |
| `Invoice` | status, total, start_date, end_date, client_id |
| `InvoiceLineItem` | hours, rate, amount, tax_rate, description, invoice_id, time_entry_id |
| `Estimate` | status, total, project_id |
| `EstimateLineItem` | hours, rate, amount, tax_rate, description, estimate_id, task_id |
| `Rate` | rate, client_id (optional), project_id (optional) |
| `BusinessProfile` | name, email, phone, address, hst_number, tax_rate, primary_color |
