import {
  formatWhatsappRate,
  WHATSAPP_FUNNEL_STAGES,
  whatsappFunnelRate,
  type WhatsappFunnelSummary,
} from "../../contracts/analytics.ts";

/**
 * One-series funnel: bar length is the stage count relative to the recipients
 * targeted. One hue (magnitude), values in text ink, the stage's evidence rule
 * as the hover title, and the list itself is the table view.
 */
export function WhatsappFunnel({ summary, caption }: { readonly summary: WhatsappFunnelSummary; readonly caption: string }) {
  const base = Math.max(summary.targeted ?? 0, summary.sent ?? 0, 1);
  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="od-cp__hint" style={{ marginBlockEnd: 10 }}>
        {caption}
      </figcaption>
      <ol className="od-cp__funnel" data-testid="whatsapp-analytics-funnel">
        {WHATSAPP_FUNNEL_STAGES.map((stage) => {
          const value = summary[stage.key] ?? 0;
          const width = Math.max(value > 0 ? 1 : 0, Math.round((value / base) * 100));
          return (
            <li key={stage.key} className="od-cp__funnel-row" title={`${stage.label}: ${stage.evidence}`}>
              <span>{stage.label}</span>
              <span className="od-cp__funnel-track" aria-hidden="true">
                <span className="od-cp__funnel-bar" style={{ width: `${width}%` }} />
              </span>
              <span className="od-cp__funnel-value">
                {value.toLocaleString("en-IN")} <span className="od-cp__sub" style={{ display: "inline" }}>{formatWhatsappRate(whatsappFunnelRate(summary, stage.key))}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
