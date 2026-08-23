const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const PERCENT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export function rupeesStringToPaise(raw: string): number | null {
  const value = raw.trim();
  if (value === "" || !MONEY_PATTERN.test(value)) {
    return null;
  }
  const [whole, fraction = ""] = value.split(".");
  const fractionPaise = Number((fraction + "00").slice(0, 2));
  const paise = Number(whole) * 100 + fractionPaise;
  if (!Number.isSafeInteger(paise) || paise < 0) {
    return null;
  }
  return paise;
}

export function paiseToRupeesInput(paise: number): string {
  if (!Number.isInteger(paise)) {
    return "";
  }
  const sign = paise < 0 ? "-" : "";
  const absolute = Math.abs(paise);
  const rupees = Math.trunc(absolute / 100);
  const remainder = absolute % 100;
  if (remainder === 0) {
    return `${sign}${rupees}`;
  }
  return `${sign}${rupees}.${String(remainder).padStart(2, "0")}`;
}

export function percentStringToBasisPoints(raw: string): number | null {
  const value = raw.trim();
  if (value === "" || !PERCENT_PATTERN.test(value)) {
    return null;
  }
  const [whole, fraction = ""] = value.split(".");
  const fractionBps = Number((fraction + "00").slice(0, 2));
  const bps = Number(whole) * 100 + fractionBps;
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10000) {
    return null;
  }
  return bps;
}

export function basisPointsToPercentInput(bps: number): string {
  if (!Number.isInteger(bps)) {
    return "";
  }
  const whole = Math.trunc(bps / 100);
  const remainder = bps % 100;
  if (remainder === 0) {
    return String(whole);
  }
  return `${whole}.${String(remainder).padStart(2, "0")}`;
}

export function mapRupeesFieldToPaise(
  formData: FormData,
  rupeesField: string,
  paiseField: string,
  required: boolean
): string | null {
  const raw = String(formData.get(rupeesField) ?? "").trim();
  formData.delete(rupeesField);
  if (raw === "") {
    if (required) {
      return "Enter an amount in rupees.";
    }
    formData.set(paiseField, "");
    return null;
  }
  const paise = rupeesStringToPaise(raw);
  if (paise === null) {
    return "Enter a valid rupee amount with up to two decimal places.";
  }
  formData.set(paiseField, String(paise));
  return null;
}

export function mapPercentFieldToBasisPoints(
  formData: FormData,
  percentField: string,
  bpsField: string
): string | null {
  const raw = String(formData.get(percentField) ?? "").trim();
  formData.delete(percentField);
  const bps = percentStringToBasisPoints(raw);
  if (bps === null) {
    return "Enter a valid tax rate percentage with up to two decimal places.";
  }
  formData.set(bpsField, String(bps));
  return null;
}
