import { getCurrentCustomer } from "@/lib/customer-auth";
import { customerOrders, listDataRequests } from "@/lib/legal-store";
import { listOrders, logAudit, rateLimit } from "@/lib/store";

// "Download my data" (NDPA rights of access and portability): a JSON copy of the
// signed-in customer's profile, orders and privacy requests.

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return Response.json({ error: "Sign in to download your data." }, { status: 401 });
  if (!(await rateLimit(`dsr-export:${customer.id}`, 10, 3600))) {
    return Response.json({ error: "Too many downloads. Please try again in an hour." }, { status: 429 });
  }

  const [orders, requests] = await Promise.all([listOrders(), listDataRequests()]);
  const mine = customerOrders(customer, orders);
  const body = {
    exportedAt: new Date().toISOString(),
    about: "Your personal data held by JDHub, provided under the Nigeria Data Protection Act 2023. Payment card details are held by Paystack, not JDHub.",
    profile: customer,
    // The order link token is a secret, not personal data.
    orders: mine.map((o) => ({ ...o, token: undefined })),
    privacyRequests: requests
      .filter((r) => r.customerId === customer.id)
      .map((r) => ({ id: r.id, type: r.type, status: r.status, message: r.message, createdAt: r.createdAt, updatedAt: r.updatedAt })),
  };

  await logAudit({ by: `Customer ${customer.id}`, action: "privacy.export", target: customer.id, detail: `${mine.length} orders` }).catch(() => undefined);

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="jdhub-my-data-${customer.id.toLowerCase()}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
