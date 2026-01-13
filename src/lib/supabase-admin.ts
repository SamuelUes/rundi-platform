// Supabase admin client for server-side CMS APIs (uses service_role key, NEVER import in client components)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[supabase-admin] SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas. Las APIs de admin que usan Supabase no funcionarán."
  );
}

export type SupabaseFilters = Record<string, string | number | boolean>;

interface SupabaseAdminGetParams {
  table: string;
  select?: string;
  filters?: SupabaseFilters;
  limit?: number;
}

export async function supabaseAdminGet<Row = any>(
  params: SupabaseAdminGetParams
): Promise<Row[]> {
  const { table, select = "*", filters, limit = 1000 } = params;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase admin no configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"
    );
  }

  const boundedLimit = Math.min(Math.max(limit, 1), 10000);

  let urlString = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${boundedLimit}`;

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      const encoded = encodeURIComponent(String(value));
      urlString += `&${key}=eq.${encoded}`;
    }
  }

  const response = await fetch(urlString, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Supabase GET ${table} falló: ${response.status} ${response.statusText} - ${text.slice(
        0,
        500
      )}`
    );
  }

  const data = (await response.json()) as Row[];
  return data;
}

interface SupabaseAdminPatchParams {
  table: string;
  values: Record<string, any>;
  filters: SupabaseFilters;
}

export async function supabaseAdminPatch<Row = any>(
  params: SupabaseAdminPatchParams
): Promise<Row[]> {
  const { table, values, filters } = params;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase admin no configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"
    );
  }

  let urlString = `${SUPABASE_URL}/rest/v1/${table}`;

  const entries = Object.entries(filters);
  if (entries.length > 0) {
    const query = entries
      .map(([key, value]) => `${key}=eq.${encodeURIComponent(String(value))}`)
      .join("&");
    urlString += `?${query}`;
  }

  const response = await fetch(urlString, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Supabase PATCH ${table} falló: ${response.status} ${response.statusText} - ${text.slice(
        0,
        500
      )}`
    );
  }

  const data = (await response.json()) as Row[];
  return data;
}

interface SupabaseAdminInsertParams {
  table: string;
  values: Record<string, any> | Record<string, any>[];
}

export async function supabaseAdminInsert<Row = any>(
  params: SupabaseAdminInsertParams
): Promise<Row[]> {
  const { table, values } = params;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase admin no configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"
    );
  }

  const urlString = `${SUPABASE_URL}/rest/v1/${table}`;

  const response = await fetch(urlString, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Supabase POST ${table} falló: ${response.status} ${response.statusText} - ${text.slice(
        0,
        500
      )}`
    );
  }

  const data = (await response.json()) as Row[];
  return data;
}
