export function shouldStartWorker(): boolean {
  const value = (process.env.START_WORKER ?? 'true').trim().toLowerCase();
  return value !== 'false' && value !== '0' && value !== 'no';
}
