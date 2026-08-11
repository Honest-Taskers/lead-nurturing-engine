-- Tables are prefixed lne_ (lead nurturing engine) because production shares
-- a database with the main Honest Taskers platform. Keep names in sync with
-- src/db/tables.ts.

-- A "sender" is an organization using the platform (Honest Taskers first).
-- It owns brand identity, report preferences, team members and leads.
CREATE TABLE IF NOT EXISTS lne_senders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  about TEXT NULL,
  logo_data_url MEDIUMTEXT NULL,
  logo_url VARCHAR(500) NULL,
  brand_primary CHAR(7) NOT NULL DEFAULT '#203667',
  brand_secondary CHAR(7) NOT NULL DEFAULT '#F7B84A',
  fonts VARCHAR(255) NULL,
  default_rep VARCHAR(80) NOT NULL DEFAULT '',
  cadence_days INT NOT NULL DEFAULT 14,
  default_sections JSON NOT NULL,
  ai_prompt TEXT NOT NULL,
  ai_model VARCHAR(80) NOT NULL DEFAULT 'claude-sonnet-5',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lne_team_members (
  id CHAR(36) NOT NULL PRIMARY KEY,
  sender_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  title VARCHAR(160) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(120) NULL,
  bio TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lne_team_sender FOREIGN KEY (sender_id) REFERENCES lne_senders(id) ON DELETE CASCADE,
  KEY idx_lne_team_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lne_leads (
  id CHAR(36) NOT NULL PRIMARY KEY,
  sender_id CHAR(36) NULL,
  organization VARCHAR(255) NOT NULL,
  -- "Vertical" in the source spreadsheet
  industry VARCHAR(120) NOT NULL,
  website VARCHAR(255) NULL,
  -- logo.dev URL, derived from the website domain (see services/logo.ts)
  logo_url VARCHAR(500) NULL,
  -- optional recipient headshot URL (drives the photo cover variant)
  photo_url VARCHAR(500) NULL,
  headquarters VARCHAR(255) NULL,
  org_size VARCHAR(120) NULL,
  locations_reach VARCHAR(255) NULL,
  hiring_signal VARCHAR(255) NULL,
  -- One row per target persona: an organization with two contacts gets two rows
  persona_name VARCHAR(120) NOT NULL,
  persona_title VARCHAR(160) NOT NULL,
  emails VARCHAR(500) NULL,
  linkedin_url VARCHAR(500) NULL,
  -- "LinkedIn / Contact Path": profile and/or company page used to reach them
  contact_path VARCHAR(500) NULL,
  phone VARCHAR(120) NULL,
  mailing_address VARCHAR(255) NULL,
  assigned_rep VARCHAR(80) NOT NULL,
  last_report_date DATE NULL,
  next_due_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sender_org_persona (sender_id, organization, persona_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lne_reports (
  id CHAR(36) NOT NULL PRIMARY KEY,
  lead_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  dek VARCHAR(500) NULL,
  badge VARCHAR(120) NULL,
  cover_image_url VARCHAR(255) NULL,
  -- Interior feature-opener photo (Unsplash) + attribution
  section_image_url VARCHAR(255) NULL,
  image_credit VARCHAR(160) NULL,
  focus VARCHAR(120) NOT NULL DEFAULT '',
  template VARCHAR(160) NOT NULL DEFAULT '',
  sections JSON NOT NULL,
  publications JSON NULL,
  status ENUM('generated','sent') NOT NULL DEFAULT 'generated',
  generated_at DATE NOT NULL,
  sent_at DATE NULL,
  model VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lne_reports_lead FOREIGN KEY (lead_id) REFERENCES lne_leads(id) ON DELETE CASCADE,
  KEY idx_lne_reports_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lne_settings (
  id TINYINT NOT NULL PRIMARY KEY,
  company_name VARCHAR(160) NOT NULL DEFAULT 'Honest Taskers',
  default_rep VARCHAR(80) NOT NULL DEFAULT 'Jaya',
  cadence_days INT NOT NULL DEFAULT 14,
  default_sections JSON NOT NULL,
  ai_prompt TEXT NOT NULL,
  ai_model VARCHAR(80) NOT NULL DEFAULT 'claude-sonnet-5',
  logo_data_url MEDIUMTEXT NULL,
  CONSTRAINT chk_lne_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The app reads the settings singleton (id = 1) on almost every request;
-- bootstrap it so a fresh database works without seeding demo data.
INSERT IGNORE INTO lne_settings (id, company_name, default_rep, cadence_days, default_sections, ai_prompt, ai_model)
VALUES (1, 'Honest Taskers', 'Jaya', 14,
        JSON_ARRAY('Industry overview', 'Key 2026 trends', 'Top publications to follow', 'Hiring / talent insight', 'How Honest Taskers helps'),
        'Write a concise, executive industry brief for {title} at {company} in {industry}. Cite real trends & publications. Warm, credible, non-salesy.',
        'claude-sonnet-5');

-- Migrate the legacy settings singleton into the default (Honest Taskers)
-- sender. Fixed UUID + INSERT IGNORE = idempotent; runs after the settings
-- bootstrap above so fresh databases work too. Keep in sync with
-- DEFAULT_SENDER_ID in src/db/tables.ts.
INSERT IGNORE INTO lne_senders
  (id, name, logo_data_url, default_rep, cadence_days, default_sections, ai_prompt, ai_model, is_default)
SELECT '00000000-0000-4000-8000-000000000001', company_name, logo_data_url,
       default_rep, cadence_days, default_sections, ai_prompt, ai_model, 1
FROM lne_settings WHERE id = 1;

-- Generated report cover images. Stored in MySQL (not on disk) because the
-- app runs on serverless hosting with no persistent filesystem.
CREATE TABLE IF NOT EXISTS lne_report_images (
  name VARCHAR(120) NOT NULL PRIMARY KEY,
  mime VARCHAR(60) NOT NULL DEFAULT 'image/png',
  data MEDIUMBLOB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
