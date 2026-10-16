import crypto from 'node:crypto';
import { query, queryOne, now } from './db.js';
import { hashPassword } from './passwords.js';
import { PERMISSIONS } from './permissions.js';

async function ensureUser({ memberId, email, name, password, role }) {
  const existing = email
    ? await queryOne(
        `SELECT id, member_id, role FROM users
         WHERE member_id = $1 OR email = $2`,
        [memberId, email]
      )
    : await queryOne(
        `SELECT id, member_id, role FROM users
         WHERE member_id = $1`,
        [memberId]
      );
  if (existing) {
    if (existing.role !== role) throw new Error(`Bootstrap identity ${memberId} has an unexpected role.`);
    return existing.id;
  }
  if (role === 'admin' && !email) throw new Error('Bootstrap administrator email is required.');
  if (!password) throw new Error(`A bootstrap password is required to create ${memberId}.`);
  const id = crypto.randomUUID();
  const time = now();
  await query(
    `INSERT INTO users
     (id, member_id, email, name, password_hash, role, status, permissions, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      memberId,
      email,
      name,
      await hashPassword(password),
      role,
      'active',
      JSON.stringify(role === 'admin' ? [PERMISSIONS.SUPER_ADMIN] : []),
      time,
      time,
    ]
  );
  return id;
}

async function ensureContent(adminId) {
  const time = now();
  const entries = [
    ['page-section', 'home', 'hero', 'Build with AI. Shape what comes next.', 'AI CLUB · SRI SHAKTHI', 'Learn, build, research and create with a student community exploring what artificial intelligence can become.', { align: 'left', tone: 'hero', index: '01' }, 0],
    ['page-section', 'home', 'discover', 'Curiosity becomes capability.', 'DISCOVER', 'Workshops, paper discussions and hands-on sessions help members move from curiosity to practical understanding.', { align: 'left', tone: 'cyan', index: '02' }, 1],
    ['page-section', 'home', 'create', 'Ideas become working systems.', 'CREATE', 'Student teams experiment with models, agents, computer vision and generative AI.', { align: 'right', tone: 'teal', index: '03' }, 2],
    ['page-section', 'home', 'connect', 'Grow together. Build what comes next.', 'CONNECT', 'Projects, events, research and people come together as one open network.', { align: 'left', tone: 'gold', index: '04' }, 3],
    ['news', 'news', 'applied-ai-lab', 'Applied AI Lab announcement', 'FEATURED UPDATE', 'The next Applied AI Lab session is now open for student registration.', { date: '18', month: 'OCT', category: 'Workshop' }, 0],
    ['announcement', 'global', 'welcome', 'Applications are open', '', 'Complete the eight-level assessment pathway to apply for AI Club membership.', { banner: true }, 0],
    ['page-section', 'about', 'faculty-coordinator', 'Faculty Coordinator', 'FACULTY', 'Official faculty profile details can be updated by the administrator.', { group: 'faculty', mark: 'FC' }, 0],
    ['page-section', 'about', 'faculty-mentor', 'Faculty Mentor', 'FACULTY', 'Mentorship, approvals and academic guidance for club activities.', { group: 'faculty', mark: 'FM' }, 1],
    ['page-section', 'about', 'team-computer-vision', 'Computer Vision', 'STUDENT TEAM', 'Vision systems, image models and real-time applications.', { group: 'students', mark: 'CV' }, 2],
    ['page-section', 'about', 'team-nlp', 'NLP & GenAI', 'STUDENT TEAM', 'Language models, retrieval systems and agent experiments.', { group: 'students', mark: 'NL' }, 3],
    ['page-section', 'about', 'team-machine-learning', 'Machine Learning', 'STUDENT TEAM', 'Applied ML, forecasting, tabular modelling and competitions.', { group: 'students', mark: 'ML' }, 4],
    ['page-section', 'about', 'team-operations', 'Outreach & Operations', 'STUDENT TEAM', 'Events, collaborations, community and club operations.', { group: 'students', mark: 'OR' }, 5],
  ];

  for (const [type, page, section, title, excerpt, body, payload, order] of entries) {
    const existing = await queryOne(
      'SELECT id FROM content_entries WHERE type = $1 AND page_key = $2 AND section_key = $3',
      [type, page, section]
    );
    if (existing) continue;
    await query(
      `INSERT INTO content_entries
       (id, type, page_key, section_key, title, excerpt, body, payload, status, sort_order, published_at, created_at, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', $9, $10, $10, $10, $11)`,
      [crypto.randomUUID(), type, page, section, title, excerpt, body, JSON.stringify(payload), order, time, adminId]
    );
  }
}

async function ensureSettings(adminId) {
  const time = now();
  const values = {
    'site.name': 'AI Club · Sri Shakthi',
    'contact.email': 'aiclub@srishakthi.ac.in',
    'contact.phone': '',
    'announcement.enabled': true,
    'announcement.text': 'Applications for the AI Club are open.',
    'banner.enabled': false,
    'banner.text': '',
  };
  for (const [key, value] of Object.entries(values)) {
    await query(
      `INSERT INTO settings (key, value, is_public, updated_at, updated_by)
       VALUES ($1, $2, TRUE, $3, $4)
       ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(value), time, adminId]
    );
  }
}

export async function seedDatabase() {
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const studentPassword = process.env.BOOTSTRAP_STUDENT_PASSWORD || '';

  const adminId = await ensureUser({
    memberId: process.env.BOOTSTRAP_ADMIN_ID || 'ADMIN-01',
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@srishakthi.ac.in',
    name: process.env.BOOTSTRAP_ADMIN_NAME || 'Club Administrator',
    password: adminPassword,
    role: 'admin',
  });

  if (studentPassword) {
    await ensureUser({
      memberId: process.env.BOOTSTRAP_STUDENT_ID || 'SSAC-2026-014',
      email: process.env.BOOTSTRAP_STUDENT_EMAIL || 'student@srishakthi.ac.in',
      name: process.env.BOOTSTRAP_STUDENT_NAME || 'AI Club Student',
      password: studentPassword,
      role: 'student',
    });
  }

  await ensureContent(adminId);
  await ensureSettings(adminId);
}
