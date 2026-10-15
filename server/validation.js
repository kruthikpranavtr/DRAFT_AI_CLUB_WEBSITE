import { z } from 'zod';

export const loginSchema = z.object({
  identifier:z.string().trim().min(2).max(160),
  password:z.string().min(8).max(200),
  remember:z.boolean().optional().default(true),
});

export const changePasswordSchema = z.object({
  currentPassword:z.string().min(8).max(200),
  newPassword:z.string().min(12).max(200),
}).refine(input => input.currentPassword !== input.newPassword,{
  message:'The new password must be different from the current password.',
  path:['newPassword'],
});

export const contentSchema = z.object({
  type:z.string().trim().min(2).max(50),
  pageKey:z.string().trim().min(2).max(80),
  sectionKey:z.string().trim().min(2).max(80),
  title:z.string().trim().min(1).max(240),
  excerpt:z.string().max(1000).optional().default(''),
  body:z.string().max(50000).optional().default(''),
  payload:z.record(z.string(), z.unknown()).optional().default({}),
  status:z.enum(['draft','published','hidden']).optional().default('draft'),
  sortOrder:z.coerce.number().int().min(-10000).max(10000).optional().default(0),
});

export const categorySchema = z.object({
  name:z.string().trim().min(1).max(100),
  slug:z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  description:z.string().max(1000).optional().default(''),
});

export const gallerySchema = z.object({
  categoryId:z.string().uuid().nullable().optional(),
  title:z.string().trim().min(1).max(180),
  caption:z.string().max(1000).optional().default(''),
  altText:z.string().trim().min(3).max(300),
  fileId:z.string().uuid(),
  status:z.enum(['draft','published','hidden']).optional().default('draft'),
  sortOrder:z.coerce.number().int().min(-10000).max(10000).optional().default(0),
});

const optionalEmail = z.union([z.string().trim().email().max(160),z.null()]).optional().default(null)
  .transform(value => value ? value.toLowerCase() : null);

const optionalProfileUrl = (hosts,label) => z.preprocess(
  value => typeof value === 'string' && !value.trim() ? null : value,
  z.union([z.url().max(500),z.null()]).optional().default(null)
).superRefine((value,ctx) => {
  if (!value) return;
  const url = new URL(value);
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname.toLowerCase())) {
    ctx.addIssue({ code:'custom',message:`Enter a valid HTTPS ${label} profile URL.` });
  }
});

export const studentProfileSchema = z.object({
  department:z.string().trim().max(120).optional().default(''),
  academicYear:z.union([z.coerce.number().int().min(1).max(6),z.null()]).optional().default(null),
  githubUrl:optionalProfileUrl(['github.com','www.github.com'],'GitHub'),
  linkedinUrl:optionalProfileUrl(['linkedin.com','www.linkedin.com'],'LinkedIn'),
  hackerrankUrl:optionalProfileUrl(['hackerrank.com','www.hackerrank.com'],'HackerRank'),
  description:z.string().trim().max(2000).optional().default(''),
  skills:z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
}).transform(input => {
  const seen = new Set();
  return {
    ...input,
    skills:input.skills.filter(skill => {
      const key = skill.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
});

const userFields = {
  memberId:z.string().trim().min(3).max(80),
  email:optionalEmail,
  name:z.string().trim().min(2).max(160),
  role:z.enum(['admin','student']).default('student'),
  status:z.enum(['active','inactive','suspended']).default('active'),
  permissions:z.array(z.string().max(80)).max(50).optional().default([]),
};

function requireAdminEmail(input,ctx) {
  if (input.role === 'admin' && !input.email) {
    ctx.addIssue({ code:'custom',path:['email'],message:'Administrator accounts require an email address.' });
  }
}

export const userSchema = z.object({ ...userFields,profile:studentProfileSchema.optional() }).superRefine(requireAdminEmail);
export const userCreateSchema = z.object({
  ...userFields,
  password:z.string().min(12).max(200),
  profile:studentProfileSchema.optional(),
}).superRefine(requireAdminEmail);

export const studentAccountUpdateSchema = z.object({
  memberId:userFields.memberId,
  email:optionalEmail,
  name:userFields.name,
  status:userFields.status,
  profile:studentProfileSchema.optional(),
});

export const temporaryPasswordSchema = z.object({
  temporaryPassword:z.string().min(12).max(200),
});

export const settingSchema = z.object({
  value:z.unknown(),
  isPublic:z.boolean().optional().default(true),
});
