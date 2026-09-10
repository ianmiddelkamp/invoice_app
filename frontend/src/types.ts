import { DateTime } from "luxon";

export interface Role {
  id: number;
  name: string;
}

export interface Contact {
  id: number;
  client_id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  phone2?: string | null;
  primary: boolean;
  roles?: Role[];
  is_archived?: boolean;
}

export interface Client {
  id: number;
  name: string;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
  sales_terms?: string | null;
  current_rate?: number | null;
  notes?: string | null;
  contacts?: Contact[];
  primary_contact?: Contact | null;
  is_archived?: boolean;
}

export interface Project {
  is_archived: boolean
  id: number;
  name: string;
  client_id: number;
  client?: Client;
  description?: string | null;
  current_rate?: number | null;
  billing_mode: string;
  billing_amount?: number | null;
  show_task_breakdown: boolean;
  show_hours: boolean;
  show_actual_hours: boolean;
}

export interface Task {
  id: number;
  title: string;
  status: string;
  position: number;
  estimated_hours: number | null;
  actual_hours: number;
  last_entry_date: string | null;
}

export interface TaskGroup {
  id: number;
  title: string;
  position: number;
  tasks: Task[];
  estimated_hours_total: number;
  actual_hours_total: number;
}

export interface ChargeCode {
  id: number;
  code: string;
  description: string | null;
  rate?: number | null;
}

export interface InvoiceLineItemDetail {
  id: number;
  description: string | null;
  hours: number | null;
  rate: number | null;
  amount: number | null; // null only for a "custom" text-only row (e.g. a section label)
  tax_rate: string | null;
  kind: string; // "time" | "fixed" | "adjustment" | "custom"
  position: number | null;
  project?: Pick<Project, 'id' | 'name' | 'show_task_breakdown' | 'show_hours'> | null;
  task?: Pick<Task, 'id' | 'title'> & { task_group?: Pick<TaskGroup, 'id' | 'title' | 'position'> };
  time_entry?: {
    date: string;
    task?: Pick<Task, 'id' | 'title'> & { task_group?: Pick<TaskGroup, 'id' | 'title' | 'position'> };
    project?: { name: string };
    charge_code?: { code: string };
  };
}

export interface Invoice {
  id: number;
  number: string;
  status: string;
  total: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
  client?: Client;
  contact?: Contact;
  notes?: string | null;
  invoice_line_items?: InvoiceLineItemDetail[];
  paid_at?: string | null;
  amount_paid:  number | null;
  outstanding: number | null;
  // Only ever present on the response to POST /invoices — informational, non-blocking notices
  // (e.g. a Fixed Price project billed a different task breakdown than what was quoted).
  warnings?: string[];
}

export interface PaymentEntry {
  id?: number;
  invoice: Invoice;
  paid_at?: string | null;
  amount_paid:  number ;
}

export interface InvoiceLineItem {
  id: number;
  invoice?: Pick<Invoice, 'id' | 'number'>;
}

export interface TimeEntry {
  id: number;
  date: string;
  hours: number;
  description: string | null;
  started_at: string | null;
  stopped_at: string | null;
  project_id: number | null;
  task_id: number | null;
  charge_code_id: number | null;
  client_id: number | null;
  project?: Project & { client?: Client };
  task?: Pick<Task, 'id' | 'title'> & { task_group?: Pick<TaskGroup, 'id' | 'title'> };
  charge_code?: ChargeCode;
  client?: Client;
  invoice?: Pick<Invoice, 'id' | 'number'>;
}

export interface TimerSession {
  id: number;
  project_id: number;
  task_id: number | null;
  started_at: string;
  stopped_at: string | null;
  description: string | null;
  hours: number;
  project?: Project & { client?: Client };
  task?: Pick<Task, 'id' | 'title' | 'status'>;
}

export interface Rate {
  id: number;
  rate: number;
}

export interface BusinessProfile {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
  logo_url: string | null;
  logo_data_uri?: string | null;
  hst_number?: string | null;
  primary_color?: string | null;
  invoice_footer?: string | null;
  estimate_footer?: string | null;
  default_payment_terms?: string | null;
  tax_rate?: string | null;
  gmail_user?: string | null;
  gmail_app_password?: string;
  email_configured?: boolean;
}

export interface Disbursement {
  id: number;
  project_id: number;
  description: string;
  amount: number;
  incurred_on: string | null;
  paid: boolean;
  created_at: string;
}

export interface EstimateLineItem {
  id: number;
  description: string | null;
  hours: number;
  rate: number;
  amount: number;
  tax_rate: string | null;
  task?: Pick<Task, 'id' | 'status' | 'actual_hours'> & { task_group?: Pick<TaskGroup, 'id' | 'title' | 'position'> };
  disbursement?: Pick<Disbursement, 'id' | 'description'>;
}

export type BillingProject = Pick<
  Project,
  'billing_mode' | 'billing_amount' | 'show_task_breakdown' | 'show_hours' | 'show_actual_hours'
>;

export interface EstimateChanges {
  added?: { description: string; hours: string }[];
  removed?: { description: string }[];
  changed?: { description: string; old_hours: string; new_hours: string }[];
  completed?: { description: string; estimated_hours: string; actual_hours: string }[];
  previous_total?: string;
  current_total?: string;
}

export interface Estimate {
  id: number;
  project_id: number;
  title: string;
  number: string;
  status: string;
  total: number | null;
  created_at: string;
  project?: Project & { client?: Client };
  contact?: Contact;
  estimate_line_items?: EstimateLineItem[];
  changes?: EstimateChanges;
}

export interface Attachment {
  id: number;
  filename: string;
  url: string;
  content_type: string;
  byte_size: number;
}

export interface Expense {
  id: number;
  date: string;
  vendor: string | null;
  description: string;
  amount: number;
  hst_paid: number;
  category: string | null;
  receipt_url: string | null;
  receipt_blob_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface HstReturn {
  id: number;
  period_start: string;
  period_end: string;
  status: 'draft' | 'filed' | 'paid';
  total_revenue: number | null;
  hst_collected: number | null;
  input_tax_credits: number;
  net_tax: number | null;
  filing_reference: string | null;
  filed_at: string | null;
  payment_due_date: string | null;
  paid_at: string | null;
  amount_paid: number | null;
  notes: string | null;
}

export interface HstCalculation {
  total_revenue: number;
  hst_collected: number;
  input_tax_credits: number;
  net_tax: number;
  invoice_count: number;
}

export interface CcaAsset {
  id: number;
  name: string;
  cca_class: string;
  cca_rate: number;
  purchase_date: string;
  cost: number;
  ucc_opening: number | null;
  additions: number;
  disposals: number;
  notes: string | null;
  cca_deduction?: number;
}

export interface HomeOfficeProfile {
  id: number;
  total_rooms: number | null;
  office_rooms: number | null;
  monthly_rent: number | null;
  monthly_utilities: number | null;
  monthly_internet: number | null;
  monthly_other: number | null;
  use_square_footage: boolean;
  total_sqft: number | null;
  office_sqft: number | null;
  notes: string | null;
  business_use_percentage: number;
  annual_deductible: number;
}

export interface T2125Report {
  year: number;
  business_name: string | null;
  hst_number: string | null;
  gross_revenue: number;
  hst_collected: number;
  hst_remitted: number;
  net_revenue: number;
  expenses_by_category: Record<string, number>;
  total_expenses: number;
  cca_details: { id: number; name: string; cca_class: string; cca_rate: number; deduction: number }[];
  total_cca: number;
  home_office_deduction: number;
  home_office_percentage: number;
  net_income: number;
}
