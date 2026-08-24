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

export type CommerceTrackingSnapshotItem = {
  lineNumber: number;
  productName: string;
  productSlug: string;
  sku: string;
  variantDisplayName: string | null;
  quantity: number;
  sellingUnitPricePaise: number;
  lineTotalPaise: number;
  availabilityMode: "ready_stock" | "made_to_order";
  primaryImagePublicPath: string | null;
};

export type CommerceTrackingSnapshot = {
  orderReference: string;
  status: string;
  paymentMethod: string;
  currency: string;
  createdAt: string;
  confirmedAt: string | null;
  processingAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
  fulfilmentTrackingReference: string | null;
  items: CommerceTrackingSnapshotItem[];
  delivery: {
    recipientName: string;
    mobileE164: string;
    email: string | null;
    addressLine1: string;
    addressLine2: string | null;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    shippingChargePaise: number;
    etaMinDays: number;
    etaMaxDays: number;
    assemblyInstallNote: string | null;
  };
};
