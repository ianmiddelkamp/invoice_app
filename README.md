# Invoice App — Rails API Backend

A Rails 8 API-only backend for a freelance invoicing application. Handles clients, projects, time tracking, task management, invoice generation with PDF output, file attachments, SOW import via AI, and email delivery via Sidekiq.

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
alias invoice-prod="docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod"
```

Then use `invoice-prod up`, `invoice-prod exec web ...`, etc.

### Production — First Run

```bash
invoice-prod run --rm web bundle exec rails db:create db:migrate db:seed
invoice-prod exec ollama ollama pull phi3:mini
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
GET    /projects/:project_id/time_entries
POST   /projects/:project_id/time_entries
PATCH  /projects/:project_id/time_entries/:id
DELETE /projects/:project_id/time_entries/:id
```

### Timer
```
POST   /timer/start
POST   /timer/stop
POST   /timer/cancel
GET    /timer/session
```

### Invoices
```
GET    /invoices
POST   /invoices
GET    /invoices/:id
PATCH  /invoices/:id
DELETE /invoices/:id
GET    /invoices/:id/pdf
POST   /invoices/:id/regenerate_pdf
POST   /invoices/:id/send_invoice
```

## Key Concepts

### Authentication

All endpoints except `POST /auth/login` require an `Authorization: Bearer <token>` header. Tokens are JWT, valid for 24 hours.

### Task Management

Projects have task groups, and task groups have tasks. Tasks have a status (`todo`, `in_progress`, `done`) and a position for drag-to-reorder. Tasks can be linked to timer sessions and time entries for tracking what was worked on.

### SOW Import

`POST /projects/:id/sow_import` accepts a `.md`, `.txt`, or `.docx` file (or raw `text` param) and uses an AI model to extract a single task group with a flat list of tasks. Returns a JSON object:

```json
{ "title": "Group name", "tasks": [{ "title": "Task description" }, …] }
```

The AI picks a concise group title based on the overall scope of the document. The response is synchronous — no polling required.

To switch providers, set `SOW_PROVIDER` in `.env`:
- `ollama` — local, private, free (default)
- `groq` — fast cloud inference, free tier available
- `anthropic` — Claude API
- `gemini` — Google Gemini API

### Invoice Generation

`POST /invoices` accepts `client_id`, `start_date`, and `end_date`. The `InvoiceGenerator` service finds all unbilled time entries for that client in the date range, calculates amounts using the rate hierarchy, and creates the invoice with a generated PDF.

**Rate hierarchy:** project rate → client rate → $0

Invoice line item descriptions include the time entry description and the linked task name if present.

### Project Attachments

Files up to 20MB can be attached to projects (PDF, Word, images, text). Files are stored via Active Storage. In production, files persist in a named Docker volume (`storage_prod`).

### Email Delivery

Invoices are emailed via Sidekiq. In development, emails are captured by letter_opener_web at:

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
| `Task` | title, status, position, task_group_id |
| `TimeEntry` | date, hours, description, project_id, task_id |
| `TimerSession` | started_at, project_id, task_id |
| `Invoice` | status, total, start_date, end_date, client_id |
| `InvoiceLineItem` | hours, rate, amount, invoice_id, time_entry_id |
| `Rate` | rate, client_id (optional), project_id (optional) |
| `BusinessProfile` | name, email, phone, address, hst_number |
