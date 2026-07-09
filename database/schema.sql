-- KNS College PostgreSQL schema.
-- Compatible with Render PostgreSQL and other standard PostgreSQL hosts.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enquiries (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    programme_interest TEXT NOT NULL,
    preferred_intake TEXT,
    message TEXT,
    newsletter BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrollments (
    id BIGSERIAL PRIMARY KEY,
    course_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    payment_method TEXT,
    mobile_number TEXT,
    enrollment_fee TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    course_name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT DEFAULT 'Sierra Leone',
    date_of_birth DATE,
    gender TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    delivery_mode TEXT NOT NULL,
    intake_period TEXT NOT NULL,
    application_fee NUMERIC(12, 2),
    payment_status TEXT NOT NULL DEFAULT 'pending',
    payment_reference TEXT,
    payment_provider TEXT DEFAULT 'monime',
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments (payment_reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (payment_status);

CREATE TABLE IF NOT EXISTS scholarships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    award_summary TEXT,
    eligibility JSONB DEFAULT '[]'::jsonb,
    deadline TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    guide_path TEXT,
    form_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scholarships_active ON scholarships (is_active);

CREATE TABLE IF NOT EXISTS scholarship_applications (
    id BIGSERIAL PRIMARY KEY,
    scholarship_id UUID REFERENCES scholarships (id) ON DELETE SET NULL,
    surname TEXT NOT NULL,
    first_name TEXT NOT NULL,
    other_names TEXT,
    gender TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    nationality TEXT NOT NULL,
    national_id TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    highest_qualification TEXT NOT NULL,
    school_institution TEXT NOT NULL,
    year_of_completion INTEGER NOT NULL,
    credits TEXT,
    programme TEXT NOT NULL,
    scholarship_type TEXT NOT NULL,
    previous_application TEXT NOT NULL,
    previous_application_details TEXT,
    personal_statement TEXT NOT NULL,
    documents_submitted_in_person BOOLEAN DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'pending',
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scholarship_applications_scholarship ON scholarship_applications (scholarship_id);
CREATE INDEX IF NOT EXISTS idx_scholarship_applications_status ON scholarship_applications (status);

CREATE TABLE IF NOT EXISTS online_course_categories (
    slug TEXT PRIMARY KEY,
    section_title TEXT NOT NULL,
    section_lead TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS online_courses (
    id BIGSERIAL PRIMARY KEY,
    category_slug TEXT REFERENCES online_course_categories (slug) ON DELETE SET NULL,
    course_key TEXT NOT NULL UNIQUE,
    display_title TEXT NOT NULL,
    enroll_course_name TEXT,
    price_label TEXT,
    structured_text TEXT,
    pace_text TEXT,
    amount_sle_minor INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_online_courses_active ON online_courses (is_active);

CREATE TABLE IF NOT EXISTS online_course_ratings (
    id BIGSERIAL PRIMARY KEY,
    course_key TEXT NOT NULL,
    stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment TEXT,
    rater_email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_online_course_ratings_course ON online_course_ratings (course_key);

-- Insert training category
INSERT INTO online_course_categories (slug, section_title, section_lead, sort_order)
VALUES ('trainings', 'Professional Development Trainings', 'Short-term skill-building programs for immediate impact', 10)
ON CONFLICT (slug) DO NOTHING;

-- Insert Digital Skills Training course
INSERT INTO online_courses (category_slug, course_key, display_title, enroll_course_name, price_label, structured_text, pace_text, amount_sle_minor, sort_order, is_active)
VALUES ('trainings', 'digital-skills-training', 'Digital Skills Training', 'Digital Skills Training', 'Le 1,500', 'Gain practical digital skills while waiting for results', '1 Month', 150000, 1, TRUE)
ON CONFLICT (course_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS training_registrations (
    id BIGSERIAL PRIMARY KEY,
    fullname TEXT NOT NULL,
    gender TEXT NOT NULL,
    age TEXT NOT NULL,
    address TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
