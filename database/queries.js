const { query, isMissingRelation } = require('./pg');

const COUNT_TABLES = new Set(['messages', 'contacts', 'enrollments', 'payments']);

async function countRows(table, sinceIso = null) {
    if (!COUNT_TABLES.has(table)) {
        throw new Error(`Invalid table for count: ${table}`);
    }
    if (sinceIso) {
        const { rows } = await query(
            `SELECT COUNT(*)::int AS count FROM ${table} WHERE timestamp >= $1`,
            [sinceIso]
        );
        return rows[0].count;
    }
    const { rows } = await query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    return rows[0].count;
}

async function insertMessage(row) {
    const { rows } = await query(
        `INSERT INTO messages (session_id, sender, message, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [row.session_id, row.sender, row.message, row.ip_address, row.user_agent]
    );
    return rows[0];
}

async function getMessagesBySession(sessionId) {
    const { rows } = await query(
        `SELECT * FROM messages WHERE session_id = $1 ORDER BY timestamp ASC`,
        [sessionId]
    );
    return rows;
}

async function insertContact(row) {
    const { rows } = await query(
        `INSERT INTO contacts (name, email, phone, subject, message, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [row.name, row.email, row.phone, row.subject, row.message, row.ip_address, row.user_agent]
    );
    return rows[0];
}

async function listContacts() {
    const { rows } = await query(`SELECT * FROM contacts ORDER BY timestamp DESC`);
    return rows;
}

async function insertEnquiry(row) {
    const { rows } = await query(
        `INSERT INTO enquiries (name, email, phone, programme_interest, preferred_intake, message, newsletter, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
            row.name,
            row.email,
            row.phone,
            row.programme_interest,
            row.preferred_intake,
            row.message,
            row.newsletter,
            row.ip_address,
            row.user_agent
        ]
    );
    return rows[0];
}

async function listEnquiries() {
    const { rows } = await query(`SELECT * FROM enquiries ORDER BY timestamp DESC`);
    return rows;
}

async function insertEnrollment(row) {
    const { rows } = await query(
        `INSERT INTO enrollments (course_name, first_name, last_name, email, phone, payment_method, mobile_number, enrollment_fee, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
            row.course_name,
            row.first_name,
            row.last_name,
            row.email,
            row.phone,
            row.payment_method,
            row.mobile_number,
            row.enrollment_fee,
            row.ip_address,
            row.user_agent
        ]
    );
    return rows[0];
}

async function listEnrollments() {
    const { rows } = await query(`SELECT * FROM enrollments ORDER BY timestamp DESC`);
    return rows;
}

async function insertPayment(row) {
    const { rows } = await query(
        `INSERT INTO payments (
            course_name, full_name, email, phone, address, city, country,
            date_of_birth, gender, emergency_contact, emergency_phone,
            delivery_mode, intake_period, application_fee, payment_status,
            payment_reference, payment_provider, ip_address, user_agent
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING *`,
        [
            row.course_name,
            row.full_name,
            row.email,
            row.phone,
            row.address,
            row.city,
            row.country,
            row.date_of_birth,
            row.gender,
            row.emergency_contact,
            row.emergency_phone,
            row.delivery_mode,
            row.intake_period,
            row.application_fee,
            row.payment_status,
            row.payment_reference,
            row.payment_provider,
            row.ip_address,
            row.user_agent
        ]
    );
    return rows[0];
}

async function getPaymentByReference(paymentReference) {
    const { rows } = await query(
        `SELECT id, payment_reference, payment_status FROM payments WHERE payment_reference = $1 LIMIT 1`,
        [paymentReference]
    );
    return rows[0] || null;
}

async function updatePaymentStatusById(id, paymentStatus) {
    const { rows } = await query(
        `UPDATE payments SET payment_status = $1 WHERE id = $2
         RETURNING id, payment_status, payment_reference`,
        [paymentStatus, id]
    );
    return rows[0] || null;
}

async function updatePaymentById(paymentId, fields) {
    const sets = ['payment_status = $1'];
    const params = [fields.payment_status];
    let i = 2;
    if (fields.payment_reference != null) {
        sets.push(`payment_reference = $${i++}`);
        params.push(fields.payment_reference);
    }
    params.push(paymentId);
    const { rows } = await query(
        `UPDATE payments SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        params
    );
    return rows[0] || null;
}

async function listPayments(filters = {}) {
    const conditions = [];
    const params = [];
    let i = 1;
    if (filters.status) {
        conditions.push(`payment_status = $${i++}`);
        params.push(filters.status);
    }
    if (filters.course) {
        conditions.push(`course_name = $${i++}`);
        params.push(filters.course);
    }
    if (filters.reference) {
        conditions.push(`payment_reference = $${i++}`);
        params.push(filters.reference);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
        `SELECT * FROM payments ${where} ORDER BY timestamp DESC`,
        params
    );
    return rows;
}

async function listActiveScholarships() {
    const { rows } = await query(
        `SELECT * FROM scholarships WHERE is_active = TRUE ORDER BY deadline ASC NULLS LAST`
    );
    return rows;
}

async function getActiveScholarshipById(id) {
    const { rows } = await query(
        `SELECT * FROM scholarships WHERE id = $1 AND is_active = TRUE LIMIT 1`,
        [id]
    );
    return rows[0] || null;
}

async function countScholarships() {
    const { rows } = await query(`SELECT COUNT(*)::int AS count FROM scholarships`);
    return rows[0].count;
}

async function sampleScholarships(limit = 1) {
    const { rows } = await query(`SELECT * FROM scholarships LIMIT $1`, [limit]);
    return rows;
}

async function listScholarshipsSample(limit = 10, activeOnly = false) {
    if (activeOnly) {
        const { rows } = await query(
            `SELECT id, title, is_active, deadline FROM scholarships WHERE is_active = TRUE LIMIT $1`,
            [limit]
        );
        return rows;
    }
    const { rows } = await query(
        `SELECT id, title, is_active FROM scholarships LIMIT $1`,
        [limit]
    );
    return rows;
}

async function insertScholarshipApplication(row) {
    const { rows } = await query(
        `INSERT INTO scholarship_applications (
            scholarship_id, surname, first_name, other_names, gender, date_of_birth,
            nationality, national_id, address, city, phone, email,
            highest_qualification, school_institution, year_of_completion, credits,
            programme, scholarship_type, previous_application, previous_application_details,
            personal_statement, documents_submitted_in_person, ip_address, user_agent
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         RETURNING *`,
        [
            row.scholarship_id,
            row.surname,
            row.first_name,
            row.other_names,
            row.gender,
            row.date_of_birth,
            row.nationality,
            row.national_id,
            row.address,
            row.city,
            row.phone,
            row.email,
            row.highest_qualification,
            row.school_institution,
            row.year_of_completion,
            row.credits,
            row.programme,
            row.scholarship_type,
            row.previous_application,
            row.previous_application_details,
            row.personal_statement,
            row.documents_submitted_in_person,
            row.ip_address,
            row.user_agent
        ]
    );
    return rows[0];
}

async function listScholarshipApplications(filters = {}) {
    const conditions = [];
    const params = [];
    let i = 1;
    if (filters.scholarship_id) {
        conditions.push(`scholarship_id = $${i++}`);
        params.push(filters.scholarship_id);
    }
    if (filters.status) {
        conditions.push(`status = $${i++}`);
        params.push(filters.status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
        `SELECT * FROM scholarship_applications ${where} ORDER BY timestamp DESC`,
        params
    );
    return rows;
}

async function listOnlineCourseCategories() {
    const { rows } = await query(
        `SELECT slug, section_title, section_lead, sort_order
         FROM online_course_categories
         ORDER BY sort_order ASC`
    );
    return rows;
}

async function listActiveOnlineCourses() {
    const { rows } = await query(
        `SELECT category_slug, course_key, display_title, enroll_course_name, price_label,
                structured_text, pace_text, amount_sle_minor, sort_order, is_active
         FROM online_courses
         WHERE is_active = TRUE
         ORDER BY sort_order ASC`
    );
    return rows;
}

async function listOnlineCourseRatingRows() {
    const { rows } = await query(`SELECT course_key, stars FROM online_course_ratings`);
    return rows;
}

async function getRatingStarsForCourse(courseKey) {
    const { rows } = await query(
        `SELECT stars FROM online_course_ratings WHERE course_key = $1`,
        [courseKey]
    );
    return rows;
}

async function insertOnlineCourseRating(row) {
    await query(
        `INSERT INTO online_course_ratings (course_key, stars, comment, rater_email, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.course_key, row.stars, row.comment, row.rater_email, row.ip_address, row.user_agent]
    );
}

async function getCourseAmountByEnrollName(courseName) {
    const { rows } = await query(
        `SELECT amount_sle_minor FROM online_courses
         WHERE is_active = TRUE AND enroll_course_name = $1
         LIMIT 1`,
        [courseName]
    );
    return rows[0] || null;
}

async function getCourseAmountByKey(courseKey) {
    const { rows } = await query(
        `SELECT amount_sle_minor FROM online_courses
         WHERE is_active = TRUE AND course_key = $1
         LIMIT 1`,
        [courseKey]
    );
    return rows[0] || null;
}

async function createTrainingRegistration(row) {
    const { rows } = await query(
        `INSERT INTO training_registrations (fullname, gender, age, address, whatsapp, email, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [row.fullname, row.gender, row.age, row.address, row.whatsapp, row.email, row.ip_address, row.user_agent]
    );
    return rows[0];
}

module.exports = {
    isMissingRelation,
    countRows,
    insertMessage,
    getMessagesBySession,
    insertContact,
    listContacts,
    insertEnquiry,
    listEnquiries,
    insertEnrollment,
    listEnrollments,
    insertPayment,
    getPaymentByReference,
    updatePaymentStatusById,
    updatePaymentById,
    listPayments,
    listActiveScholarships,
    getActiveScholarshipById,
    countScholarships,
    sampleScholarships,
    listScholarshipsSample,
    insertScholarshipApplication,
    listScholarshipApplications,
    listOnlineCourseCategories,
    listActiveOnlineCourses,
    listOnlineCourseRatingRows,
    getRatingStarsForCourse,
    insertOnlineCourseRating,
    getCourseAmountByEnrollName,
    getCourseAmountByKey,
    createTrainingRegistration
};
