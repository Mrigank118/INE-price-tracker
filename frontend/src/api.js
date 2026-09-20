// const API = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:10000').replace(/\/$/, '');

// async function request(path, options = {}) {
//   const response = await fetch(`${API}${path}`, {
//     headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
//     ...options
//   });
//   const text = await response.text();
//   const data = text ? JSON.parse(text) : null;
//   if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
//   return data;
// }
// export async function updateScrapeFrequency(
//   productId,
//   scrapeIntervalMinutes
// ) {
//   const response = await fetch(
//     `${API_BASE_URL}/api/tracked/${productId}/frequency`,
//     {
//       method: 'PATCH',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         scrape_interval_minutes: scrapeIntervalMinutes
//       })
//     }
//   );

//   const data = await response.json();

//   if (!response.ok) {
//     throw new Error(
//       data.error || 'Failed to update scrape frequency.'
//     );
//   }

//   return data;
// }
// export const api = {
//   search: (q) => request(`/api/products/search?q=${encodeURIComponent(q)}`),
//   tracked: () => request('/api/tracked'),
//   add: (product) => request('/api/tracked', { method: 'POST', body: JSON.stringify(product) }),
//   remove: (id) => request(`/api/tracked/${id}`, { method: 'DELETE' }),
//   history: (id) => request(`/api/tracked/${id}/history`),
//   logs: (id) => request(`/api/tracked/${id}/logs`),
//   scrape: (id) => request(`/api/tracked/${id}/scrape`, { method: 'POST' })
// };
const API = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:10000'
).replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

export const api = {
  search: (q) =>
    request(
      `/api/products/search?q=${encodeURIComponent(q)}`
    ),

  tracked: () =>
    request('/api/tracked'),

  add: (product) =>
    request('/api/tracked', {
      method: 'POST',
      body: JSON.stringify(product)
    }),

  remove: (id) =>
    request(`/api/tracked/${id}`, {
      method: 'DELETE'
    }),

  history: (id) =>
    request(`/api/tracked/${id}/history`),

  logs: (id) =>
    request(`/api/tracked/${id}/logs`),

  scrape: (id) =>
    request(`/api/tracked/${id}/scrape`, {
      method: 'POST'
    }),

  updateFrequency: (
    productId,
    scrapeIntervalMinutes
  ) =>
    request(
      `/api/tracked/${productId}/frequency`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          scrape_interval_minutes:
            Number(scrapeIntervalMinutes)
        })
      }
    )
};