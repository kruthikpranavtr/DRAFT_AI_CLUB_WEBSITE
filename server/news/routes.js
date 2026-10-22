import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as db from '../db.js';
import { requireAdmin,requirePermission } from '../auth.js';
import { PERMISSIONS } from '../permissions.js';
import { NEWS_CATEGORIES,LEGACY_NEWS_CATEGORIES,safeNewsUrl,opportunityState } from '../../shared/news.js';
import { plainText } from './normalize.js';
import { sourceCatalog,approvedSourceIds,publicNewsCondition,createNewsService } from './service.js';

const service=createNewsService(db);
const sourceFor = id => sourceCatalog.find(source => source.id===id);
const date=z.string().datetime({offset:true}).nullable().default(null);
const short=z.string().trim().max(300).nullable().default(null);
const url=z.string().max(2000).refine(value => Boolean(safeNewsUrl(value)),'Use a public HTTPS URL.').nullable().default(null);
const opportunitySchema=z.object({
  name:short,organizer:short,format:z.enum(['online','offline','hybrid']).nullable().default(null),location:short,
  registrationOpen:date,registrationDeadline:date,startDate:date,endDate:date,
  eligibility:short,teamSize:short,prizeDetails:short,registrationUrl:url,
  verificationStatus:z.enum(['unknown','unverified','verified']).default('unknown'),lastVerified:date,
}).superRefine((value,ctx) => {
  if (value.startDate && value.endDate && Date.parse(value.startDate)>Date.parse(value.endDate)) ctx.addIssue({code:'custom',message:'Event end must follow its start.'});
  if (value.registrationOpen && value.registrationDeadline && Date.parse(value.registrationOpen)>Date.parse(value.registrationDeadline)) ctx.addIssue({code:'custom',message:'Registration deadline must follow opening.'});
  if (value.verificationStatus==='verified' && (!value.registrationUrl || !value.lastVerified)) ctx.addIssue({code:'custom',message:'Verified opportunities need an official registration URL and verification timestamp.'});
});
const editSchema=z.object({
  title:z.string().trim().min(1).max(220),summary:z.string().trim().max(600),body:z.string().max(10000).default(''),
  category:z.enum([...NEWS_CATEGORIES,...LEGACY_NEWS_CATEGORIES]),
  status:z.enum(['draft','published','hidden']),approval:z.enum(['pending','approved','rejected']).default('approved'),
  featured:z.boolean().default(false),archived:z.boolean().default(false),autoArchive:z.boolean().default(true),
  sourceUrl:url,expiresAt:date,opportunity:opportunitySchema.default({}),
});
const joined=`FROM content_entries c LEFT JOIN news_details n ON n.content_id=c.id LEFT JOIN news_sources s ON s.id=n.source_id`;
const categorySql=`COALESCE(n.category,CASE
  WHEN lower(COALESCE(c.payload->>'category',c.type))='ai news' THEN 'AI News'
  WHEN lower(COALESCE(c.payload->>'category',c.type))='technology news' THEN 'Technology News'
  WHEN lower(COALESCE(c.payload->>'category',c.type))='hackathons' THEN 'Hackathons'
  WHEN lower(COALESCE(c.payload->>'category',c.type))='events and opportunities' THEN 'Events and Opportunities'
  WHEN lower(COALESCE(c.payload->>'category',c.type)) ~ 'achiev|award|contest' THEN 'Achievements'
  WHEN lower(COALESCE(c.payload->>'category',c.type)) ~ 'workshop|training|lab' THEN 'Workshops'
  WHEN lower(COALESCE(c.payload->>'category',c.type)) ~ 'announc|update' THEN 'Announcements'
  ELSE 'Events' END)`;
const columns=`c.*,n.source_id,n.canonical_url,n.category AS news_category,n.content_type,n.approval,n.featured AS news_featured,
  n.archived,n.auto_archive,n.expires_at,n.opportunity,n.published_at AS source_published_at,n.collected_at,n.author,${categorySql} AS display_category`;
function serialize(row,{admin=false}={}) {
  const source=sourceFor(row.source_id);
  const payload=db.json(row.payload,{});
  const details={opportunity:db.json(row.opportunity,{}),expires_at:row.expires_at};
  const timing=opportunityState(details);
  const news={sourceId:row.source_id || null,sourceName:source?.name || null,sourceUrl:row.canonical_url || null,
    category:row.news_category || row.display_category || payload.category || row.type,contentType:row.content_type || 'manual',
    featured:row.news_featured ?? Boolean(payload.featured),archived:Boolean(row.archived || (row.auto_archive && timing.completed)),
    autoArchive:row.auto_archive ?? true,expiresAt:row.expires_at || null,opportunity:details.opportunity,...timing,
    publishedAt:row.source_published_at || row.published_at,collectedAt:row.collected_at,author:row.author || null,
    license:source?.license || null,attribution:source?.attribution || null};
  if (admin) news.approval=row.approval || 'approved';
  const {id,type,page_key,section_key,title,excerpt,body,status,sort_order,published_at,updated_at}=row;
  return {id,type,page_key,section_key,title,excerpt,body,payload,status,sort_order,published_at,updated_at,news};
}
const pagination=query => ({limit:Math.min(50,Math.max(1,Number.parseInt(query.limit,10)||20)),offset:Math.max(0,Number.parseInt(query.offset,10)||0)});

export const publicNewsRouter=Router();
publicNewsRouter.get('/',async(req,res,next) => {
  try {
    const {limit,offset}=pagination(req.query);
    const values=[approvedSourceIds];
    const filters=["c.page_key='news'",publicNewsCondition];
    const archived=`(COALESCE(n.archived,FALSE) OR (COALESCE(n.auto_archive,FALSE) AND COALESCE(NULLIF(n.opportunity->>'endDate','')::timestamptz,n.expires_at)<=NOW()))`;
    filters.push(req.query.archived==='true'?archived:`NOT COALESCE(${archived},FALSE)`);
    if (req.query.category) { values.push(String(req.query.category)); filters.push(`${categorySql}=$${values.length}`); }
    if (req.query.search) { values.push('%'+String(req.query.search).slice(0,200)+'%'); filters.push(`(c.title||' '||c.excerpt||' '||c.body) ILIKE $${values.length}`); }
    const where=filters.join(' AND ');
    const count=await db.queryOne(`SELECT COUNT(*)::int AS total ${joined} WHERE ${where}`,values);
    const rows=await db.queryRows(`SELECT ${columns} ${joined} WHERE ${where}
      ORDER BY COALESCE(n.featured,(c.payload->>'featured')='true',FALSE) DESC,COALESCE(n.published_at,c.published_at,c.created_at) DESC,c.id
      LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,limit,offset]);
    res.json({items:rows.map(row => serialize(row)),total:count.total,limit,offset});
  } catch(error) { next(error); }
});

export const adminNewsRouter=Router();
adminNewsRouter.use(requireAdmin,requirePermission(PERMISSIONS.CONTENT_NEWS));
adminNewsRouter.get('/',async(req,res,next) => {
  try {
    const {limit,offset}=pagination(req.query);
    const values=[];
    const filters=["c.page_key='news'"];
    if (req.query.approval) { values.push(String(req.query.approval)); filters.push(`COALESCE(n.approval,'approved')=$${values.length}`); }
    if (req.query.search) { values.push('%'+String(req.query.search).slice(0,200)+'%'); filters.push(`(c.title||' '||c.excerpt) ILIKE $${values.length}`); }
    const where=filters.join(' AND ');
    const count=await db.queryOne(`SELECT COUNT(*)::int AS total ${joined} WHERE ${where}`,values);
    const rows=await db.queryRows(`SELECT ${columns} ${joined} WHERE ${where} ORDER BY c.updated_at DESC,c.id LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,limit,offset]);
    res.json({items:rows.map(row => serialize(row,{admin:true})),total:count.total});
  } catch(error) { next(error); }
});
adminNewsRouter.get('/sources',async(req,res,next) => {
  try {
    const states=await db.queryRows('SELECT * FROM news_sources ORDER BY id');
    res.json({items:sourceCatalog.map(source => ({...source,enabled:Boolean(states.find(row => row.id===source.id)?.enabled)}))});
  } catch(error) { next(error); }
});
adminNewsRouter.put('/sources/:id',async(req,res,next) => {
  try {
    const {enabled}=z.object({enabled:z.boolean()}).strict().parse(req.body);
    const source=sourceFor(req.params.id);
    if (!source || (enabled && !source.verified)) return res.status(400).json({error:'Only independently reviewed allowlisted sources can be enabled.'});
    await db.query(`INSERT INTO news_sources (id,enabled,updated_by) VALUES ($1,$2,$3)
      ON CONFLICT (id) DO UPDATE SET enabled=EXCLUDED.enabled,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[source.id,enabled,req.user.id]);
    await db.audit(req.user.id,'news.source-updated','news-source',source.id,{enabled});
    res.json({ok:true});
  } catch(error) { next(error); }
});
adminNewsRouter.get('/policies',async(req,res,next) => {
  try { res.json({items:await db.queryRows('SELECT * FROM news_category_policies ORDER BY category')}); }
  catch(error) { next(error); }
});
adminNewsRouter.put('/policies',async(req,res,next) => {
  try {
    const input=z.object({category:z.enum(NEWS_CATEGORIES),autoPublish:z.boolean()}).parse(req.body);
    if (input.autoPublish && !['AI News','Technology News'].includes(input.category)) return res.status(400).json({error:'Opportunities always require human review.'});
    await db.query('UPDATE news_category_policies SET auto_publish=$2 WHERE category=$1',[input.category,input.autoPublish]);
    await db.audit(req.user.id,'news.policy-updated','news-policy',input.category,input);
    res.json({ok:true});
  } catch(error) { next(error); }
});
adminNewsRouter.get('/runs',async(req,res,next) => {
  try { res.json({items:await db.queryRows('SELECT id,trigger_type,started_at,finished_at,status,results FROM news_ingestion_runs ORDER BY started_at DESC LIMIT 30')}); }
  catch(error) { next(error); }
});
adminNewsRouter.post('/collect',rateLimit({windowMs:60000,limit:2,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res,next) => {
  try {
    const result=await service.collect({trigger:'admin',actorId:req.user.id});
    await db.audit(req.user.id,'news.collection','news-run',result.id,{status:result.status});
    res.json(result);
  } catch(error) { next(error); }
});

async function save(req,res,next) {
  try {
    const input=editSchema.parse(req.body);
    const id=req.params.id || crypto.randomUUID();
    await db.withTransaction(async tx => {
      const existing=req.params.id ? await tx.queryOne(`SELECT c.*,n.source_id,n.canonical_url FROM content_entries c LEFT JOIN news_details n ON n.content_id=c.id WHERE c.id=$1 AND c.page_key='news' FOR UPDATE OF c`,[id]) : null;
      if (req.params.id && !existing) { const error=new Error('News entry not found.'); error.status=404; throw error; }
      const source=sourceFor(existing?.source_id);
      if (input.status==='published' && input.approval!=='approved') { const error=new Error('Approve the entry before publishing.'); error.status=400; throw error; }
      if (input.status==='published' && existing?.source_id) {
        const state=await tx.queryOne('SELECT enabled FROM news_sources WHERE id=$1 FOR SHARE',[existing.source_id]);
        if (!source?.verified || !state?.enabled) { const error=new Error('Disabled or unverified sources cannot be published.'); error.status=400; throw error; }
      }
      const payload={...db.json(existing?.payload,{}),category:input.category,featured:input.featured};
      const canonicalUrl=existing?.source_id ? existing.canonical_url : input.sourceUrl ? safeNewsUrl(input.sourceUrl) : null;
      const values=[id,plainText(input.title,220),plainText(input.summary,600),existing?.source_id?'':plainText(input.body,10000),JSON.stringify(payload),input.status,req.user.id];
      await tx.query(`INSERT INTO content_entries (id,type,page_key,section_key,title,excerpt,body,payload,status,published_at,updated_by)
        VALUES ($1,'news','news',$1,$2,$3,$4,$5,$6,CASE WHEN $6='published' THEN NOW() END,$7)
        ON CONFLICT (id) DO UPDATE SET title=$2,excerpt=$3,body=$4,payload=$5,status=$6,updated_by=$7,updated_at=NOW(),
          published_at=CASE WHEN $6='published' THEN COALESCE(content_entries.published_at,NOW()) ELSE content_entries.published_at END`,values);
      const opportunity=Object.fromEntries(Object.entries(input.opportunity).map(([key,value]) => [key,typeof value==='string' && !key.endsWith('Date') && !['registrationUrl','lastVerified','registrationOpen','registrationDeadline'].includes(key) ? plainText(value,300) : value]));
      await tx.query(`INSERT INTO news_details (content_id,canonical_url,category,content_type,approval,featured,archived,auto_archive,expires_at,opportunity)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (content_id) DO UPDATE SET
        canonical_url=EXCLUDED.canonical_url,category=EXCLUDED.category,approval=EXCLUDED.approval,featured=EXCLUDED.featured,
        archived=EXCLUDED.archived,auto_archive=EXCLUDED.auto_archive,expires_at=EXCLUDED.expires_at,opportunity=EXCLUDED.opportunity,updated_at=NOW()`,
      [id,canonicalUrl,input.category,input.category==='Hackathons'?'hackathon':input.category==='Events and Opportunities'?'event':'manual',input.approval,input.featured,input.archived,input.autoArchive,input.expiresAt,JSON.stringify(opportunity)]);
      await db.audit(req.user.id,existing?'news.updated':'news.created','content',id,{status:input.status,approval:input.approval},tx);
    });
    res.status(req.params.id?200:201).json({id});
  } catch(error) {
    if (error.status) return res.status(error.status).json({error:error.message});
    if (error.code==='23505') return res.status(409).json({error:'This source URL already exists.'});
    next(error);
  }
}
adminNewsRouter.post('/',save);
adminNewsRouter.put('/:id',save);
adminNewsRouter.delete('/:id',async(req,res,next) => {
  try {
    const result=await db.query("DELETE FROM content_entries WHERE id=$1 AND page_key='news' RETURNING id",[req.params.id]);
    if (!result.rowCount) return res.status(404).json({error:'News entry not found.'});
    await db.audit(req.user.id,'news.deleted','content',req.params.id);
    res.status(204).end();
  } catch(error) { next(error); }
});
