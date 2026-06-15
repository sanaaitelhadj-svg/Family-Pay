export function calcAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export function isMinor(dob: Date | string | null | undefined, isMinorFlag?: boolean | null): boolean {
  if (isMinorFlag === true) return true;
  const age = calcAge(dob);
  return age !== null && age < 18;
}
