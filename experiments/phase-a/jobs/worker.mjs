import { createPool, JobStore } from './store.mjs';
const pool = createPool(process.env.DATABASE_URL, process.env.JOB_SCHEMA);
try {
  const job = await new JobStore(pool).claim();
  process.send?.({ job });
  // Intentionally pause before execution: the parent kills this real process.
  await new Promise((resolve) => process.once('message', resolve));
} finally { await pool.end(); }
