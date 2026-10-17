import type { ReactNode } from "react";
import type { ResolvedLegal } from "@/lib/legal";
import type { LegalSection } from "./LegalDoc";
import { whoWeAre } from "./LegalDoc";

// The standard text of JDHub's legal pages, in markdown-lite (see RichText).
// Business details come from /admin/privacy; admins can append extra clauses there.
// Have a Nigerian lawyer review any change before it goes live.

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const mail = (email: string) => `[${email}](mailto:${email})`;
const NDPC = "[Nigeria Data Protection Commission (NDPC)](https://ndpc.gov.ng)";

// -------------------------------------------------------------------- Privacy

export const privacyIntro = (l: ResolvedLegal) =>
  `How ${l.brand} collects, uses, shares and protects your personal data when you buy, sell or swap with us, in line with the Nigeria Data Protection Act 2023.`;

export function privacySections(l: ResolvedLegal): LegalSection[] {
  const dpo = l.dpoName ? `${l.dpoName}, our Data Protection Officer, at ${mail(l.privacyEmail)}` : `our Data Protection Officer at ${mail(l.privacyEmail)}`;
  return [
    {
      id: "who-we-are",
      title: "Who we are",
      body: `${l.brand} is a marketplace for graded used phones, gadgets, accessories and cars in Nigeria. You can buy from us, sell to us, or trade in a device or car towards something else (a "swap").

This policy is issued by ${whoWeAre(l)} We are the **data controller** for the personal data described here, which means we decide why and how it is used.

You can reach ${dpo} for anything about your personal data.`,
    },
    {
      id: "scope",
      title: "What this policy covers",
      body: `This policy applies to our website, customer accounts, checkout, our sell, trade-in and swap services, our drop-off hubs, and conversations with us by WhatsApp, phone, SMS and email.

It does not cover other websites or apps we link to, such as Paystack's payment pages or WhatsApp. Those services have their own privacy policies.`,
    },
    {
      id: "data-we-collect",
      title: "Personal data we collect",
      body: `We only collect what we need to run the service.

- **Account details:** your phone number and/or email address, used to sign in with a one-time code. We never ask for or store a password.
- **Profile and delivery details:** your name, phone number, email, delivery address, city and state.
- **Order history:** the items you buy, prices, offer codes used, delivery or pickup choice, order status and notes you add.
- **Payment information:** payment method, payment reference, amount and status. Card details are entered on Paystack's secure pages and are never seen or stored by us.
- **Sell, trade-in and swap details:** the item you offer us, its condition, photos you send, serial number, IMEI or VIN, and the bank account you want to be paid into. For cars we may also ask for vehicle papers and proof of ownership.
- **Messages:** what you tell us on WhatsApp, by phone, email or SMS, including support requests and disputes.
- **Technical data:** IP address, device and browser type, pages visited, and error reports. This keeps the site secure and working.
- **Analytics data:** how you use the site (for example which products you view), collected **only if you agree** in our cookie settings.

We do not knowingly collect sensitive personal data, such as health or religious information. Please don't send it to us.`,
    },
    {
      id: "how-we-use",
      title: "How we use your data and our lawful bases",
      body: `The Nigeria Data Protection Act 2023 (NDPA) requires a lawful basis for each use of personal data. Ours are:

- **To perform our contract with you:** creating your account, signing you in, processing and delivering orders, holding payments in escrow, paying you when you sell to us, handling trade-ins, returns, warranty claims and disputes.
- **To comply with the law:** keeping tax and accounting records, responding to lawful requests from regulators, the police or courts, and anti-fraud and anti-money-laundering checks.
- **For our legitimate interests,** where these are not outweighed by your rights: preventing fraud and the sale of stolen devices (including IMEI and VIN checks), securing our systems, monitoring errors, improving our service, and defending legal claims.
- **With your consent:** product analytics and any marketing messages. You can withdraw consent at any time, and doing so does not affect what happened before.

We do not make decisions about you based solely on automated processing that have legal or similarly significant effects on you.`,
    },
    {
      id: "sharing",
      title: "Who we share it with",
      body: `We **never sell** your personal data. We share it only with people who help us run ${l.brand}, under contracts that require them to keep it safe and use it only on our instructions:

- **Supabase:** our database, where accounts and orders are stored.
- **Vercel:** website hosting, and Vercel Blob for storing product and item photos.
- **Paystack:** card payments and payment verification.
- **Resend:** sending emails, including sign-in codes and order updates.
- **Termii:** sending SMS, including sign-in codes.
- **PostHog:** product analytics, only if you consent.
- **Sentry:** error monitoring. We remove phone numbers, emails and cookies from error reports before they are sent.
- **WhatsApp (Meta):** if you choose to chat or order with us on WhatsApp.
- **Delivery partners:** your name, phone number and address, so they can deliver your order.

We may also share data with our professional advisers, with banks for payouts and refunds, with law enforcement or regulators when the law requires it, or with a buyer of our business if it is ever sold (they would be bound by this policy).`,
    },
    {
      id: "transfers",
      title: "International transfers",
      body: `Some of our providers (including Supabase, Vercel, Resend, PostHog and Sentry) store or process data outside Nigeria, mainly in the European Union and the United States.

When data leaves Nigeria we rely on the safeguards in Part VIII of the NDPA: transfers to countries with adequate data protection laws, or binding contractual commitments such as standard contractual clauses, together with our providers' security certifications. You can ask ${mail(l.privacyEmail)} for more detail about the safeguards for a particular provider.`,
    },
    {
      id: "retention",
      title: "How long we keep it",
      body: `We keep personal data only as long as we need it:

- **Account and profile:** while your account is active. If you ask us to delete your account we anonymise your profile, normally within 30 days.
- **Orders, invoices and payment records:** 6 years after the end of the financial year they relate to, because Nigerian tax law requires it. After your account is deleted these records are kept without your contact details wherever possible.
- **Sign-in codes:** stored only as a scrambled (hashed) value and deleted after use or after 10 minutes.
- **Sell, trade-in and swap requests you don't go ahead with:** up to 12 months.
- **WhatsApp, email and support messages:** up to 2 years, or longer if they are part of a dispute.
- **Analytics data:** up to 12 months.
- **Error reports and security logs:** up to 90 days.

When the period ends we delete or anonymise the data.`,
    },
    {
      id: "your-rights",
      title: "Your rights",
      body: `Under the NDPA you have the right to:

- **Access** the personal data we hold about you and get a copy.
- **Rectification:** have inaccurate or incomplete data corrected.
- **Erasure:** have your data deleted where we no longer have a reason to keep it.
- **Restriction:** ask us to limit how we use your data while a concern is looked into.
- **Portability:** receive your data in a common, machine-readable format.
- **Object** to processing based on our legitimate interests, and to direct marketing at any time.
- **Withdraw consent** at any time, for example by turning analytics off in [cookie settings](/cookies#manage).
- **Complain** to the ${NDPC} if you think we have mishandled your data.

**How to use them:** signed-in customers can download their data and request account deletion from [your account](/account). You can also email ${mail(l.privacyEmail)} or message us on WhatsApp. We may ask you to confirm your identity before acting, and we aim to respond within 30 days. Exercising your rights is free.

Some data can't be deleted straight away, for example order records we must keep for tax. If so we'll tell you, and we'll keep it no longer than required.`,
    },
    {
      id: "security",
      title: "How we protect your data",
      body: `We use encryption in transit (HTTPS), signed and time-limited session cookies, hashed one-time codes, rate limits on sign-in, role-based access for our staff with an audit log of admin actions, and reputable providers with their own security certifications. Card payments are handled by Paystack, which is PCI DSS certified.

No system is perfectly secure. If a personal data breach is likely to put your rights at risk, we will notify the NDPC within 72 hours of becoming aware of it, as the NDPA requires, and tell you promptly if there is a high risk to you.`,
    },
    {
      id: "children",
      title: "Children",
      body: `${l.brand} is for adults. You must be 18 or older to create an account, buy, sell or swap. We do not knowingly collect personal data from anyone under 18. If you believe a child has given us their data, contact ${mail(l.privacyEmail)} and we will delete it.`,
    },
    {
      id: "marketing",
      title: "Marketing",
      body: `We only send marketing messages (such as offers by SMS, email or WhatsApp) if you have agreed to receive them. Every message tells you how to stop them, and you can opt out any time by replying STOP or contacting us. Order updates and sign-in codes are not marketing and are always sent.`,
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: `We may update this policy as our service or the law changes. The "last updated" date at the top shows when. If a change materially affects how we use your data we will tell you on the site or by message before it takes effect.`,
    },
    {
      id: "contact",
      title: "Contact and complaints",
      body: `For any privacy question or request, contact ${dpo}${l.registeredAddress ? `, or write to us at ${l.registeredAddress}` : ""}. You can also call ${l.phone}.

If you're not satisfied with our response, you have the right to complain to the ${NDPC}.`,
    },
  ];
}

// ---------------------------------------------------------------------- Terms

export const termsIntro = (l: ResolvedLegal) =>
  `The rules for buying, selling and swapping graded phones, gadgets and cars with ${l.brand}. Please read them before you place an order or sell to us.`;

export function termsSections(l: ResolvedLegal): LegalSection[] {
  return [
    {
      id: "about",
      title: "About these terms",
      body: `These terms are an agreement between you and ${whoWeAre(l)} ("${l.brand}", "we", "us"). By using our website, creating an account, placing an order or selling or swapping an item with us, you agree to them.

Our [Privacy Policy](/privacy), [Returns & Warranty policy](/returns) and [Cookie Policy](/cookies) form part of these terms. Nothing in these terms takes away your rights under the Federal Competition and Consumer Protection Act 2018 or any other Nigerian law.`,
    },
    {
      id: "accounts",
      title: "Your account",
      body: `You must be 18 or older and able to enter a binding contract to use ${l.brand}.

You sign in with a one-time code sent to your phone by SMS or to your email. Keep access to that phone number or inbox secure: anyone who can receive your codes can use your account. Give us accurate details and keep them up to date. Tell us straight away if you think someone else has used your account.

We may suspend or close an account that is used for fraud, abuse or in breach of these terms.`,
    },
    {
      id: "products",
      title: "Graded products",
      body: `Most items we sell are **used and graded**. Every listing shows its grade, and our [grading standard](/trust#grading) explains what each grade means. Signs of use described by the grade are not faults.

We check every device's IMEI or serial number, and every car's VIN, before it is listed. Photos show the actual item or a representative example of that grade, as stated on the listing. Battery health, storage, colour and other specifications are as shown on the listing at the time you order.

Some items may be listed by verified vendors. Where that applies the listing says so, and the order is still covered by our escrow and these terms.`,
    },
    {
      id: "prices-payment",
      title: "Prices and payment",
      body: `Prices are in Nigerian Naira (₦) and include any applicable VAT unless stated. Delivery fees are shown at checkout or confirmed with you before you pay.

You can pay by card through **Paystack**, by **bank transfer** to the account details we give you, or by arranging your order with us on **WhatsApp**. Never pay into an account that isn't shown on our website or confirmed by our official WhatsApp number.

Payments are held in **escrow**: we hold your money and only treat the sale as complete once you confirm delivery or the inspection period ends without a complaint.

If an item is listed at an obviously wrong price because of an error, we may cancel the order and refund you in full, even after you've paid.`,
    },
    {
      id: "orders",
      title: "Orders and reservations",
      body: `Placing an order is an offer to buy. A contract is formed when we confirm your order. When you order, we reserve the stock for you for a limited time; if payment isn't received within that time the order is cancelled automatically and the item is released.

We may cancel an order (and refund any payment in full) if the item is no longer available, we can't verify the payment, or we reasonably suspect fraud.`,
    },
    {
      id: "delivery",
      title: "Delivery and pickup",
      body: `We deliver across Nigeria or you can collect from one of our hubs. Delivery times are estimates. Please check your item when it arrives or at pickup: you have the inspection period described in our [Returns & Warranty policy](/returns) to confirm it matches its listing or raise a problem.

Risk in the item passes to you on delivery or collection. Ownership passes when you have paid in full.`,
    },
    {
      id: "selling",
      title: "Selling to us and trade-ins",
      body: `When you sell or trade in an item, the online estimate is a guide. Our **final offer** is made after we inspect the item and is held for 7 days.

By selling or trading in an item you confirm that:

- you own it, or are authorised to sell it, and it is not stolen, financed, rented or subject to any claim;
- for phones and gadgets, it is not blacklisted, and you have removed all accounts (such as iCloud or Google) and screen locks;
- for cars, the vehicle papers, customs documents and proof of ownership you give us are genuine.

Please back up and erase your data before handing an item over. We also wipe every device we receive, but we are not responsible for data left on it.

We report suspected stolen goods to the police. Once you accept our offer we pay you to the bank account you give us, normally within 48 hours. For a swap, the agreed trade-in value is taken off the price of the item you are buying.`,
    },
    {
      id: "returns",
      title: "Returns and warranty",
      body: `You can return an item that isn't as described or is faulty within **${plural(l.returnDays, "day")}** of delivery. Graded phones and gadgets come with a **${plural(l.warrantyDays, "day")} warranty**, and car buyers have **${plural(l.carInspectionDays, "day")}** to inspect before escrow is released. The full details are in our [Returns & Warranty policy](/returns).`,
    },
    {
      id: "conduct",
      title: "Acceptable use",
      body: `You agree not to:

- give false information, impersonate anyone, or use someone else's phone number or email;
- sell or try to sell stolen, counterfeit or illegal goods;
- try to pay outside our official channels to avoid escrow, or ask our staff to do so;
- interfere with the site's security, scrape it, or overload it;
- harass our staff, couriers or other customers.`,
    },
    {
      id: "liability",
      title: "Our responsibility to you",
      body: `We are responsible for loss you suffer that is a foreseeable result of our breaking these terms or failing to use reasonable care. We are not responsible for loss that was not foreseeable, for business losses, or for delays caused by events outside our reasonable control.

Our total liability for any order is limited to the amount you paid for it, except where the law does not allow us to limit liability, for example for death or personal injury caused by negligence, or for fraud.`,
    },
    {
      id: "disputes",
      title: "Complaints and disputes",
      body: `If something goes wrong, contact us first on WhatsApp, by phone on ${l.phone} or at ${mail(l.email)}. Most issues are resolved within a few days. See [how disputes work](/trust#disputes).

If we can't resolve it, either of us may refer the matter to mediation in Lagos before going to court, and you may also complain to the Federal Competition and Consumer Protection Commission (FCCPC). These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Lagos State have jurisdiction.`,
    },
    {
      id: "changes",
      title: "Changes to these terms",
      body: `We may update these terms from time to time. The version on this page when you place an order or accept a sell offer applies to that transaction.`,
    },
  ];
}

// -------------------------------------------------------------------- Returns

export const returnsIntro = (l: ResolvedLegal) =>
  `${plural(l.returnDays, "day")} to return items that aren't as described, a ${plural(l.warrantyDays, "day")} warranty on graded devices, and ${plural(l.carInspectionDays, "day")} to inspect a car before escrow is released.`;

export function returnsSections(l: ResolvedLegal): LegalSection[] {
  return [
    {
      id: "summary",
      title: "The short version",
      body: `- **Not as described or faulty?** Tell us within **${plural(l.returnDays, "day")}** of delivery for a repair, replacement or full refund.
- **Graded phones and gadgets** have a **${plural(l.warrantyDays, "day")} warranty** against functional faults.
- **Cars** have a **${plural(l.carInspectionDays, "day")} inspection period** before your payment is released from escrow.
- Your money stays in **escrow** until you confirm the item is right, so you're never out of pocket while we sort a problem.`,
    },
    {
      id: "phones-gadgets",
      title: "Returns: phones, gadgets and accessories",
      body: `When your order arrives, check that it matches its listing and grade. If it doesn't, or it has a fault that isn't covered by its grade, contact us within **${plural(l.returnDays, "day")}** of delivery. We'll arrange collection or ask you to drop it at a hub, inspect it, and then repair it, replace it or refund you in full, including the delivery fee.

To return an item it must be in the condition you received it, with its box and accessories if they were included, and with any iCloud, Google or other account and screen lock removed. We can't accept items that have been damaged, opened or repaired since delivery.

Because graded items are priced individually, we don't normally accept change-of-mind returns. Where an offer or listing says change-of-mind returns are allowed, that promise applies.`,
    },
    {
      id: "warranty",
      title: "Warranty on graded devices",
      body: `Graded phones, tablets, laptops and other gadgets bought from ${l.brand} come with a **${plural(l.warrantyDays, "day")} warranty** from the delivery date. If the device develops a functional fault in normal use, such as a failed screen, speaker, camera, charging port or network fault, we will repair it, replace it with an equivalent device, or refund you.

The warranty does not cover:

- cosmetic wear described by the item's grade;
- drops, cracks, liquid damage or other accidental damage;
- normal battery wear within the battery health shown on the listing;
- repairs, opening or modification by anyone other than us;
- software problems caused by third-party apps, jailbreaking or rooting;
- loss or theft.

New accessories carry the manufacturer's warranty where one applies.`,
    },
    {
      id: "cars",
      title: "Cars: inspection and acceptance",
      body: `Every car is graded and its VIN checked before listing. You're welcome to bring your own mechanic for a pre-purchase inspection.

After delivery or collection you have **${plural(l.carInspectionDays, "day")}** to inspect the car. If it isn't as described in the listing (for example an undisclosed mechanical fault, mileage that doesn't match, or a problem with its papers), tell us within that period and we'll fix the problem, offer a fair price adjustment, or take the car back and refund you from escrow.

Once the inspection period ends without a complaint, or you confirm acceptance, the payment is released and the car is sold as seen. Cars do not carry a warranty unless the listing says so. Wear and tear, and faults that appear after acceptance, are not covered. We will hand over the vehicle papers, customs documents and proof of ownership we hold.`,
    },
    {
      id: "swaps",
      title: "Swaps and trade-ins",
      body: `If you return an item you bought as part of a swap, we refund the cash you paid and credit back the agreed value of your trade-in. Traded-in devices are wiped and may be resold quickly, so we can't always return the original item; you'll receive its agreed value instead.`,
    },
    {
      id: "refunds",
      title: "Refunds",
      body: `Refunds go back the way you paid:

- **Card (Paystack):** to the same card, usually within 5–10 working days of our approval, depending on your bank.
- **Bank transfer:** to the account you paid from, usually within 2 working days of our approval.

If your payment is still in escrow, we simply release it back to you.`,
    },
    {
      id: "how-to",
      title: "How to start a return or claim",
      body: `Message us on WhatsApp or email ${mail(l.email)} with your order number, a description of the problem and, if you can, photos or a short video. You can also visit one of our hubs. We'll reply within one working day and keep your order in escrow while we sort it out.`,
    },
    {
      id: "your-rights",
      title: "Your legal rights",
      body: `This policy is in addition to your rights under the Federal Competition and Consumer Protection Act 2018, including the right to goods that are of satisfactory quality, fit for purpose and as described. Nothing here limits those rights.`,
    },
  ];
}

// -------------------------------------------------------------------- Cookies

export const cookiesIntro = (l: ResolvedLegal) =>
  `The small files and browser storage ${l.brand} uses, why, and how you control them. Analytics stays off unless you turn it on.`;

export function cookiesSections(l: ResolvedLegal, manage: ReactNode): LegalSection[] {
  return [
    {
      id: "what",
      title: "What cookies are",
      body: `Cookies are small text files a website saves in your browser. Similar technologies, such as your browser's local storage, work in the same way. We call them all "cookies" here.

Some are essential for the site to work. Others, like analytics, are optional and only used if you agree.`,
    },
    {
      id: "essential",
      title: "Essential cookies (always on)",
      body: `These are needed to provide the service you ask for, so they don't need your consent. They are first-party: only ${l.brand} can read them.

- **jd_customer:** keeps you signed in to your account for up to 30 days. Signed and secure.
- **jd_cart_v1 and jd_offer_v1** (local storage): remember your cart and any offer code you've applied.
- **jd_consent:** remembers your cookie choices, for up to 12 months.
- **jd_admin:** signs in our staff to the admin area. Never set for customers.`,
    },
    {
      id: "analytics",
      title: "Analytics cookies (optional)",
      body: `If you choose **Accept**, we use **PostHog** to understand how people use ${l.brand}: which products are viewed, where checkout gets stuck, and similar. PostHog sets cookies and local storage starting with "ph_" to recognise your browser between visits.

Analytics data is linked to an anonymous ID, or to your customer number if you're signed in. We don't send PostHog your name, phone number or email, and our admin pages are never tracked. We also honour your browser's "Do Not Track" setting.

Until you accept, PostHog does not capture anything or store anything in your browser, and we don't send order events about you to it from our servers.`,
    },
    {
      id: "monitoring",
      title: "Error monitoring",
      body: `We use **Sentry** to find and fix errors on the site. It does not set cookies. Before an error report is sent we remove phone numbers, email addresses, cookies and form contents from it.`,
    },
    {
      id: "third-party",
      title: "Third-party services",
      body: `When you pay by card, Paystack's payment page may set its own cookies to process the payment securely and prevent fraud. If you open WhatsApp from our site, WhatsApp's own policies apply. These are governed by their privacy policies, not ours.`,
    },
    {
      id: "manage",
      title: "Managing your choices",
      body: `You can change your mind at any time with the button below or the **Cookie settings** link at the bottom of every page. Turning analytics off stops collection straight away.

You can also block or delete cookies in your browser settings. If you block essential cookies you won't be able to sign in or keep items in your cart.`,
      extra: manage,
    },
    {
      id: "changes",
      title: "Changes",
      body: `If we start using a new type of optional cookie we will update this page and ask for your consent again. Read our [Privacy Policy](/privacy) for how we handle personal data generally.`,
    },
  ];
}
