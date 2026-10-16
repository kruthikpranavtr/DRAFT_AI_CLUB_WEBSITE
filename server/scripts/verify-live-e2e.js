import assert from 'node:assert/strict';

const API_BASE = 'http://127.0.0.1:3002';

class Client {
  cookies = new Map();
  csrfToken = null;

  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  receiveCookies(res) {
    for (const val of res.headers.getSetCookie()) {
      const [pair] = val.split(';');
      const idx = pair.indexOf('=');
      const k = pair.slice(0, idx);
      const v = pair.slice(idx + 1);
      if (v) this.cookies.set(k, v);
      else this.cookies.delete(k);
    }
  }

  async csrf() {
    const res = await fetch(`${API_BASE}/api/auth/csrf`, {
      headers: { cookie: this.cookieHeader() },
    });
    this.receiveCookies(res);
    const body = await res.json();
    this.csrfToken = body.csrfToken;
    return this.csrfToken;
  }

  async request(route, { method = 'GET', body, form, csrf = true } = {}) {
    const headers = { cookie: this.cookieHeader(), origin: 'http://localhost:5174' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (csrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }
    const res = await fetch(`${API_BASE}${route}`, {
      method,
      headers,
      ...(form ? { body: form } : body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    this.receiveCookies(res);
    const contentType = res.headers.get('content-type') || '';
    const data = res.status === 204 ? null : contentType.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, headers: res.headers, data };
  }
}

async function verifyLiveE2E() {
  console.log('=== Starting Live PostgreSQL End-to-End API Verification ===');

  // 1. Admin login
  const admin = new Client();
  await admin.csrf();
  console.log('1. Admin authenticating with ADMIN-01...');
  const adminLogin = await admin.request('/api/auth/login', {
    method: 'POST',
    body: { identifier: 'ADMIN-01', password: 'AdminPass@2026!' },
  });
  assert.equal(adminLogin.status, 200, `Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  assert.equal(adminLogin.data.user.role, 'admin');
  console.log('   ✔ Admin login successful (role: admin, member_id: ADMIN-01)');

  // 2. Student login
  const student = new Client();
  await student.csrf();
  console.log('2. Student authenticating with 25AM087...');
  const studentLogin = await student.request('/api/auth/login', {
    method: 'POST',
    body: { identifier: '25AM087', password: 'StudentPass@2026!' },
  });
  assert.equal(studentLogin.status, 200, `Student login failed: ${JSON.stringify(studentLogin.data)}`);
  assert.equal(studentLogin.data.user.role, 'student');
  console.log('   ✔ Student login successful (role: student, member_id: 25AM087)');

  // 3. Question bank creation
  console.log('3. Admin creating question bank...');
  const bankRes = await admin.request('/api/assessments/admin/banks', {
    method: 'POST',
    body: {
      title: 'PostgreSQL Live Bank',
      description: 'End-to-end live testing bank on PostgreSQL',
      academicYear: 2,
      batch: '2025-2029',
    },
  });
  assert.equal(bankRes.status, 201, `Bank creation failed: ${JSON.stringify(bankRes.data)}`);
  const bankId = bankRes.data.id;
  console.log(`   ✔ Question bank created: ${bankId}`);

  // 4. Add questions to bank
  console.log('4. Admin adding question to bank...');
  const qRes1 = await admin.request(`/api/assessments/admin/banks/${bankId}/questions`, {
    method: 'POST',
    body: {
      kind: 'mcq',
      prompt: 'What database engine are we now running?',
      options: ['SQLite', 'MySQL', 'PostgreSQL', 'MongoDB'],
      correctOption: 2,
      points: 2,
    },
  });
  assert.equal(qRes1.status, 201, `Question 1 creation failed: ${JSON.stringify(qRes1.data)}`);

  const qRes2 = await admin.request(`/api/assessments/admin/banks/${bankId}/questions`, {
    method: 'POST',
    body: {
      kind: 'mcq',
      prompt: 'Is our PostgreSQL backend async or sync?',
      options: ['Synchronous', 'Asynchronous', 'Blocking', 'Disabled'],
      correctOption: 1,
      points: 2,
    },
  });
  assert.equal(qRes2.status, 201, `Question 2 creation failed: ${JSON.stringify(qRes2.data)}`);
  console.log('   ✔ Questions created in bank');

  // 5. Assessment creation and publication
  console.log('5. Admin creating and publishing assessment...');
  const assessRes = await admin.request('/api/assessments/admin', {
    method: 'POST',
    body: {
      title: 'PostgreSQL Certification Quiz',
      description: 'Live test assessment',
      instructions: 'Choose the best answer',
      kind: 'mcq',
      bankId,
      questionCount: 2,
      questionIds: [],
      allowBackward: true,
      pointsMode: 'equal',
      totalPoints: 4,
      durationMinutes: 30,
      startAt: null,
      endAt: null,
      attemptLimit: 1,
      eligibilityYear: 2,
    },
  });
  assert.equal(assessRes.status, 201, `Assessment creation failed: ${JSON.stringify(assessRes.data)}`);
  const assessmentId = assessRes.data.id;

  const pubRes = await admin.request(`/api/assessments/admin/${assessmentId}/publish`, {
    method: 'POST',
  });
  assert.equal(pubRes.status, 200, `Publish failed: ${JSON.stringify(pubRes.data)}`);
  console.log(`   ✔ Assessment published: ${assessmentId}`);

  // 6. Community post creation
  console.log('6. Student posting to Community feed...');
  const postRes = await student.request('/api/community/posts', {
    method: 'POST',
    body: {
      title: 'PostgreSQL Migration Success Announcement',
      body: 'The AI Club website backend has been completely migrated to PostgreSQL with full relational integrity!',
      tag: 'Projects',
    },
  });
  assert.equal(postRes.status, 201, `Post creation failed: ${JSON.stringify(postRes.data)}`);
  const postId = postRes.data.post.id;
  console.log(`   ✔ Community post created: ${postId}`);

  // 7. Community vote
  console.log('7. Student voting on post...');
  const voteRes = await student.request(`/api/community/posts/${postId}/vote`, {
    method: 'PUT',
    body: { value: 1 },
  });
  assert.equal(voteRes.status, 200, `Vote failed: ${JSON.stringify(voteRes.data)}`);
  assert.equal(voteRes.data.score, 1);
  console.log('   ✔ Upvote registered successfully, score = 1');

  // 8. Community comment
  console.log('8. Admin commenting on post...');
  const commentRes = await admin.request(`/api/community/posts/${postId}/comments`, {
    method: 'POST',
    body: {
      body: 'Verified from administration! All tests passing.',
    },
  });
  assert.equal(commentRes.status, 201, `Comment failed: ${JSON.stringify(commentRes.data)}`);
  console.log('   ✔ Comment created');

  // 9. Admin moderation (Pin & Lock)
  console.log('9. Admin moderating post (Pin & Lock)...');
  const pinRes = await admin.request(`/api/admin/community/posts/${postId}/pin`, {
    method: 'PUT',
    body: { reason: 'Featured announcement on PostgreSQL' },
  });
  assert.equal(pinRes.status, 200, `Pin failed: ${JSON.stringify(pinRes.data)}`);

  const lockRes = await admin.request(`/api/admin/community/posts/${postId}/moderate`, {
    method: 'POST',
    body: { action: 'lock', reason: 'Locking for announcement preservation' },
  });
  assert.equal(lockRes.status, 200, `Lock failed: ${JSON.stringify(lockRes.data)}`);
  console.log('   ✔ Post successfully pinned and locked by admin via moderation');

  // 10. Verify feed shows pinned post
  console.log('10. Verifying community feed list...');
  const feedRes = await student.request('/api/community/posts?sort=new');
  assert.equal(feedRes.status, 200);
  const foundPinned = feedRes.data.pinned.find(p => p.id === postId);
  assert.ok(foundPinned, 'Post should appear in pinned announcements');
  assert.equal(foundPinned.isPinned, true);
  assert.equal(foundPinned.isLocked, true);
  assert.equal(foundPinned.score, 1);
  console.log('   ✔ Community feed accurately reflects pinned, locked, and upvoted state in pinned list');

  console.log('\n=== All Live PostgreSQL End-to-End Verifications PASSED! ===');
}

verifyLiveE2E().catch(err => {
  console.error('Live E2E Verification FAILED:', err);
  process.exit(1);
});
