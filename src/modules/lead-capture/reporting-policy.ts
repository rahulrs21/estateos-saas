/** Date boundaries use IANA local calendar days, independent of the host timezone. */
export function localDateStartUtc(value: string, timeZone: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  let guess = Date.UTC(year, month - 1, day);
  const target = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    const correction = target - represented;
    if (correction === 0) break;
    guess += correction;
  }
  return new Date(guess);
}

