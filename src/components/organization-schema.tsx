import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/constants";

/**
 * Organization structured data for the homepage.
 *
 * Deliberately limited to things that are true today: who we are, where
 * to reach us, and what the service does. No ratings, no founding date,
 * no claims about compliance outcomes.
 */
export function OrganizationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      `${SITE_NAME} helps small industrial subcontractors identify which ` +
      "safety programs, training records, and insurance documents are " +
      "missing from their ISNetworld or Avetta prequalification file.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: CONTACT_EMAIL,
      areaServed: "US",
      availableLanguage: "English",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
