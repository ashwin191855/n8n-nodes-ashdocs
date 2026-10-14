# Changelog

## 1.0.1

- Fix: API error messages reach the user again. On n8n 2.x the request helper already throws a
  `NodeApiError`, and wrapping it again kept n8n's generic text ("Your request is invalid or could not
  be processed by the service"). The ASHDOCS message and field errors (for example
  `line_items.0.unit_price: Input should be a valid decimal`) are now set on the error itself, read from
  wherever the n8n version puts the response body.
- With **Continue on Fail**, a failed item now also carries `error_description` (the field errors) next
  to `error`.

## 1.0.0

First public release.

- ASHDOCS node:
  - Invoice: Create, Send, Get (by ID or number), Get Many (filters for status, customer email, search
    text, issue and due dates). Get and Get Many have a Simplify option (on by default) that returns ten
    flat fields; turn it off for the full invoice.
  - Customer: Create (returns the existing customer for a known email, or fails, as you choose), Find by
    Email, Get.
  - Document: Generate PDF (from HTML or a web page URL), Redact (emails, US Social Security numbers,
    card numbers, phone numbers, IBANs, dates). Both return an absolute `file_url` and can attach the
    PDF as binary data.
- ASHDOCS Trigger node: Invoice Sent, Invoice Viewed, Invoice Paid and Invoice Overdue. Subscribes on
  activation, unsubscribes on deactivation, and checks the `X-ASHDOCS-Signature` of each delivery.
- ASHDOCS API credential (API key, sent as `X-API-Key`) with a connection test.
