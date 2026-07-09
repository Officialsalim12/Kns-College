-- Online course catalog seed data (12 courses).
-- Idempotent: upserts on category slug and course_key. Run after schema migration.

INSERT INTO online_course_categories (slug, section_title, section_lead, sort_order) VALUES
    ('business', 'Business & management', 'Project management, entrepreneurship, accounting, and business technology.', 10),
    ('ict', 'ICT, software & data', 'Digital literacy, cybersecurity, data, hardware, design, and AI essentials.', 20),
    ('microsoft', 'Microsoft & Azure', 'Microsoft Office Specialist and Azure AI learning paths.', 30),
    ('trainings', 'Professional Development Trainings', 'Short-term skill-building programs for immediate impact.', 40)
ON CONFLICT (slug) DO UPDATE SET
    section_title = EXCLUDED.section_title,
    section_lead = EXCLUDED.section_lead,
    sort_order = EXCLUDED.sort_order;

-- Deactivate courses not included in the current catalog.
UPDATE online_courses SET is_active = FALSE
WHERE course_key NOT IN (
    'Project Management',
    'Entrepreneurship & Cybersecurity - ESB Certificate',
    'Accounting & IT Fundamentals',
    'Certificate in Computerized Accounting (QuickBooks)',
    'Digital Literacy',
    'Certificate in Cybersecurity (CC)',
    'Certificate in Data Analysis',
    'CompTIA PC & Hardware program',
    'Graphic Design with AI',
    'AI Essentials',
    'Microsoft Office Specialist (MOS) 2019',
    'Azure AI Courses',
    'digital-skills-training'
);

INSERT INTO online_courses (
    category_slug, course_key, display_title, enroll_course_name,
    price_label, structured_text, pace_text, amount_sle_minor, sort_order, is_active
) VALUES
    ('business', 'Project Management', 'Project Management', 'Project Management',
        'NLe1', 'Structured learning', 'Your pace', 100, 10, TRUE),
    ('business', 'Entrepreneurship & Cybersecurity - ESB Certificate',
        'Entrepreneurship & Cybersecurity - ESB Certificate',
        'Entrepreneurship & Cybersecurity - ESB Certificate',
        'NLe1', 'Modules with case studies', 'Flexible schedule', 100, 20, TRUE),
    ('business', 'Accounting & IT Fundamentals', 'Accounting & IT Fundamentals', 'Accounting & IT Fundamentals',
        'NLe1', 'Structured learning', 'Your pace', 100, 30, TRUE),
    ('business', 'Certificate in Computerized Accounting (QuickBooks)',
        'Certificate in Computerized Accounting (QuickBooks)',
        'Certificate in Computerized Accounting (QuickBooks)',
        'NLe1', 'Hands-on labs', 'Self-paced with tutor support', 100, 40, TRUE),
    ('ict', 'Digital Literacy', 'Digital Literacy', 'Digital Literacy',
        'NLe1', 'Foundation digital skills', 'Self-paced learning', 100, 10, TRUE),
    ('ict', 'Certificate in Cybersecurity (CC)', 'Certificate in Cybersecurity (CC)',
        'Certificate in Cybersecurity (CC)',
        'NLe1', 'Hands-on labs', 'Self-paced with tutor support', 100, 20, TRUE),
    ('ict', 'Certificate in Data Analysis', 'Certificate in Data Analysis', 'Certificate in Data Analysis',
        'NLe1', 'Industry-aligned content', 'Learn at your own pace', 100, 30, TRUE),
    ('ict', 'CompTIA PC & Hardware program', 'CompTIA PC & Hardware program', 'CompTIA PC & Hardware program',
        'NLe1', 'Practical hardware skills', 'Your pace', 100, 40, TRUE),
    ('ict', 'Graphic Design with AI', 'Graphic Design with AI', 'Graphic Design with AI',
        'NLe1', 'Creative project work', 'Flexible schedule', 100, 50, TRUE),
    ('ict', 'AI Essentials', 'AI Essentials', 'AI Essentials',
        'NLe1', 'Microsoft Learn pathways', 'Exam-ready in weeks', 100, 60, TRUE),
    ('microsoft', 'Microsoft Office Specialist (MOS) 2019',
        'Microsoft Office Specialist (MOS) 2019',
        'Microsoft Office Specialist (MOS) 2019',
        'NLe1', 'Skills-based assessments', 'Includes exam voucher', 100, 10, TRUE),
    ('microsoft', 'Azure AI Courses', 'Azure AI Courses', 'Azure AI Courses',
        'NLe1', 'Microsoft Learn pathways', 'Exam-ready in weeks', 100, 20, TRUE),
    ('trainings', 'digital-skills-training', 'Digital Skills Training', 'Digital Skills Training',
        'NLe1', 'Gain practical digital skills while waiting for results', '1 Month', 100, 10, TRUE)
ON CONFLICT (course_key) DO UPDATE SET
    category_slug = EXCLUDED.category_slug,
    display_title = EXCLUDED.display_title,
    enroll_course_name = EXCLUDED.enroll_course_name,
    price_label = EXCLUDED.price_label,
    structured_text = EXCLUDED.structured_text,
    pace_text = EXCLUDED.pace_text,
    amount_sle_minor = EXCLUDED.amount_sle_minor,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;
