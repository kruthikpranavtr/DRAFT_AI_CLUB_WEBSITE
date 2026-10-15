import { db,now } from './db.js';

export function ensureStudentProfile(userId,time = now()) {
  db.prepare(`INSERT OR IGNORE INTO student_profiles (user_id,created_at,updated_at)
    VALUES (?,?,?)`).run(userId,time,time);
}

export function replaceProfileSkills(userId,skills,time = now()) {
  db.prepare('DELETE FROM profile_skills WHERE user_id=?').run(userId);
  const insert = db.prepare(`INSERT INTO profile_skills
    (user_id,skill_name,sort_order,created_at) VALUES (?,?,?,?)`);
  skills.forEach((skill,index) => insert.run(userId,skill,index,time));
}

export function updateStudentProfile(userId,profile,time = now()) {
  ensureStudentProfile(userId,time);
  db.prepare(`UPDATE student_profiles SET department=?,academic_year=?,github_url=?,linkedin_url=?,
    hackerrank_url=?,description=?,updated_at=? WHERE user_id=?`).run(
    profile.department,profile.academicYear,profile.githubUrl,profile.linkedinUrl,
    profile.hackerrankUrl,profile.description,time,userId
  );
  replaceProfileSkills(userId,profile.skills,time);
}

export function profileSkills(userId) {
  return db.prepare(`SELECT skill_name FROM profile_skills
    WHERE user_id=? ORDER BY sort_order,skill_name`).all(userId).map(row => row.skill_name);
}

export function profileResponse(row,{ includeEmail = false,includeIdentity = includeEmail } = {}) {
  return {
    id:row.id,
    ...(includeIdentity ? { memberId:row.member_id } : {}),
    name:row.name,
    ...(includeEmail ? { email:row.email } : {}),
    department:row.department || '',
    academicYear:row.academic_year ?? null,
    githubUrl:row.github_url || null,
    linkedinUrl:row.linkedin_url || null,
    hackerrankUrl:row.hackerrank_url || null,
    description:row.description || '',
    skills:profileSkills(row.id),
    avatarUrl:row.avatar_file_id ? `/api/members/media/${row.avatar_file_id}` : null,
    updatedAt:row.profile_updated_at || row.updated_at,
  };
}

export function findStudentProfile(userId) {
  return db.prepare(`SELECT u.id,u.member_id,u.email,u.name,u.status,u.created_at,u.updated_at,
      p.department,p.academic_year,p.github_url,p.linkedin_url,p.hackerrank_url,p.description,
      p.avatar_file_id,p.updated_at profile_updated_at
    FROM users u LEFT JOIN student_profiles p ON p.user_id=u.id
    WHERE u.id=? AND u.role='student'`).get(userId);
}
