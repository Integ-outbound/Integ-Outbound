import { DbClient, ensureFound, generateId, query, withTransaction } from '../../db/client';
import { Contact } from '../../db/types';
import { logEvent } from '../observability/service';

export interface ContactInput {
  company_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  seniority?: Contact['seniority'];
  department?: string | null;
  linkedin_url?: string | null;
  source?: string | null;
}

interface VerificationResponse {
  email?: string;
  result?: string;
  subresult?: string;
  error?: string;
}

function getVerificationConfig(): { provider: string; apiKey: string } {
  const provider = process.env.VERIFICATION_PROVIDER ?? 'millionverifier';
  const apiKey = process.env.VERIFICATION_API_KEY;

  if (!apiKey) {
    throw new Error('VERIFICATION_API_KEY is required.');
  }

  return { provider, apiKey };
}

function mapVerificationStatus(response: VerificationResponse): Contact['verification_status'] {
  switch ((response.result ?? '').toLowerCase()) {
    case 'ok':
      return 'valid';
    case 'catch_all':
      return 'catch_all';
    case 'invalid':
    case 'disposable':
      return 'invalid';
    case 'unknown':
    case 'unverified':
    default:
      return 'risky';
  }
}

async function fetchContact(contactId: string, client?: DbClient): Promise<Contact> {
  const result = await query<Contact>('SELECT * FROM contacts WHERE id = $1', [contactId], client);
  const contact = result.rows[0];
  if (!contact) {
    throw new Error(`Contact ${contactId} not found.`);
  }

  return contact;
}

export async function upsertContact(data: ContactInput, triggeredBy = 'operator'): Promise<Contact> {
  return withTransaction(async (client) => {
    const result = await query<Contact>(
      `
        INSERT INTO contacts (
          id,
          company_id,
          email,
          first_name,
          last_name,
          title,
          seniority,
          department,
          linkedin_url,
          source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (email)
        DO UPDATE SET
          company_id = EXCLUDED.company_id,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          title = EXCLUDED.title,
          seniority = EXCLUDED.seniority,
          department = EXCLUDED.department,
          linkedin_url = EXCLUDED.linkedin_url,
          source = EXCLUDED.source,
          updated_at = NOW()
        RETURNING *
      `,
      [
        generateId(),
        data.company_id,
        data.email.toLowerCase(),
        data.first_name ?? null,
        data.last_name ?? null,
        data.title ?? null,
        data.seniority ?? null,
        data.department ?? null,
        data.linkedin_url ?? null,
        data.source ?? null
      ],
      client
    );

    const contact = ensureFound(result.rows[0], `Contact ${data.email} upsert failed.`);
    await logEvent(
      {
        eventType: 'contact.upserted',
        entityType: 'contact',
        entityId: contact.id,
        payload: { email: contact.email, company_id: contact.company_id },
        triggeredBy
      },
      client
    );

    return contact;
  });
}

export async function getContactsForCompany(companyId: string): Promise<Contact[]> {
  const result = await query<Contact>(
    `
      SELECT *
      FROM contacts
      WHERE company_id = $1
      ORDER BY created_at DESC
    `,
    [companyId]
  );

  return result.rows;
}

export async function markOptOut(contactId: string, triggeredBy = 'operator'): Promise<Contact> {
  return withTransaction(async (client) => {
    const result = await query<Contact>(
      `
        UPDATE contacts
        SET opted_out = true, opted_out_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [contactId],
      client
    );

    const contact = result.rows[0];
    if (!contact) {
      throw new Error(`Contact ${contactId} not found.`);
    }

    await logEvent(
      {
        eventType: 'contact.opted_out',
        entityType: 'contact',
        entityId: contact.id,
        payload: { email: contact.email },
        triggeredBy
      },
      client
    );

    return contact;
  });
}

export async function markBounced(contactId: string, triggeredBy = 'operator'): Promise<Contact> {
  return withTransaction(async (client) => {
    const result = await query<Contact>(
      `
        UPDATE contacts
        SET bounced = true, bounced_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [contactId],
      client
    );

    const contact = result.rows[0];
    if (!contact) {
      throw new Error(`Contact ${contactId} not found.`);
    }

    await logEvent(
      {
        eventType: 'contact.bounced',
        entityType: 'contact',
        entityId: contact.id,
        payload: { email: contact.email },
        triggeredBy
      },
      client
    );

    return contact;
  });
}

export async function getUnverifiedContacts(limit: number): Promise<Contact[]> {
  const result = await query<Contact>(
    `
      SELECT *
      FROM contacts
      WHERE verification_status = 'unverified'
      ORDER BY created_at ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

async function verifyWithProvider(contact: Contact): Promise<VerificationResponse> {
  const { provider, apiKey } = getVerificationConfig();

  if (provider !== 'millionverifier') {
    throw new Error(`Unsupported verification provider: ${provider}`);
  }

  if (!contact.email) {
    throw new Error(`Contact ${contact.id} has no email.`);
  }

  const url = new URL('https://api.millionverifier.com/api/v3/');
  url.searchParams.set('api', apiKey);
  url.searchParams.set('email', contact.email);
  url.searchParams.set('timeout', '10');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Verification provider returned ${response.status}.`);
  }

  return (await response.json()) as VerificationResponse;
}

export async function verifyContact(contactId: string, triggeredBy = 'operator'): Promise<Contact> {
  const contact = await fetchContact(contactId);
  const verification = await verifyWithProvider(contact);
  const status = mapVerificationStatus(verification);
  const provider = process.env.VERIFICATION_PROVIDER ?? 'millionverifier';

  return withTransaction(async (client) => {
    const result = await query<Contact>(
      `
        UPDATE contacts
        SET
          verification_status = $2,
          verification_provider = $3,
          verified_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [contactId, status, provider],
      client
    );

    const updated = ensureFound(result.rows[0], `Contact ${contactId} verification update failed.`);
    await logEvent(
      {
        eventType: 'contact.verified',
        entityType: 'contact',
        entityId: updated.id,
        payload: {
          verification_status: status,
          verification_provider: provider,
          provider_result: verification.result ?? null,
          provider_subresult: verification.subresult ?? null
        },
        triggeredBy
      },
      client
    );

    return updated;
  });
}

export async function verifyBatch(limit: number, triggeredBy = 'system'): Promise<{ processed: number }> {
  const contacts = await getUnverifiedContacts(limit);
  let processed = 0;

  for (const [index, contact] of contacts.entries()) {
    try {
      await verifyContact(contact.id, triggeredBy);
      processed += 1;
    } catch (error) {
      console.error('Contact verification failed', {
        contactId: contact.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }

    if (index < contacts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { processed };
}
