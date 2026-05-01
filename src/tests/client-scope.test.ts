import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgresql://user:password@127.0.0.1:5432/integ_test';

const {
  DEFAULT_CLIENT_ID,
  appendClientScope,
  canReassignOwnedRecord,
  resolveClientId,
  shouldGenerateSuggestedReply
} = require('../modules/clients/scope') as typeof import('../modules/clients/scope');

test('resolveClientId falls back to the default client', () => {
  assert.equal(resolveClientId(undefined), DEFAULT_CLIENT_ID);
  assert.equal(resolveClientId(null), DEFAULT_CLIENT_ID);
  assert.equal(resolveClientId(''), DEFAULT_CLIENT_ID);
});

test('appendClientScope appends a scoped condition only when a client is provided', () => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  appendClientScope(conditions, params, 'l.client_id');
  assert.deepEqual(conditions, []);
  assert.deepEqual(params, []);

  appendClientScope(conditions, params, 'l.client_id', '123e4567-e89b-12d3-a456-426614174000');
  assert.deepEqual(conditions, ['l.client_id = $1']);
  assert.deepEqual(params, ['123e4567-e89b-12d3-a456-426614174000']);
});

test('canReassignOwnedRecord only allows same-client or default-client reassignment', () => {
  assert.equal(canReassignOwnedRecord(DEFAULT_CLIENT_ID, 'client-a'), true);
  assert.equal(canReassignOwnedRecord('client-a', 'client-a'), true);
  assert.equal(canReassignOwnedRecord('client-a', 'client-b'), false);
});

test('shouldGenerateSuggestedReply only enables human-review classifications that need a response', () => {
  assert.equal(shouldGenerateSuggestedReply('question', 'human_review'), true);
  assert.equal(shouldGenerateSuggestedReply('positive', 'human_review'), true);
  assert.equal(shouldGenerateSuggestedReply('neutral', 'human_review'), true);
  assert.equal(shouldGenerateSuggestedReply('negative', 'human_review'), false);
  assert.equal(shouldGenerateSuggestedReply('opt_out', 'auto_handled'), false);
  assert.equal(shouldGenerateSuggestedReply(null, 'human_review'), false);
});
