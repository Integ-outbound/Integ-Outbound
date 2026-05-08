import 'dotenv/config';

const baseUrl = (process.env.READINESS_BASE_URL ?? 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
const apiKey = process.env.INTERNAL_API_KEY;

if (!apiKey) {
  console.error('INTERNAL_API_KEY is required for readiness:check');
  process.exit(1);
}

const checks = [
  {
    name: 'public ready',
    url: `${baseUrl}/ready`,
    expectedStatus: 200
  },
  {
    name: 'unauthenticated health rejected',
    url: `${baseUrl}/health`,
    expectedStatus: 401
  },
  {
    name: 'protected health with correct key',
    url: `${baseUrl}/health`,
    expectedStatus: 200,
    headers: {
      'x-api-key': apiKey
    }
  },
  {
    name: 'protected campaigns without key',
    url: `${baseUrl}/campaigns`,
    expectedStatus: 401
  },
  {
    name: 'protected campaigns with wrong key',
    url: `${baseUrl}/campaigns`,
    expectedStatus: 401,
    headers: {
      'x-api-key': 'wrong-key'
    }
  },
  {
    name: 'protected campaigns with correct key',
    url: `${baseUrl}/campaigns`,
    expectedStatus: 200,
    headers: {
      'x-api-key': apiKey
    }
  },
  {
    name: 'protected leads with correct key',
    url: `${baseUrl}/leads`,
    expectedStatus: 200,
    headers: {
      'x-api-key': apiKey
    }
  },
  {
    name: 'protected review stats with correct key',
    url: `${baseUrl}/review/stats`,
    expectedStatus: 200,
    headers: {
      'x-api-key': apiKey
    }
  }
];

let failed = false;

for (const check of checks) {
  const response = await fetch(check.url, {
    method: 'GET',
    headers: check.headers
  });

  if (response.status !== check.expectedStatus) {
    failed = true;
    console.error(`[FAIL] ${check.name}: expected ${check.expectedStatus}, got ${response.status}`);
    continue;
  }

  console.log(`[OK] ${check.name}: ${response.status}`);
}

if (failed) {
  process.exit(1);
}
