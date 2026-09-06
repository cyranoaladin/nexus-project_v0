/** Retired credit jobs remain callable by existing schedulers, without touching
 * historical allocations or sending obsolete reminders. */
export async function checkExpiringCredits() { return; }
export async function expireOldCredits() { return; }
export async function allocateMonthlyCredits() { return; }
