/**
 * ONEDECORE retail furniture policy bundle.
 *
 * Owner-authorized launch closeout, effective 2026-09-15. These policies are
 * intentionally separate from the interior-project warranty matrix. They apply
 * to ready-made furniture orders placed through /shop.
 */

import { BUSINESS_IDENTITY } from "@/features/legal/business-identity.ts";

export interface CommercePolicySection {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
}

export const COMMERCE_POLICY_EFFECTIVE_DATE = "2026-09-15" as const;
export const COMMERCE_POLICY_BUNDLE_VERSION = "commerce-policy-bundle-v1.0" as const;

export const COMMERCE_POLICY_VERSIONS = {
  terms: "terms-of-use-v1.0",
  shippingDelivery: "commerce-shipping-delivery-v1.0",
  cancellation: "commerce-cancellation-v1.0",
  returnsRefunds: "commerce-returns-refunds-v1.0",
  productWarranty: "commerce-product-warranty-v1.0",
} as const;

export const COMMERCE_POLICY_PATHS = {
  shippingDelivery: "/shipping-delivery",
  cancellation: "/cancellation",
  returnsRefunds: "/returns-refunds",
  productWarranty: "/product-warranty",
} as const;

const contactEmail = BUSINESS_IDENTITY.businessEmail ?? "onedecore@gmail.com";
const office = BUSINESS_IDENTITY.registeredOfficeAddress ??
  "SHOP NO 3, UBALE NAGAR, BEHIND RUDRA TATA MOTORS, WAGHOLI-412207";

export const SHIPPING_DELIVERY_SECTIONS: readonly CommercePolicySection[] = [
  {
    id: "scope",
    title: "Scope",
    body: [
      "This policy applies to ready-made furniture ordered through the ONEDECORE online shop. Interior-design projects, modular work and custom project quotations follow their separately agreed project terms.",
      "The current shop launch is Pune-focused. An order can proceed only when the delivery pincode is configured as serviceable at checkout.",
    ],
  },
  {
    id: "serviceability",
    title: "Pincode serviceability",
    body: [
      "The pincode checker and checkout use the current server-side serviceability list. A pincode being serviceable today does not guarantee that every product or future order will be serviceable there.",
      "If a delivery address cannot be served after an order is accepted, ONEDECORE will contact the customer and offer a lawful resolution, including cancellation where delivery cannot reasonably be completed.",
    ],
  },
  {
    id: "charges",
    title: "Delivery charges and order total",
    body: [
      "Any delivery charge, product tax included in the listed price, and final order total are recalculated on the server immediately before order confirmation. Browser or cached values are not authoritative.",
      "Cash on delivery is the only payment method offered in the current shop launch.",
    ],
  },
  {
    id: "eta",
    title: "Estimated delivery",
    body: [
      "The checkout displays an estimated delivery range based on the product and serviceable pincode. It is an estimate rather than a guaranteed appointment time.",
      "Made-to-order products may require production time before dispatch. Ready-stock status is revalidated when the order is placed.",
    ],
  },
  {
    id: "access",
    title: "Delivery access and inspection",
    body: [
      "Customers must provide a complete address, reachable mobile number and reasonable delivery access. Please disclose access restrictions such as narrow staircases, lift limitations, society timing rules or unusual carrying requirements before delivery where they may affect fulfilment.",
      "Where practical, inspect the outer condition and visible product condition at delivery. If damage is visible, note it with the delivery team and retain photographs or video for support.",
    ],
  },
  {
    id: "assembly",
    title: "Assembly and installation",
    body: [
      "Assembly or installation is included only when the product or checkout explicitly states that it is included. Product-specific assembly notes shown at checkout form part of the order delivery snapshot.",
    ],
  },
  {
    id: "delays",
    title: "Delays and force majeure",
    body: [
      "Weather, access restrictions, transport disruption, public restrictions or other events outside reasonable control may affect an estimate. ONEDECORE will use reasonable efforts to communicate material delays and provide the remedies required by applicable law.",
    ],
  },
  {
    id: "contact",
    title: "Delivery support",
    body: [
      `Email ${contactEmail} with the order reference and delivery issue.`,
      `Business address: ${office}.`,
    ],
  },
] as const;

export const CANCELLATION_SECTIONS: readonly CommercePolicySection[] = [
  {
    id: "request",
    title: "How to request cancellation",
    body: [
      `Send the order reference and registered mobile number to ${contactEmail}. A cancellation request is not complete until ONEDECORE confirms the order status and outcome.`,
    ],
  },
  {
    id: "ready-stock",
    title: "Ready-stock orders",
    body: [
      "A ready-stock COD order may normally be cancelled without a cancellation charge while it has not been shipped. Once shipped, the request is handled under the Returns & Refunds Policy and applicable law.",
    ],
  },
  {
    id: "made-to-order",
    title: "Made-to-order furniture",
    body: [
      "A made-to-order item may be cancelled before production, material commitment or product-specific work has begun. After that point, change-of-mind cancellation may be declined because the item has been committed for that order.",
      "This does not limit remedies for defective, damaged, wrong, materially misdescribed or otherwise non-conforming goods under applicable law.",
    ],
  },
  {
    id: "seller-cancellation",
    title: "Cancellation by ONEDECORE",
    body: [
      "ONEDECORE may cancel an order if stock becomes unavailable, the pincode cannot be serviced, delivery details cannot be validated, fulfilment would be unsafe or unlawful, or another material fulfilment problem prevents performance.",
      "For COD orders there is no prepaid purchase amount to refund. If a future order has any collected amount, any approved refund will follow the payment-specific refund process disclosed for that order.",
    ],
  },
  {
    id: "rights",
    title: "Consumer rights",
    body: [
      "Nothing in this cancellation policy removes or narrows rights that cannot lawfully be excluded under applicable Indian consumer law.",
    ],
  },
] as const;

export const RETURNS_REFUNDS_SECTIONS: readonly CommercePolicySection[] = [
  {
    id: "eligible",
    title: "When a return or remedy is available",
    body: [
      "ONEDECORE will not rely on this policy to refuse remedies that are required by applicable law. This includes situations such as goods that are defective, damaged, wrong, materially different from the description or specification agreed, or otherwise not in conformity with the order.",
      "Where applicable law requires a remedy for an unreasonably late delivery, that remedy also remains available.",
    ],
  },
  {
    id: "change-of-mind",
    title: "Change-of-mind returns",
    body: [
      "Because furniture is bulky and may be made or allocated for a specific order, the shop does not offer a general change-of-mind return right unless the individual product page or written order confirmation expressly says otherwise.",
      "Made-to-order and product-specific selections are not change-of-mind returnable after production or material commitment unless a separate written term says otherwise.",
    ],
  },
  {
    id: "reporting",
    title: "Report a problem",
    body: [
      `Email ${contactEmail} with the order reference, registered mobile number, a description of the issue and useful photographs or video. For faster inspection, please report visible transit damage as soon as reasonably practical after delivery.`,
      "Prompt reporting helps preserve delivery evidence, but delay in reporting does not by itself remove a statutory right that remains available.",
    ],
  },
  {
    id: "inspection",
    title: "Inspection and collection",
    body: [
      "ONEDECORE may reasonably inspect the product or request photographs before confirming a remedy. Where a return is approved for a ONEDECORE-responsible defect, wrong product or transit damage, collection or another suitable return arrangement will be coordinated with the customer.",
    ],
  },
  {
    id: "remedies",
    title: "Repair, replacement, return or refund",
    body: [
      "Depending on the issue, product condition, availability and applicable law, the remedy may be repair, replacement, return with refund, or another mutually agreed solution.",
      "For an approved monetary refund, ONEDECORE will request appropriate bank or UPI settlement details through a controlled support channel and process the refund within the timeframe required by applicable law or otherwise communicated when the refund is approved.",
    ],
  },
  {
    id: "condition",
    title: "Product condition and exclusions",
    body: [
      "A return may be declined where the problem was caused after delivery by misuse, unauthorized alteration, improper handling, normal wear, or use contrary to supplied care instructions, unless applicable law requires otherwise.",
      "Original packaging should be retained when reasonably possible, but lack of packaging alone does not automatically defeat a valid defect or damage claim.",
    ],
  },
  {
    id: "rights",
    title: "Statutory rights",
    body: [
      "These shop rules operate in addition to non-excludable rights under applicable Indian law. If a policy sentence conflicts with a mandatory consumer protection, the mandatory protection prevails.",
    ],
  },
] as const;

export const PRODUCT_WARRANTY_SECTIONS: readonly CommercePolicySection[] = [
  {
    id: "scope",
    title: "Retail product warranty scope",
    body: [
      "This page applies only to ready-made furniture purchased through the ONEDECORE shop. It does not convert the separate interior-project marketing warranty reference into a blanket warranty for retail furniture.",
      "A retail product has a contractual warranty period only when that period is expressly shown on the product page, specification, written order confirmation or another written warranty document supplied for that product.",
    ],
  },
  {
    id: "coverage",
    title: "What a stated product warranty covers",
    body: [
      "Unless a product-specific document says otherwise, a stated warranty covers manufacturing defects within the identified covered component and period. Coverage is assessed against normal intended household use and supplied care instructions.",
    ],
  },
  {
    id: "not-covered",
    title: "Common exclusions",
    body: [
      "A stated warranty does not normally cover ordinary wear, accidental damage, misuse, water or moisture exposure outside intended use, pest damage, damage from unauthorized repair or modification, commercial use where a product is sold for household use, or cosmetic variation that is an inherent characteristic of the disclosed material.",
      "Product-specific terms may add or narrow exclusions only to the extent permitted by law.",
    ],
  },
  {
    id: "claim",
    title: "How to make a warranty claim",
    body: [
      `Email ${contactEmail} with the order reference, product or SKU, a description of the issue, and clear photographs or video where useful. ONEDECORE may request reasonable inspection before confirming coverage.`,
    ],
  },
  {
    id: "remedy",
    title: "Warranty remedy",
    body: [
      "For a valid contractual warranty claim, ONEDECORE may repair the covered defect, replace the affected component or product with an equivalent where appropriate, or provide another remedy required by the written warranty and applicable law.",
    ],
  },
  {
    id: "consumer-rights",
    title: "Consumer rights remain separate",
    body: [
      "A contractual warranty is additional to rights that cannot be excluded under applicable Indian consumer law. A product without an advertised contractual warranty is not thereby exempt from mandatory quality or conformity obligations.",
    ],
  },
] as const;

export function currentCommercePolicyAcceptance() {
  return {
    accepted: true,
    bundle_version: COMMERCE_POLICY_BUNDLE_VERSION,
    terms_version: COMMERCE_POLICY_VERSIONS.terms,
    shipping_delivery_version: COMMERCE_POLICY_VERSIONS.shippingDelivery,
    cancellation_version: COMMERCE_POLICY_VERSIONS.cancellation,
    returns_refunds_version: COMMERCE_POLICY_VERSIONS.returnsRefunds,
    product_warranty_version: COMMERCE_POLICY_VERSIONS.productWarranty,
  } as const;
}
