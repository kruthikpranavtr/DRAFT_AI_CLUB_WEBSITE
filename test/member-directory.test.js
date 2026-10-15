import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeMembers } from '../src/lib/member-directory.js';

test('additional member pages deduplicate stable IDs and retain the latest profile',() => {
  const current = [{ id:'a',name:'First' },{ id:'b',name:'Before update' }];
  const result = mergeMembers(current,[{ id:'b',name:'After update' },{ id:'c',name:'Last' }]);
  assert.deepEqual(result,[{ id:'a',name:'First' },{ id:'b',name:'After update' },{ id:'c',name:'Last' }]);
  assert.equal(current[1].name,'Before update');
});
