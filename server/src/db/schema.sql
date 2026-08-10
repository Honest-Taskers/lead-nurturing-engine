-- Tables are prefixed lne_ (lead nurturing engine) because production shares
-- a database with the main Honest Taskers platform. Keep names in sync with
-- src/db/tables.ts.

CREATE TABLE IF NOT EXISTS lne_leads (
  id CHAR(36) NOT NULL PRIMARY KEY,
  organization VARCHAR(255) NOT NULL,
  industry VARCHAR(120) NOT NULL,
  website VARCHAR(255) NULL,
  headquarters VARCHAR(255) NULL,
  org_size VARCHAR(120) NULL,
  locations_reach VARCHAR(255) NULL,
  hiring_signal VARCHAR(255) NULL,
  persona_name VARCHAR(120) NOT NULL,
  persona_title VARCHAR(160) NOT NULL,
  emails VARCHAR(255) NULL,
  linkedin_url VARCHAR(255) NULL,
  phone VARCHAR(40) NULL,
  mailing_address VARCHAR(255) NULL,
  assigned_rep VARCHAR(80) NOT NULL,
  last_report_date DATE NULL,
  next_due_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_org_persona (organization, persona_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lne_reports (
  id CHAR(36) NOT NULL PRIMARY KEY,
  lead_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  dek VARCHAR(500) NULL,
  badge VARCHAR(120) NULL,
  cover_image_url VARCHAR(255) NULL,
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
  ai_model VARCHAR(80) NOT NULL DEFAULT 'gpt-5.1',
  logo_data_url MEDIUMTEXT NULL,
  CONSTRAINT chk_lne_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The app reads the settings singleton (id = 1) on almost every request;
-- bootstrap it so a fresh database works without seeding demo data.
INSERT IGNORE INTO lne_settings (id, company_name, default_rep, cadence_days, default_sections, ai_prompt, ai_model)
VALUES (1, 'Honest Taskers', 'Jaya', 14,
        JSON_ARRAY('Industry overview', 'Key 2026 trends', 'Top publications to follow', 'Hiring / talent insight', 'How Honest Taskers helps'),
        'Write a concise, executive industry brief for {title} at {company} in {industry}. Cite real trends & publications. Warm, credible, non-salesy.',
        'gpt-5.1');

-- Generated report cover images. Stored in MySQL (not on disk) because the
-- app runs on serverless hosting with no persistent filesystem.
CREATE TABLE IF NOT EXISTS lne_report_images (
  name VARCHAR(120) NOT NULL PRIMARY KEY,
  mime VARCHAR(60) NOT NULL DEFAULT 'image/png',
  data MEDIUMBLOB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
