# Invoice App — Rails API Backend

A Rails 8 API-only backend for a freelance invoicing application. Handles clients, projects, time tracking, invoice generation with PDF output, and email delivery via Sidekiq.

## Tech Stack

- **Ruby** 3.4.8 / **Rails** 8.1
- **PostgreSQL** 15
- **Redis** + **Sidekiq** — background job processing
- **Prawn** — PDF generation
- **Active Storage** — PDF file storage
- **Action Mailer** + **letter_opener_web** (dev) — email delivery

## Getting Started

### Prerequisites

- Docker and Docker Compose
- A `.env` file (or shell export) with `SECRET_KEY_BASE`

### Run with Docker Compose

```bash
docker-compose build
docker-compose up
```

This starts four services:

| Service | Description | Port |
|---------|-------------|------|
| `db` | PostgreSQL 15 | 5432 |
| `redis` | Redis 7 | 6379 |
| `web` | Rails API server | 3000 |
| `sidekiq` | Background job worker | — |

### Database Setup

On first run the entrypoint runs `db:prepare` automatically. To run migrations manually:

```bash
docker-compose exec web bundle exec rails db:migrate
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SECRET_KEY_BASE` | Rails secret key |
| `RAILS_ENV` / `RACK_ENV` | `development` or `production` |

## API Endpoints

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
```

### Time Entries
```
GET    /projects/:project_id/time_entries
POST   /projects/:project_id/time_entries
PATCH  /projects/:project_id/time_entries/:id
DELETE /projects/:project_id/time_entries/:id
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

### Invoice Generation

`POST /invoices` accepts `client_id`, `start_date`, and `end_date`. The `InvoiceGenerator` service finds all unbilled time entries for that client in the date range, calculates line item amounts using a rate hierarchy, and creates the invoice with a generated PDF attached via Active Storage.

**Rate hierarchy:** project rate → client rate → $0

### PDF Generation

`PdfGenerator` uses Prawn to produce an A4 PDF with a line items table, totals, business profile details, and payment terms.

### Email Delivery

Invoices are emailed via `InvoiceMailer#invoice_email`, enqueued through Sidekiq. The PDF is attached to the email. In development, emails are captured by letter_opener_web and viewable at:

```
http://localhost:3000/letter_opener
```

### Invoice Statuses

Invoices move through three states: `pending` → `sent` → `paid`

## Models

| Model | Key Fields |
|-------|-----------|
| `Client` | name, contact_name, email1/2, phone1/2, address, sales_terms |
| `Project` | name, client_id |
| `TimeEntry` | date, hours, description, project_id |
| `Invoice` | status, total, start_date, end_date, client_id |
| `InvoiceLineItem` | hours, rate, amount, invoice_id, time_entry_id |
| `Rate` | rate, client_id (optional), project_id (optional) |
| `BusinessProfile` | name, email, phone, address, hst_number |

## Production Deployment

The Dockerfile is production-ready for deployment via [Kamal](https://kamal-deploy.org):

```bash
docker build -t invoice_app .
docker run -d -p 80:80 \
  -e RAILS_MASTER_KEY=<value from config/master.key> \
  -e SECRET_KEY_BASE=<key> \
  invoice_app
```

The production build excludes development gems and uses Thruster as the web server with Jemalloc for memory efficiency.
