import { LeadConsultationHost } from "@/features/lead-intake/public/LeadConsultationHost";
import { DiscoveryWhatsAppFab } from "@/features/public-site/discovery/DiscoveryWhatsAppFab";
import { HomeStickyActions } from "@/features/public-site/home-r4/HomeStickyActions";
import "@/features/public-site/discovery/discovery.css";

/**
 * The homepage's bottom conversion treatment, on another public page.
 *
 * THE SAME COMPONENTS, NOT A MATCHING PAIR
 *
 * `HomeStickyActions` and `DiscoveryWhatsAppFab` are the two the homepage
 * mounts, and they are what this mounts. Nothing here re-implements a sticky
 * bar, re-declares a label, or writes a `wa.me` URL: the WhatsApp href comes
 * from `getPublicWhatsAppHref()` and the call link from `getPublicPhoneHref()`,
 * both inside those components, both reading the validated E.164 configuration.
 * A second implementation would be a second place to keep a phone number in
 * step, and the day they disagreed the wrong one would be the one on the page
 * nobody was looking at.
 *
 * WHY THE PLAN HOST COMES WITH IT
 *
 * The sticky bar's primary button opens the consultation planner, which reads
 * `usePlan()`. That context is provided by `LeadConsultationHost`, which also
 * mounts the sheet the button opens — once. Mounting the bar without the host
 * would throw on render; mounting the host without the bar would ship a sheet
 * nothing can open. They travel together, so they are packaged together.
 *
 * The homepage already wraps its whole tree in `LeadConsultationHost` and does
 * NOT use this component, so there is no nesting and no second sheet.
 *
 * WHY THE `data-public-home-r4` WRAPPER
 *
 * `.pm-sticky` and the `.dc-btn` classes it uses are scoped to that attribute
 * in `home-r4.css`, which `app/layout.tsx` already loads globally. Wrapping
 * only the dock lets those exact rules apply to the bar and nothing else on
 * the page — no other element inherits the homepage stylesheet. The wrapper is
 * layout-neutral because everything inside it is `position: fixed`.
 *
 * The homepage shell carries the same attribute on its root, so the selectors
 * it matches are unchanged: this adds a second place they apply, and takes
 * nothing away from the first.
 */
export function PublicConversionDock() {
  return (
    <LeadConsultationHost>
      <div data-public-home-r4="" className="od-public-dock">
        <HomeStickyActions />
        <DiscoveryWhatsAppFab />
      </div>
    </LeadConsultationHost>
  );
}
