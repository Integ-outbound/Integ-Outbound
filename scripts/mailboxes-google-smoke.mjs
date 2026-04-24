const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const apiKey = process.env.API_KEY || process.env.INTERNAL_API_KEY;
const mailboxId = process.env.MAILBOX_ID?.trim();
const to = process.env.TEST_EMAIL_TO?.trim();
const subject = process.env.TEST_EMAIL_SUBJECT?.trim() || 'Gmail OAuth test';
const body =
  process.env.TEST_EMAIL_BODY?.trim() ||
  'This is a Gmail API test email from the Integ mailbox smoke script.';

if (!apiKey) {
  console.error('API_KEY or INTERNAL_API_KEY is required.');
  process.exit(1);
}

async function requestJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'x-api-key': apiKey,
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

const start = await requestJson('/api/v1/mailboxes/google/oauth/start');
console.log(JSON.stringify({ step: 'oauth-start', ...start }, null, 2));

if (!start.ok) {
  process.exit(1);
}

console.log('');
console.log('Open this URL in a browser and complete Google consent:');
console.log(start.data.authorizationUrl);
console.log('');
console.log(
  'After Google redirects back to /api/v1/mailboxes/google/oauth/callback, copy the returned mailbox.id.'
);

if (!mailboxId || !to) {
  console.log('');
  console.log('To test send after callback, rerun with:');
  console.log('  MAILBOX_ID=<mailbox-id>');
  console.log('  TEST_EMAIL_TO=<recipient@example.com>');
  process.exit(0);
}

const send = await requestJson(`/api/v1/mailboxes/${mailboxId}/test-send`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    to,
    subject,
    body
  })
});

console.log('');
console.log(JSON.stringify({ step: 'test-send', ...send }, null, 2));

if (!send.ok) {
  process.exit(1);
}
