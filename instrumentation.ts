export async function register() {
  const currentSecret = process.env.SESSION_SIGNING_SECRET?.trim();
  const isUnsetOrPlaceholder =
    !currentSecret ||
    currentSecret === 'CHANGE_ME_TO_A_STRONG_RANDOM_SECRET' ||
    currentSecret.length < 16;

  if (isUnsetOrPlaceholder && process.env.VERCEL_ENV !== 'production') {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    process.env.SESSION_SIGNING_SECRET = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
  }
}
