import type { SVGProps } from "react";

export type VendorIconName =
  | "dashboard"
  | "products"
  | "add"
  | "stock"
  | "orders"
  | "signout"
  | "package"
  | "check"
  | "clock"
  | "draft"
  | "warning"
  | "arrow"
  | "review";

export function VendorIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: VendorIconName }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "dashboard") return <svg {...common} {...props}><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/><path d="M10 20v-6h4v6"/></svg>;
  if (name === "products") return <svg {...common} {...props}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v9"/></svg>;
  if (name === "add") return <svg {...common} {...props}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>;
  if (name === "stock") return <svg {...common} {...props}><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"/><path d="M12 12 4.5 7.8M12 12l7.5-4.2M12 12v9"/><path d="m8.5 5 7.5 4.3"/></svg>;
  if (name === "orders") return <svg {...common} {...props}><path d="M6 3h12l2 4H4l2-4Z"/><path d="M5 7v13h14V7"/><path d="M9 11h6M9 15h4"/></svg>;
  if (name === "signout") return <svg {...common} {...props}><path d="M10 4H5v16h5"/><path d="M13 8l4 4-4 4M17 12H9"/></svg>;
  if (name === "package") return <svg {...common} {...props}><path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"/><path d="m5.5 7.3 6.5 3.8 6.5-3.8M12 11v10"/></svg>;
  if (name === "check") return <svg {...common} {...props}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/></svg>;
  if (name === "clock") return <svg {...common} {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if (name === "draft") return <svg {...common} {...props}><path d="M7 3h7l4 4v14H7V3Z"/><path d="M14 3v5h5M10 12h5M10 16h4"/></svg>;
  if (name === "warning") return <svg {...common} {...props}><path d="M12 4 3.8 19h16.4L12 4Z"/><path d="M12 9v4M12 16h.01"/></svg>;
  if (name === "arrow") return <svg {...common} {...props}><path d="M5 12h14M14 7l5 5-5 5"/></svg>;
  return <svg {...common} {...props}><path d="M5 5h14v11H9l-4 4V5Z"/><path d="M9 9h6M9 12h4"/></svg>;
}
