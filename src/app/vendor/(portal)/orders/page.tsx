import { buildCommercePublicUrl } from "@/features/commerce/public/public-url";
import { VendorIcon } from "@/features/commerce/vendor/components/VendorIcon";
import { listMyVendorOrders, type VendorOrderEvent } from "@/features/commerce/vendor/vendor-orders";

function money(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function eventLabel(event: VendorOrderEvent): string {
  if (event.eventCode === "order_confirmed_cod") return "Order placed";
  if (event.eventCode === "processing_started") return "Processing started";
  if (event.eventCode === "order_shipped") return "Order shipped";
  if (event.eventCode === "order_delivered") return "Order delivered";
  if (event.eventCode === "order_cancelled") return "Order cancelled";
  if (event.eventCode === "inventory_restocked_on_cancel") return "Inventory restored";
  return label(event.eventCode);
}

function statusTone(status: string): string {
  if (status === "delivered") return "bg-[#e3f0e4] text-[#3d7249]";
  if (status === "cancelled") return "bg-[#f4dddd] text-[#9b4848]";
  if (status === "shipped") return "bg-[#e7edf3] text-[#4f6578]";
  if (status === "processing") return "bg-[#fff0d9] text-[#9a6929]";
  return "bg-[#eceeea] text-[#566158]";
}
export default async function VendorOrdersPage() {
  const orders = await listMyVendorOrders(60);
  const openOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  const units = orders.reduce((sum, order) => sum + order.units, 0);
  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--vendor-green)]">Order visibility</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">Orders</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--od-text-2)]">Track your products, ordered quantities and fulfilment timeline. Customer identity and delivery details are not shared.</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-xl border border-[var(--vendor-border)] bg-[var(--vendor-surface)] px-3.5 py-2 text-xs"><strong className="text-sm">{openOrders}</strong> open</span>
          <span className="rounded-xl border border-[var(--vendor-border)] bg-[var(--vendor-surface)] px-3.5 py-2 text-xs"><strong className="text-sm">{units}</strong> units</span>
        </div>
      </header>

      {orders.length === 0 ? (
        <section className="vendor-panel p-8 text-center sm:p-12"><VendorIcon name="orders" className="mx-auto h-9 w-9 text-[#9a8b7c]"/><h2 className="mt-4 text-base font-semibold">No orders yet</h2><p className="mt-1 text-sm text-[var(--od-muted)]">Orders containing your products will appear here automatically.</p></section>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.orderId} className="vendor-panel overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--vendor-border)] px-5 py-4 sm:px-6">
                <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">{order.orderReference}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone(order.status)}`}>{label(order.status)}</span></div><p className="mt-1 text-xs text-[var(--od-muted)]">Placed {dateTime(order.placedAt)} · {order.paymentMethod.toUpperCase()}</p></div>
                <div className="text-right"><p className="text-[11px] text-[var(--od-muted)]">Your items</p><p className="mt-1 text-sm font-semibold">{order.units} unit{order.units === 1 ? "" : "s"} · {money(order.vendorLineTotalPaise)}</p></div>
              </div>
              <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--od-muted)]">Products in this order</h3>
                  <div className="mt-3 divide-y divide-[var(--vendor-border)]">
                    {order.items.map((item) => {
                      const image = buildCommercePublicUrl(item.primaryImagePublicPath);
                      return (
                        <div key={`${order.orderId}-${item.lineNumber}`} className="flex gap-3 py-3 first:pt-0">
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#ece5dc]">
                            {image ? <div role="img" aria-label={item.productName} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} /> : <div className="grid h-full place-items-center text-[#9b8c7d]"><VendorIcon name="package" className="h-6 w-6"/></div>}
                          </div>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.productName}</p><p className="mt-1 text-[11px] text-[var(--od-muted)]">{item.sku} · {item.productReference}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"><span><span className="text-[var(--od-muted)]">Quantity </span><strong>{item.quantity}</strong></span><span><span className="text-[var(--od-muted)]">Unit price </span><strong>{money(item.sellingUnitPricePaise)}</strong></span><span><span className="text-[var(--od-muted)]">Line total </span><strong>{money(item.lineTotalPaise)}</strong></span></div></div>
                        </div>
                      );
                    })}
                  </div>
                  {order.trackingReference ? <p className="mt-4 rounded-xl bg-[#f4efe9] px-3.5 py-3 text-xs"><span className="text-[var(--od-muted)]">Tracking reference </span><strong>{order.trackingReference}</strong></p> : null}
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--od-muted)]">Order timeline</h3>
                  <ol className="mt-4 space-y-0">
                    {order.events.map((event, index) => (
                      <li key={`${event.eventCode}-${event.createdAt}-${index}`} className="relative flex gap-3 pb-5 last:pb-0">
                        {index < order.events.length - 1 ? <span className="absolute left-[7px] top-4 h-full w-px bg-[var(--vendor-border-strong)]" /> : null}
                        <span className="relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-[4px] border-[#e8efe8] bg-[var(--vendor-green)]" />
                        <div><p className="text-sm font-medium">{eventLabel(event)}</p><p className="mt-0.5 text-[11px] text-[var(--od-muted)]">{dateTime(event.createdAt)}</p>{event.toStatus ? <p className="mt-1 text-[11px] text-[var(--od-text-2)]">Status: {label(event.toStatus)}</p> : null}</div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
