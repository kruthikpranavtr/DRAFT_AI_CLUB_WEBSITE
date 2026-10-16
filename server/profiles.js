import { query, queryOne, queryRows, now, json } from './db.js';

const resolveRunner = (runner) => (typeof runner === 'function' ? runner : (runner?.query ? runner.query.bind(runner) : query));

export async function ensureStudentProfile(userId, time = now(), runner = query) {
  const q = resolveRunner(runner);
  await q(
    `INSERT INTO student_profiles (user_id, created_at, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, time, time]
  );
}

export async function replaceProfileSkills(userId, skills, time = now(), runner = query) {
  const q = resolveRunner(runner);
  await q('DELETE FROM profile_skills WHERE user_id = $1', [userId]);
  if (skills && Array.isArray(skills)) {
    for (let index = 0; index < skills.length; index++) {
      await q(
        `INSERT INTO profile_skills (user_id, skill_name, sort_order, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, skill_name) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
        [userId, skills[index], index, time]
      );
    }
  }
}

export async function updateStudentProfile(userId, profile, time = now(), runner = query) {
  const q = resolveRunner(runner);
  await ensureStudentProfile(userId, time, q);
  await q(
    `UPDATE student_profiles SET department = $1, academic_year = $2, github_url = $3, linkedin_url = $4,
     hackerrank_url = $5, description = $6, updated_at = $7 WHERE user_id = $8`,
    [
      profile.department, profile.academicYear, profile.githubUrl, profile.linkedinUrl,
      profile.hackerrankUrl, profile.description, time, userId
    ]
  );
  await replaceProfileSkills(userId, profile.skills, time, q);
}

export async function profileSkills(userId) {
  const rows = await queryRows(
    `SELECT skill_name FROM profile_skills
     WHERE user_id = $1 ORDER BY sort_order, skill_name`,
    [userId]
  );
  return rows.map(row => row.skill_name);
}

export async function profileResponse(row, { includeEmail = false, includeIdentity = includeEmail } = {}) {
  if (!row) return null;
  const skills = row.skills && Array.isArray(row.skills) ? row.skills : await profileSkills(row.id);
  return {
    id: row.id,
    ...(includeIdentity ? { memberId: row.member_id } : {}),
    name: row.name,
    ...(includeEmail ? { email: row.email } : {}),
    department: row.department || '',
    academicYear: row.academic_year ?? null,
    githubUrl: row.github_url || null,
    linkedinUrl: row.linkedin_url || null,
    hackerrankUrl: row.hackerrank_url || null,
    description: row.description || '',
    skills,
    avatarUrl: row.avatar_file_id ? `/api/members/media/${row.avatar_file_id}` : null,
    updatedAt: row.profile_updated_at || row.updated_at,
  };
}

export async function findStudentProfile(userId) {
  return await queryOne(
    `SELECT u.id, u.member_id, u.email, u.name, u.status, u.created_at, u.updated_at,
        p.department, p.academic_year, p.github_url, p.linkedin_url, p.hackerrank_url, p.description,
        p.avatar_file_id, p.updated_at AS profile_updated_at
     FROM users u LEFT JOIN student_profiles p ON p.user_id = u.id
     WHERE u.id = $1 AND u.role = 'student'`,
    [userId]
  );
}
