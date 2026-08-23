import "server-only";

export type CommerceQuoteLine = {
  sku: string;
  quantity: number;
  productName: string;
  productSlug: string;
  variantDisplayName: string | null;
  optionValues: Record<string, string>;
  primaryImagePublicPath: string | null;
  sellingUnitPricePaise: number;
  compareAtUnitPricePaise: number | null;
  discountPaise: number;
  lineTotalPaise: number;
  taxPaise: number;
  availabilityMode: "ready_stock" | "made_to_order";
  canFulfil: boolean;
};

export type CommerceCartQuote = {
  lines: CommerceQuoteLine[];
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
  pincode: string;
  serviceable: true;
  etaMinDays: number;
  etaMaxDays: number;
  assemblyInstallNote: string | null;
  codAllowed: boolean;
};

export type CommerceCodOrderReceipt = {
  orderReference: string;
  status: "confirmed";
  totalPaise: number;
};

export type CommerceRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export type CommerceTrackingIdentity = {
  matched: boolean;
};
