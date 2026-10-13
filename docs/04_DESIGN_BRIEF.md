# 04 — Design brief

Version 2.1 | Updated 13 October 2026 from the user-supplied 90568.jpg reference.

The user explicitly selected the attached teal botanical skincare-store design. This supersedes the earlier cream/plum proposal. Match its structure, proportions and typography closely; adapt to BennyC branding, NGN and truthful content. Original generated photography is used as illustrative demo assets, not as evidence of actual stock. Pixel-perfect comparison remains pending browser review.

## Brand and design objective

Display **BennyC Beauty Solution** as the primary name and **Cosmetics & Makeup Venture** as the descriptor. The public store should feel clean, trustworthy and product-led. The administration interface should make stock and order tasks quick and legible.

Use original, restrained styling. Avoid gold-heavy shine, decorative dashboards, unverified review counters and generic beauty imagery that misrepresents the stocked products. Product photography should do most of the visual work.

## Proposed design tokens

| Token | Proposed value | Use |
| --- | --- | --- |
| Page background | `#F6FBF9` | Pale mint storefront |
| Surface | `#FFFFFF` | Cards, forms and staff tables |
| Main text | `#193B36` | Headings and body |
| Secondary text | `#53736B` | Labels and supporting text |
| Primary | `#09675F` | Main actions and active navigation |
| On-primary | `#FFFFFF` | Text on primary buttons |
| Border | `#CBDED6` | Decorative separation; not the sole input boundary |
| Control border | `#87A798` | Form/input boundaries, subject to contrast testing |
| Focus | `#1D4ED8` | Visible keyboard focus outline |
| Success | `#166534` | Success icon/text plus plain-language label |
| Warning | `#92400E` | Pending/attention text with label |
| Error | `#B91C1C` | Errors plus corrective instructions |

Implement these as tokens so brand changes do not require scattered component edits. Check rendered contrast; target WCAG AA contrast and keyboard usability, but do not claim certification without an audit.

Typography: Georgia/Times display headings and Arial/Helvetica body copy match the reference without external font requests. Suggested body size 16 px; secondary text 14 px; product titles 16–18 px; page headings 28–40 px depending on viewport. If adding a display font, verify its licence and loading cost. Use a 4/8 px spacing scale with common gaps of 8, 16, 24 and 32 px. Use restrained 8–12 px corners, subtle shadows and clear hierarchy.

## Public screen composition

**Homepage:** deep-teal utility/header bars; a large botanical portrait with a left-aligned four-line serif headline; overlapping four-column pale-mint feature panel; six circular categories; a four-column product collection; a teal product banner; service links and footer. Include real business information only when supplied. Avoid a large rotating carousel that delays access to the catalogue.

**Catalogue:** visible search; category and brand filters; result count; consistent product cards; pagination. A phone can use two columns when titles/prices remain readable, falling back to one at narrow widths. Product cards include image, product name, starting price or exact variant price as appropriate, and genuine availability when implemented. Do not display a single variant price as the price of every option.

**Product detail:** large image area; product name/brand; price; accessible option controls; available state; quantity; primary action; description and verified product information. Labels must distinguish volume, size and shade. Keep add-to-cart near the selection on phones without obscuring content.

**Cart:** editable rows with variant labels, quantity, line total and remove action. Preserve context when an item becomes unavailable. Show that delivery is determined at checkout if it is not yet known.

**Checkout:** one clear sequence: contact, fulfilment, review, payment. Show full cost breakdown and any price changes before committing. Avoid account-registration gates. Mark required fields in text and associate errors with the relevant inputs.

**Confirmation/status:** distinguish Payment pending, Payment confirmed and Order completed. Display a usable reference and the next expected business step. Do not show green success merely because a payment window closed.

## Staff interface

Use a neutral white/cream workspace with persistent location and role context. On phones, prioritize one primary task per screen and readable cards instead of squeezed desktop tables.

| Screen | Highest-priority information |
| --- | --- |
| Dashboard | Orders needing action, stock/expiry alerts, scoped date labels |
| Products | SKU/variant, publication state, price, edit/archive actions |
| Inventory | Physical, held, quarantined and available quantities clearly distinguished |
| Receiving | Selected SKU, batch, quantity, expiry and final review |
| New sale | Basket, confirmed payment channel, total and submit state |
| Order detail | Payment, fulfilment, allocation exceptions, customer delivery details and history |
| Reports | Date range, metric definition, gross/refunds/net separation and export |
| Staff settings | Active membership, role and impact of role changes |

Dashboard numbers must be real and labelled by date/population. In the foundation phase, use empty states or unavailable sections rather than fictional revenue or orders.

## Components and interactions

Create shared buttons, labelled fields, selects, quantity controls, product cards, status badges, confirmation dialogs, alert panels, skeletons, empty states, paginated tables and mobile navigation. Avoid a generic component framework more complex than the actual screens need.

Aim for at least 44 px comfortable touch targets. Support keyboard activation, visible focus and reduced-motion preference. Dialogs trap focus correctly and return it when closed. Use text/icons alongside status colours. Loading disables only the relevant action and preserves readable labels. Failure must offer a meaningful next step.

## Content and assets

Use owner-approved photographs or clearly labelled neutral demo placeholders. Product images need concise alternative text and a consistent crop that preserves packaging. Compress and resize before delivery. Do not embed critical product text solely in images.

Write plain, respectful copy: Add to cart, Continue to payment, Record sale, Receive stock. Avoid technical labels such as ORM, migration, tenant or webhook in customer/staff workflows. Keep useful error explanations visible; log implementation detail privately.

## Review checklist

Check at approximately 360 px, 768 px and a desktop width. Test long product names, no image, many variants, sold-out products, validation errors, slow loading and empty data. Verify keyboard order, screen-reader field labels, contrast and image sizes. Save only non-sensitive screenshots for implementation evidence.
