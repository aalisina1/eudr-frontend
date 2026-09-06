/**
 * The single definition of how the product names itself.
 *
 * Before this existed, four different descriptors were live at once — the tab
 * title said "EUDR Compliance Platform", the sidebar said "EUDR Compliance",
 * the login panel said "EUDR Platform" and its footer said "Grovetrace EUDR
 * Compliance Platform". That was not a typo. There was no single place the
 * product's name was defined, so each screen invented its own.
 *
 * Every chrome surface reads from here, and an ESLint rule (ADR-0027) rejects
 * the product name written as a literal anywhere else, so the drift cannot
 * come back.
 *
 * Spec: eudr-vault/10-Specs/product-voice-and-identity.md, Decision 1.
 */

/** The product name. Stands alone; it is not a sentence and takes no suffix. */
export const PRODUCT_NAME = "Grovetrace";

/**
 * Optional line shown under the name in the sidebar and on the login panel.
 *
 * Deliberately empty. The spec's open question is whether the product carries
 * a claim we own ("every shipment, ordered by what runs out of time first") or
 * a category label ("EUDR compliance"). Inventing a founder's claim in code is
 * how the four descriptors happened in the first place, so the slot ships empty
 * and the name stands alone — the least generic of the available defaults.
 *
 * Setting this to a string is the only change needed to light it up everywhere.
 */
export const PRODUCT_DESCRIPTOR: string | null = null;

/** Browser tab title, and the base for per-page titles. */
export const PRODUCT_TITLE = PRODUCT_DESCRIPTOR
  ? `${PRODUCT_NAME} · ${PRODUCT_DESCRIPTOR}`
  : PRODUCT_NAME;

/**
 * Meta description. States what the product does rather than listing the
 * categories it belongs to; the previous one ("Deforestation-free supply chain
 * management & due diligence reporting") was keyword soup.
 */
export const PRODUCT_DESCRIPTION =
  "Know which shipments will clear customs, and which ones are still missing a due diligence statement.";
