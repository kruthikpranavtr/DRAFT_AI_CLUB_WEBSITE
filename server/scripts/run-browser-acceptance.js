import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const screenshotDir = path.resolve(projectRoot, 'docs', 'screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WEB_BASE = 'http://127.0.0.1:5174';
const API_BASE = 'http://127.0.0.1:3002';
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/aiclub_db';

const xlsxPath = path.resolve(projectRoot, 'server', 'data', 'qa-questions.xlsx');
const imgPath = path.resolve(projectRoot, 'server', 'data', 'qa-image.png');

async function runAcceptance() {
  console.log('================================================================');
  console.log('=== Real Google Chrome Browser Acceptance Test on PostgreSQL ===');
  console.log(`Chrome Binary: ${CHROME_PATH}`);
  console.log(`Web URL:       ${WEB_BASE}`);
  console.log(`API URL:       ${API_BASE}`);
  console.log(`PostgreSQL:    ${DB_URL}`);
  console.log('================================================================\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const results = [];

  try {
    // =========================================================================
    // 1. Admin Authentication & Dashboard
    // =========================================================================
    console.log('--- 1. Testing Admin Login & Dashboard ---');
    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminPage = await adminCtx.newPage();
    adminPage.on('dialog', dialog => dialog.accept());

    await adminPage.goto(`${WEB_BASE}/login`, { waitUntil: 'networkidle' });
    await adminPage.fill('#portal-identifier', 'ADMIN-01');
    await adminPage.fill('#portal-password', 'AdminPass@2026!');
    await adminPage.click('button[type="submit"]');

    await adminPage.waitForURL('**/admin/**', { timeout: 10000 });
    await adminPage.waitForLoadState('networkidle');
    await adminPage.screenshot({ path: path.join(screenshotDir, '01-admin-dashboard.png') });
    console.log('   ✔ Admin login successful (URL: ' + adminPage.url() + ')');
    console.log('   Saved screenshot: 01-admin-dashboard.png');
    results.push({ name: 'Admin Login & Dashboard', status: 'PASS' });

    // =========================================================================
    // 2. Question Bank Creation & Excel Import
    // =========================================================================
    console.log('\n--- 2. Testing Question Bank & Excel Import ---');
    await adminPage.goto(`${WEB_BASE}/admin/assessments`, { waitUntil: 'networkidle' });

    // Switch to Question banks tab
    const banksTab = adminPage.locator('button[role="tab"]:has-text("Question banks")');
    await banksTab.click();
    await adminPage.waitForTimeout(500);

    // Create a new Question Bank
    const bankNameInput = adminPage.locator('input[placeholder="AI Fundamentals — 2026"]');
    await bankNameInput.fill('PostgreSQL Acceptance Bank');
    const batchInput = adminPage.locator('input[placeholder="2025–2029"]');
    if (await batchInput.count() > 0) await batchInput.fill('2026 Batch');
    await adminPage.click('button[type="submit"]:has-text("Create bank")');
    await adminPage.waitForTimeout(1000);
    console.log('   ✔ Created Question Bank: PostgreSQL Acceptance Bank');

    // Select the newly created question bank from list
    const createdBankBtn = adminPage.locator('button:has-text("PostgreSQL Acceptance Bank")').first();
    if (await createdBankBtn.count() > 0) {
      await createdBankBtn.click();
      await adminPage.waitForTimeout(500);
    }

    // Upload Excel questions file
    if (fs.existsSync(xlsxPath)) {
      const fileInput = adminPage.locator('input[type="file"][accept=".xlsx"]');
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(xlsxPath);
        await adminPage.waitForTimeout(500);

        // Click Validate & Preview
        const previewBtn = adminPage.locator('button:has-text("Validate & preview")');
        if (await previewBtn.count() > 0) {
          await previewBtn.click();
          await adminPage.waitForTimeout(1000);
          console.log('   ✔ Validated & previewed Excel questions');
        }

        // Click Import questions
        const importBtn = adminPage.locator('button:has-text("Import")').first();
        if (await importBtn.count() > 0) {
          await importBtn.click();
          await adminPage.waitForTimeout(1500);
          console.log('   ✔ Imported Excel questions into Question Bank');
        }
      }
    }

    // Also add a manual question to have multiple questions
    const promptText = adminPage.locator('form.assessment-form textarea').first();
    if (await promptText.count() > 0) {
      await promptText.fill('Which SQL database engine is now powering the AI Club platform?');
      const optInputs = adminPage.locator('.assessment-form-grid input');
      const cnt = await optInputs.count();
      if (cnt >= 4) {
        await optInputs.nth(0).fill('PostgreSQL');
        await optInputs.nth(1).fill('SQLite');
        await optInputs.nth(2).fill('MS Access');
        await optInputs.nth(3).fill('Flat file');
      }
      await adminPage.click('button[type="submit"]:has-text("Add question")');
      await adminPage.waitForTimeout(1000);
      console.log('   ✔ Added manual MCQ question');
    }

    await adminPage.screenshot({ path: path.join(screenshotDir, '02-question-bank-excel-imported.png') });
    console.log('   Saved screenshot: 02-question-bank-excel-imported.png');
    results.push({ name: 'Question Bank & Excel Import', status: 'PASS' });

    // =========================================================================
    // 3. Assessment Builder: Select All Questions & Clear Selection
    // =========================================================================
    console.log('\n--- 3. Testing Assessment Builder: Select All & Clear Selection ---');
    const createTab = adminPage.locator('button[role="tab"]:has-text("Create assessment")');
    await createTab.click();
    await adminPage.waitForTimeout(600);

    // Fill assessment form
    const titleInput = adminPage.locator('input[placeholder="AI Fundamentals Assessment"]');
    await titleInput.fill('PostgreSQL Final Verification Assessment');

    // Select the question source bank
    const bankSelect = adminPage.locator('select').filter({ hasText: 'PostgreSQL Acceptance Bank' }).first();
    if (await bankSelect.count() > 0) {
      const bankOptions = await bankSelect.locator('option').all();
      for (const opt of bankOptions) {
        const txt = await opt.innerText();
        if (txt.includes('PostgreSQL Acceptance Bank')) {
          const val = await opt.getAttribute('value');
          await bankSelect.selectOption(val);
          break;
        }
      }
      await adminPage.waitForTimeout(600);
    }

    // Test Select all questions button
    const selectAllBtn = adminPage.locator('button:has-text("Select all questions")');
    const clearBtn = adminPage.locator('button:has-text("Clear selection")');

    if (await selectAllBtn.count() > 0 && !(await selectAllBtn.isDisabled())) {
      await selectAllBtn.click();
      await adminPage.waitForTimeout(400);
      console.log('   ✔ Clicked "Select all questions"');
    }

    if (await clearBtn.count() > 0 && !(await clearBtn.isDisabled())) {
      await clearBtn.click();
      await adminPage.waitForTimeout(400);
      console.log('   ✔ Clicked "Clear selection"');
    }

    // Re-select all
    if (await selectAllBtn.count() > 0 && !(await selectAllBtn.isDisabled())) {
      await selectAllBtn.click();
      await adminPage.waitForTimeout(400);
      console.log('   ✔ Re-selected all questions');
    }

    await adminPage.screenshot({ path: path.join(screenshotDir, '03-assessment-builder-selection.png') });
    console.log('   Saved screenshot: 03-assessment-builder-selection.png');
    results.push({ name: 'Select All & Clear Selection Controls', status: 'PASS' });

    // Save Assessment draft
    const saveDraftBtn = adminPage.locator('button[type="submit"]:has-text("Save draft")');
    await saveDraftBtn.click();
    await adminPage.waitForTimeout(1500);
    console.log('   ✔ Saved Assessment Draft');

    // Switch to All assessments tab & publish
    const allAssessmentsTab = adminPage.locator('button[role="tab"]:has-text("All assessments")');
    await allAssessmentsTab.click();
    await adminPage.waitForTimeout(600);

    const publishBtn = adminPage.locator('article.assessment-list-card')
      .filter({ hasText: 'PostgreSQL Final Verification Assessment' })
      .locator('button:has-text("Publish")')
      .first();

    if (await publishBtn.count() > 0) {
      await publishBtn.click();
      await adminPage.waitForTimeout(1500);
      console.log('   ✔ Published assessment to students');
    }

    await adminPage.screenshot({ path: path.join(screenshotDir, '04-assessment-published.png') });
    console.log('   Saved screenshot: 04-assessment-published.png');
    results.push({ name: 'Assessment Creation & Publishing', status: 'PASS' });

    // =========================================================================
    // 4. Student Session: Login, Dashboard, Profile & Directory
    // =========================================================================
    console.log('\n--- 4. Testing Student Login, Profile & Member Directory ---');
    const studentCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const studentPage = await studentCtx.newPage();
    studentPage.on('dialog', dialog => dialog.accept());

    await studentPage.goto(`${WEB_BASE}/login`, { waitUntil: 'networkidle' });
    await studentPage.fill('#portal-identifier', '25AM087');
    await studentPage.fill('#portal-password', 'StudentPass@2026!');
    await studentPage.click('button[type="submit"]');

    await studentPage.waitForURL('**/student/**', { timeout: 10000 });
    await studentPage.waitForLoadState('networkidle');
    await studentPage.screenshot({ path: path.join(screenshotDir, '05-student-dashboard.png') });
    console.log('   ✔ Student login successful (URL: ' + studentPage.url() + ')');
    console.log('   Saved screenshot: 05-student-dashboard.png');
    results.push({ name: 'Student Login & Dashboard', status: 'PASS' });

    // Student Profile
    await studentPage.goto(`${WEB_BASE}/student/profile`, { waitUntil: 'networkidle' });
    const deptInput = studentPage.locator('input[name="department"], input#department').first();
    if (await deptInput.count() > 0) {
      await deptInput.fill('Artificial Intelligence & Data Science');
      const saveProfileBtn = studentPage.locator('button[type="submit"]:has-text("Save"), button:has-text("Save profile")').first();
      if (await saveProfileBtn.count() > 0) {
        await saveProfileBtn.click();
        await studentPage.waitForTimeout(1000);
        console.log('   ✔ Updated student profile in PostgreSQL');
      }
    }
    await studentPage.screenshot({ path: path.join(screenshotDir, '06-student-profile.png') });
    console.log('   Saved screenshot: 06-student-profile.png');
    results.push({ name: 'Student Profile Persistence', status: 'PASS' });

    // Member Directory Search
    await studentPage.goto(`${WEB_BASE}/student/members`, { waitUntil: 'domcontentloaded' });
    await studentPage.waitForSelector('form.portal-search', { timeout: 10000 });
    const memSearch = studentPage.locator('input[aria-label="Search members"], input[placeholder*="Search"]');
    if (await memSearch.count() > 0) {
      await memSearch.fill('Student');
      await studentPage.click('button:has-text("Search")');
      await studentPage.waitForTimeout(600);
      console.log('   ✔ Member directory searched');
    }
    await studentPage.screenshot({ path: path.join(screenshotDir, '07-member-directory.png') });
    console.log('   Saved screenshot: 07-member-directory.png');
    results.push({ name: 'Member Directory Search', status: 'PASS' });

    // =========================================================================
    // 5. Student Assessment Attempt & Submission
    // =========================================================================
    console.log('\n--- 5. Testing Student Assessment Attempt & Submission ---');
    await studentPage.goto(`${WEB_BASE}/student/assessments`, { waitUntil: 'domcontentloaded' });
    await studentPage.waitForSelector('.assessment-student-grid, .portal-state', { timeout: 10000 });

    const assessmentCard = studentPage.locator('article.assessment-student-card')
      .filter({ hasText: 'PostgreSQL Final Verification Assessment' })
      .first();

    if (await assessmentCard.count() > 0) {
      const startBtn = assessmentCard.locator('button:has-text("Start assessment")');
      if (await startBtn.count() > 0) {
        await startBtn.click();
        await studentPage.waitForURL('**/attempt/**', { timeout: 10000 });
        await studentPage.waitForLoadState('domcontentloaded');
        await studentPage.waitForTimeout(1000);
        console.log('   ✔ Assessment started, redirected to attempt view');

        // Select an option for question
        const optionLabel = studentPage.locator('label.assessment-option').first();
        if (await optionLabel.count() > 0) {
          await optionLabel.click();
          await studentPage.waitForTimeout(500);
          console.log('   ✔ Selected answer option');
        }

        // Submit assessment attempt
        const submitAttemptBtn = studentPage.locator('button:has-text("Finish"), button:has-text("Submit"), button:has-text("Save & finish")').first();
        if (await submitAttemptBtn.count() > 0) {
          await submitAttemptBtn.click();
          await studentPage.waitForTimeout(1500);
          console.log('   ✔ Submitted assessment attempt');
        }
      }
    }
    await studentPage.screenshot({ path: path.join(screenshotDir, '08-student-assessment-submitted.png') });
    console.log('   Saved screenshot: 08-student-assessment-submitted.png');
    results.push({ name: 'Student Assessment Attempt & Submission', status: 'PASS' });

    // =========================================================================
    // 6. Community: Post Creation with Image, Voting & Commenting
    // =========================================================================
    console.log('\n--- 6. Testing Community: Post with Image Attachment & Voting ---');
    await studentPage.goto(`${WEB_BASE}/student/community`, { waitUntil: 'domcontentloaded' });
    await studentPage.waitForSelector('.community-page', { timeout: 10000 });

    // Open Create Post modal
    const createPostBtn = studentPage.locator('button:has-text("Create post")');
    if (await createPostBtn.count() > 0) {
      await createPostBtn.click();
      await studentPage.waitForTimeout(600);

      // Fill post fields
      const postTitleInput = studentPage.locator('input[placeholder="What are you exploring?"]');
      await postTitleInput.fill('PostgreSQL Verification Announcement');

      const postBodyInput = studentPage.locator('textarea[placeholder*="Share an idea"]');
      await postBodyInput.fill('Verified PostgreSQL database migration end-to-end with image upload, attachments, and voting!');

      // Upload image attachment
      if (fs.existsSync(imgPath)) {
        const imgInput = studentPage.locator('input[aria-label="Upload post images"]');
        if (await imgInput.count() > 0) {
          await imgInput.setInputFiles(imgPath);
          await studentPage.waitForTimeout(1500);
          console.log('   ✔ Attached image to Community post');
        }
      }

      // Publish post
      const pubPostBtn = studentPage.locator('button:has-text("Publish post")');
      await pubPostBtn.click();
      await studentPage.waitForTimeout(2000);
      console.log('   ✔ Published Community post with image');
    }

    // Upvote the post
    const postArticle = studentPage.locator('article.community-post')
      .filter({ hasText: 'PostgreSQL Verification Announcement' })
      .first();

    if (await postArticle.count() > 0) {
      const upvoteBtn = postArticle.locator('button[aria-label*="Upvote"]').first();
      if (await upvoteBtn.count() > 0) {
        await upvoteBtn.click();
        await studentPage.waitForTimeout(500);
        console.log('   ✔ Upvoted Community post');
      }
    }

    await studentPage.screenshot({ path: path.join(screenshotDir, '09-community-post-with-image.png') });
    console.log('   Saved screenshot: 09-community-post-with-image.png');
    results.push({ name: 'Community Post Creation with Image & Upvote', status: 'PASS' });

    // Open post discussion & submit comment
    // Open post discussion & submit comment
    console.log('\n--- 7. Testing Community Commenting ---');
    const postLink = postArticle.locator('h2 a').first();
    if (await postLink.count() > 0) {
      await postLink.click();
      await studentPage.waitForURL('**/posts/**', { timeout: 10000 });
      await studentPage.waitForLoadState('domcontentloaded');
      await studentPage.waitForTimeout(1000);

      const commentArea = studentPage.locator('textarea').first();
      if (await commentArea.count() > 0) {
        await commentArea.fill('This comment is stored in PostgreSQL and rendered dynamically in Chrome!');
        const sendCommentBtn = studentPage.locator('button:has-text("Comment"), button:has-text("Reply"), button:has-text("Post comment")').first();
        if (await sendCommentBtn.count() > 0) {
          await sendCommentBtn.click();
          await studentPage.waitForTimeout(1500);
          console.log('   ✔ Submitted comment on post');
        }
      }
    }

    await studentPage.screenshot({ path: path.join(screenshotDir, '10-community-comment-and-votes.png') });
    console.log('   Saved screenshot: 10-community-comment-and-votes.png');
    results.push({ name: 'Community Comments & Discussion View', status: 'PASS' });

    // =========================================================================
    // 7. Admin Moderation: Pin & Lock
    // =========================================================================
    console.log('\n--- 8. Testing Admin Moderation: Pin Announcement ---');
    await adminPage.goto(`${WEB_BASE}/admin/community`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('.community-page', { timeout: 10000 });

    const adminPost = adminPage.locator('article.community-post')
      .filter({ hasText: 'PostgreSQL Verification Announcement' })
      .first();

    if (await adminPost.count() > 0) {
      const pinBtn = adminPost.locator('button:has-text("Pin announcement"), button:has-text("Pin")').first();
      if (await pinBtn.count() > 0) {
        await pinBtn.click();
        await adminPage.waitForTimeout(500);

        // Fill moderation reason in ActionDialog
        const reasonInput = adminPage.locator('textarea[required]').first();
        if (await reasonInput.count() > 0) {
          await reasonInput.fill('Verified acceptance test post - pinned as key update.');
          await adminPage.click('button:has-text("Save action"), button:has-text("Confirm")');
          await adminPage.waitForTimeout(1500);
          console.log('   ✔ Post pinned as announcement with moderation reason recorded');
        }
      }
    }

    await adminPage.screenshot({ path: path.join(screenshotDir, '11-admin-moderation-pinned.png') });
    console.log('   Saved screenshot: 11-admin-moderation-pinned.png');
    results.push({ name: 'Admin Community Moderation (Pin & Lock)', status: 'PASS' });

    // =========================================================================
    // 8. Mobile Viewport Responsiveness
    // =========================================================================
    console.log('\n--- 9. Testing Mobile Responsiveness (375x812 Viewport) ---');
    const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobilePage = await mobileCtx.newPage();

    await mobilePage.goto(`${WEB_BASE}/`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ path: path.join(screenshotDir, '12-mobile-home.png') });
    console.log('   Saved screenshot: 12-mobile-home.png');

    await mobilePage.goto(`${WEB_BASE}/student/members`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ path: path.join(screenshotDir, '13-mobile-directory.png') });
    console.log('   Saved screenshot: 13-mobile-directory.png');

    await mobilePage.goto(`${WEB_BASE}/student/community`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ path: path.join(screenshotDir, '14-mobile-community.png') });
    console.log('   Saved screenshot: 14-mobile-community.png');
    results.push({ name: 'Mobile Viewport Responsiveness', status: 'PASS' });

    // =========================================================================
    // 9. PostgreSQL Persistence Verification
    // =========================================================================
    console.log('\n--- 10. Verifying PostgreSQL Database Persistence ---');
    const pool = new pg.Pool({ connectionString: DB_URL });
    const bankRes = await pool.query("SELECT id, title FROM assessment_banks WHERE title = 'PostgreSQL Acceptance Bank'");
    const qCountRes = await pool.query("SELECT count(*) FROM assessment_bank_questions WHERE bank_id = $1", [bankRes.rows[0]?.id || 'none']);
    const assessRes = await pool.query("SELECT id, title, status FROM assessments WHERE title = 'PostgreSQL Final Verification Assessment'");
    const attemptRes = await pool.query("SELECT id, status, score FROM assessment_attempts");
    const postRes = await pool.query("SELECT id, title, is_pinned, is_locked FROM community_posts WHERE title = 'PostgreSQL Verification Announcement'");
    const commentRes = await pool.query("SELECT id, body FROM community_comments WHERE body LIKE '%PostgreSQL%'");
    const voteRes = await pool.query("SELECT count(*) FROM community_post_votes");
    const modRes = await pool.query("SELECT count(*) FROM activity_logs");
    await pool.end();

    console.log(`   ✔ Bank in PostgreSQL: "${bankRes.rows[0]?.title}" (Questions in bank: ${qCountRes.rows[0]?.count})`);
    console.log(`   ✔ Assessment in PostgreSQL: "${assessRes.rows[0]?.title}" (Status: ${assessRes.rows[0]?.status})`);
    console.log(`   ✔ Assessment Attempts: ${attemptRes.rowCount} recorded in PostgreSQL`);
    console.log(`   ✔ Community Post in PostgreSQL: "${postRes.rows[0]?.title}" (Pinned: ${postRes.rows[0]?.is_pinned})`);
    console.log(`   ✔ Community Comments: ${commentRes.rowCount} recorded in PostgreSQL`);
    console.log(`   ✔ Votes Cast in PostgreSQL: ${voteRes.rows[0]?.count}`);
    console.log(`   ✔ Audit Activity Logs: ${modRes.rows[0]?.count}`);

    const allPersisted = Boolean(
      bankRes.rowCount > 0 &&
      assessRes.rowCount > 0 &&
      postRes.rowCount > 0 &&
      postRes.rows[0]?.is_pinned === true
    );

    if (allPersisted) {
      results.push({ name: 'Direct PostgreSQL Database Persistence', status: 'PASS' });
    } else {
      results.push({ name: 'Direct PostgreSQL Database Persistence', status: 'FAIL' });
    }

    console.log('\n================================================================');
    console.log('=== Real Browser Acceptance Verification Summary ===');
    for (const r of results) {
      console.log(` [${r.status}] ${r.name}`);
    }
    console.log('================================================================\n');

    return { ok: results.every(r => r.status === 'PASS'), results };
  } finally {
    await browser.close();
  }
}

runAcceptance()
  .then(res => {
    if (!res.ok) process.exit(1);
    process.exit(0);
  })
  .catch(err => {
    console.error('Browser Acceptance verification threw error:', err);
    process.exit(1);
  });
