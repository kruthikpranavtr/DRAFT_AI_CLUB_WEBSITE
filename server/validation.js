import { z } from 'zod';

export const loginSchema = z.object({
  identifier:z.string().trim().min(2).max(160),
  password:z.string().min(8).max(200),
  remember:z.boolean().optional().default(true),
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

export const userSchema = z.object({
  memberId:z.string().trim().min(3).max(80),
  email:z.string().email().max(160),
  name:z.string().trim().min(2).max(160),
  password:z.string().min(10).max(200).optional(),
  role:z.enum(['admin','student']).default('student'),
  status:z.enum(['active','inactive','suspended']).default('active'),
  permissions:z.array(z.string().max(80)).max(50).optional().default([]),
});

export const settingSchema = z.object({
  value:z.unknown(),
  isPublic:z.boolean().optional().default(true),
});
