# Changelog

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
