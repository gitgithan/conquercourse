import { runRolesJob, type RolesJob, type RolesReply } from '../slice/roles-job';

// Runs the role search off the page's thread (CC-133), so the editor keeps answering while the simulator proves each suggestion.
const ctx = self as unknown as { onmessage: ((e: { data: RolesJob }) => void) | null; postMessage(m: RolesReply): void };
ctx.onmessage = (e) => {
  try { runRolesJob(e.data, (m) => ctx.postMessage(m)); }
  catch { ctx.postMessage({ id: e.data.id, error: 'The simulator could not finish this search. Try another piece.' }); }
};
