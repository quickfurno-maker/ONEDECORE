export interface WhatsappSavedReply {
  readonly id: string;
  readonly label: string;
  readonly body: string;
}

export const ONEDECORE_WHATSAPP_SAVED_REPLIES: readonly WhatsappSavedReply[] = [
  {
    id: "welcome",
    label: "Welcome",
    body: "Thank you for contacting ONEDECORE. Please share your requirement and project location so our team can assist you better.",
  },
  {
    id: "service-location",
    label: "Ask requirement",
    body: "Could you please share the service you need and your property location in Pune?",
  },
  {
    id: "consultation",
    label: "Consultation",
    body: "We can arrange a design consultation to understand your requirements, style and budget. Please share a convenient date and time.",
  },
  {
    id: "site-visit",
    label: "Site visit",
    body: "We can schedule a site visit for measurements and requirement discussion. Please share your preferred date and time.",
  },
  {
    id: "quotation-followup",
    label: "Quotation follow-up",
    body: "Just checking whether you had a chance to review the ONEDECORE quotation. Please let us know if you would like us to explain or revise anything.",
  },
  {
    id: "thanks",
    label: "Thank you",
    body: "Thank you. We have noted your requirement and will keep the next step updated here.",
  },
] as const;
