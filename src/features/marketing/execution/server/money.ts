/** Google Ads cost_micros is millionths of the currency unit. spend_minor is 1/100 of that unit. */
export function googleMicrosToSpendMinor(costMicros: bigint | number): bigint {
  const micros = typeof costMicros === "bigint" ? costMicros : BigInt(costMicros);
  if (micros < BigInt(0)) {
    throw new Error("GOOGLE_ADS_NEGATIVE_MICROS");
  }
  if (micros % BigInt(10000) !== BigInt(0)) {
    throw new Error("GOOGLE_ADS_MICROS_NOT_ALIGNED_TO_MINOR");
  }
  return micros / BigInt(10000);
}

export function spendMinorToGoogleMicros(spendMinor: bigint | number): bigint {
  const minor = typeof spendMinor === "bigint" ? spendMinor : BigInt(spendMinor);
  if (minor < BigInt(0)) {
    throw new Error("GOOGLE_ADS_NEGATIVE_MINOR");
  }
  return minor * BigInt(10000);
}

export function spendMinorToNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("SPEND_MINOR_EXCEEDS_SAFE_INTEGER");
  }
  return Number(value);
}
