export function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // 2. Tenter d'utiliser une alternative native semi-moderne
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b, i) => {
        if (i === 6) return ((b & 0x0f) | 0x40).toString(16); // version 4
        if (i === 8) return ((b & 0x3f) | 0x80).toString(16); // variant RFC4122
        return b.toString(16).padStart(2, '0');
      })
      .join('')
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  }

  // 3. Fallback ultime (Math.random) si l'appareil n'a absolument aucune API Crypto active
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  
  }