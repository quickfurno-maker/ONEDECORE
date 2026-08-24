export function maskCommerceOrderMobile(mobile: string): string {
  if (mobile.length < 8) return "••••";
  return `${mobile.slice(0, 3)} •••• ${mobile.slice(-4)}`;
}
