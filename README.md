# n8n-nodes-ashdocs

An [n8n](https://n8n.io) community node for [ASHDOCS](https://www.ashdocs.com): create, send and look up
invoices, manage customers, generate and redact PDFs, and start workflows when an invoice is sent,
viewed, paid or becomes overdue.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) ·
[Trigger](#trigger) · [Example workflows](#example-workflows) · [ASHDOCS docs](https://www.ashdocs.com/docs)

## Installation

In n8n, go to **Settings → Community Nodes → Install**, enter `n8n-nodes-ashdocs`, accept the risk
notice, and select **Install**. Only the instance owner or an admin can install community nodes.
See the n8n guide: [Install community nodes from the GUI](https://docs.n8n.io/integrations/community-nodes/installation/gui-install/).

## Credentials

The **ASHDOCS API** credential takes an API key, which the node sends in the `X-API-Key` header.

1. Sign in to the ASHDOCS dashboard and open the **API Keys** page.
2. Create a key and copy it.
3. In n8n, create an **ASHDOCS API** credential and paste the key into **API Key**. Leave **Base URL**
   as `https://api.ashdocs.com`.
4. Select **Save**. n8n tests the key against `GET /api/v1/keys/verify`.

Test keys (`ash_test_…`) create watermarked test invoices and use no credits. Live keys (`ash_live_…`)
create real invoices.

## Operations

**ASHDOCS** node

- **Invoice → Create**: creates an invoice from customer details or a saved customer ID and line items, and can issue it and email it to the customer.
- **Invoice → Send**: emails an issued invoice, with optional To, CC, subject and message.
- **Invoice → Get**: gets one invoice by ID or by invoice number.
- **Invoice → Get Many**: lists invoices, filtered by status, customer email, search text, and issue or due dates.
- **Customer → Create**: creates a customer; for an email that already exists it returns that customer or fails, as you choose.
- **Customer → Find by Email**: returns the customer with that email, or no items.
- **Customer → Get**: gets one customer by ID.
- **Document → Generate PDF**: renders HTML or a web page URL to PDF and returns a download link, optionally with the file as binary data.
- **Document → Redact**: blacks out emails, US Social Security numbers, card numbers, phone numbers, IBANs or dates in a PDF.

Invoice Get and Get Many have a **Simplify** option, on by default, that returns ten flat fields (`id`,
`number`, `status`, `customer_name`, `customer_email`, `total`, `balance_due`, `due_date`,
`hosted_url`, `pdf_url`). Turn it off to get the full invoice.

## Trigger

**ASHDOCS Trigger** node

- **Invoice Sent**: an invoice was delivered to the customer.
- **Invoice Viewed**: the customer opened the hosted invoice page.
- **Invoice Paid**: an invoice was paid in full.
- **Invoice Overdue**: an invoice passed its due date with a balance left.

The trigger creates an ASHDOCS webhook when the workflow is activated and deletes it when the
workflow is deactivated. It checks the `X-ASHDOCS-Signature` header of each delivery. Each item is the
invoice plus `event`, `event_id`, `occurred_at` and `delivered_at`. Webhooks are available on ASHDOCS
plans that include them.

## Example workflows

Eight ready-to-import workflows in [`examples/`](examples/). Each opens with pinned sample data (the
fictional customer Northwind Studio), so **Test workflow** shows what it does before you connect
anything, and each has Overview, Setup and Customize sticky notes on the canvas.

| File | What it does | Also uses | ASHDOCS plan |
|---|---|---|---|
| [`sheets-to-invoice.json`](examples/sheets-to-invoice.json) | Create and email invoices from new Google Sheets rows | Google Sheets | Free |
| [`overdue-reminders.json`](examples/overdue-reminders.json) | Send escalating overdue invoice reminders (Gmail, Slack, a Google Sheets log) | Gmail, Google Sheets, Slack | Free (optional instant branch: Starter+) |
| [`paid-to-sheets.json`](examples/paid-to-sheets.json) | Mark Google Sheets rows paid and notify Slack when an invoice is paid | Google Sheets, Slack | Starter+ |
| [`airtable-to-invoice.json`](examples/airtable-to-invoice.json) | Create, send and track invoices from Airtable records | Airtable | Free (Paid part: Starter+) |
| [`hubspot-deal-won-deposit.json`](examples/hubspot-deal-won-deposit.json) | Create a deposit invoice when a HubSpot deal is won | HubSpot | Free |
| [`retainer-from-hours.json`](examples/retainer-from-hours.json) | Generate monthly retainer invoices from Toggl Track time entries | Toggl Track, Google Sheets | Free |
| [`stripe-receipt-pdf.json`](examples/stripe-receipt-pdf.json) | Email a branded PDF receipt after a Stripe payment (Generate PDF) | Stripe, Gmail | Free |
| [`viewed-not-paid.json`](examples/viewed-not-paid.json) | Follow up personally when an invoice is viewed but unpaid after 3 days | Gmail | Starter+ |

Free plan: creating and sending invoices (100 credits a month). Starter and up: the invoice webhooks
the ASHDOCS Trigger uses (sent, viewed, paid, overdue).

1. Download a file, then in n8n open a new workflow and use **⋯ → Import from File** (or paste the JSON).
2. Open each node with a warning and select your own credentials. The files reference credentials by
   name only (**ASHDOCS API**, **Google Sheets account**, **Gmail account**, …) and contain no keys.
3. Follow the blue **Setup** note on the canvas; run it first with a test API key.


## Compatibility

Built with `@n8n/node-cli` 0.51 and checked on n8n 2.42.

## Resources

- [ASHDOCS documentation](https://www.ashdocs.com/docs)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE)
