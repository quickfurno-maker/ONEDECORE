"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  AD_CONSENT_CHANGE_EVENT,
  readAdConsent,
} from "../../marketing/meta/ad-consent.ts";
import { useAdConsent } from "../../marketing/meta/use-ad-consent.ts";
import { isMetaTrackablePath } from "../../marketing/meta/meta-tracking-config.ts";
import {
  clearWebsiteAnalyticsBrowserState,
  trackWebsiteAnalyticsEvent,
} from "./website-analytics-client.ts";

function classifyClick(target: Element): {
  readonly type: "cta_click" | "contact_whatsapp" | "contact_phone";
  readonly action: string | null;
} | null {
  const clickable = target.closest<HTMLElement>(
    "a[href],button,[data-conversion-action]"
  );
  if (!clickable) return null;

  const rawHref =
    clickable instanceof HTMLAnchorElement
      ? clickable.getAttribute("href") ?? ""
      : "";
  const href =
    clickable instanceof HTMLAnchorElement ? clickable.href : "";
  const action = clickable.dataset.conversionAction ?? null;

  if (/^tel:/i.test(rawHref)) {
    return { type: "contact_phone", action: action ?? "phone" };
  }
  if (
    /wa\.me|whatsapp\.com/i.test(href) ||
    /whatsapp/i.test(action ?? "")
  ) {
    return { type: "contact_whatsapp", action: action ?? "whatsapp" };
  }
  if (!action) return null;
  return { type: "cta_click", action };
}

export function WebsiteAnalyticsTracker() {
  const pathname = usePathname();
  const consent = useAdConsent();
  const lastPage = useRef<string | null>(null);
  const formStarted = useRef(false);

  useEffect(() => {
    if (consent !== "granted") {
      lastPage.current = null;
      formStarted.current = false;
      clearWebsiteAnalyticsBrowserState();
      return;
    }
    if (!pathname || !isMetaTrackablePath(pathname)) return;
    if (lastPage.current === pathname) return;
    lastPage.current = pathname;
    void trackWebsiteAnalyticsEvent("page_view");
  }, [consent, pathname]);

  useEffect(() => {
    if (consent !== "granted") return;

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const classified = classifyClick(event.target);
      if (classified) {
        void trackWebsiteAnalyticsEvent(classified.type, classified.action);
      }
    };

    const onFocus = (event: FocusEvent) => {
      if (formStarted.current || !(event.target instanceof Element)) return;
      if (!event.target.closest("[data-od-lead-form]")) return;
      formStarted.current = true;
      void trackWebsiteAnalyticsEvent("lead_form_start");
    };

    const onSubmit = (event: SubmitEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.matches("[data-od-lead-form]")) return;
      void trackWebsiteAnalyticsEvent("lead_form_submit", "lead-submit");
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [consent]);

  useEffect(() => {
    const onConsentChange = () => {
      if (readAdConsent() !== "granted") {
        clearWebsiteAnalyticsBrowserState();
      }
    };
    window.addEventListener(AD_CONSENT_CHANGE_EVENT, onConsentChange);
    return () =>
      window.removeEventListener(AD_CONSENT_CHANGE_EVENT, onConsentChange);
  }, []);

  return null;
}
