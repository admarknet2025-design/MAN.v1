# Join MAN form: Google Forms setup

Moved out of the public JavaScript (it contained the review sheet URL and notification email). The live form code is in `assets/app.js` ("Join MAN community form").

```js
    // ── JOIN MAN FORM — Google Forms backend ─────────────────
    //
    // SETUP (one-time, ~10 minutes):
    //
    // 1. Create a Google Form at forms.google.com with these 7 fields
    //    (Short answer unless noted):
    //      • Full Name
    //      • Email Address
    //      • WhatsApp Number
    //      • Current Role / Title
    //      • Company / Organisation
    //      • Years in Marketing  (Dropdown: <1yr / 1-3 / 3-5 / 5-10 / 10+)
    //      • What brings you to MAN?  (Paragraph)
    //
    // 2. Open the form, click the 3-dot menu → "Get pre-filled link"
    //    Fill in dummy text in every field, click "Get link", copy it.
    //    The link shows the entry IDs: entry.1234567890=dummy
    //    Copy each entry.XXXXXXXXXX number below.
    //
    // 3. Your form's POST URL is:
    //    https://docs.google.com/forms/d/e/YOUR_LONG_FORM_ID/formResponse
    //    (find YOUR_LONG_FORM_ID in the share link of the form)
    //
    // 4. In the linked Google Sheet → Extensions → Apps Script → paste
    //    the notification script (see comment block at bottom of this file).
    //
    // Replace the placeholder values below:

/*
    ════════════════════════════════════════════════════════════
    APPS SCRIPT — paste this into the Google Sheet linked to
    your Google Form (Extensions → Apps Script → replace
    everything → Save → set trigger: onFormSubmit / From form)
    ════════════════════════════════════════════════════════════

    function onFormSubmit(e) {
      var r = e.namedValues;
      var msg =
        "New MAN Community Application\n\n" +
        "Name:       " + r["Full Name"] + "\n" +
        "Email:      " + r["Email Address"] + "\n" +
        "WhatsApp:   " + r["WhatsApp Number"] + "\n" +
        "Role:       " + r["Current Role / Title"] + "\n" +
        "Company:    " + r["Company / Organisation"] + "\n" +
        "Experience: " + r["Years in Marketing"] + "\n\n" +
        "Why MAN:\n" + r["What brings you to MAN?"] + "\n\n" +
        "Review in Sheet: https://docs.google.com/spreadsheets/d/1oaN8BGlGksI3LmHs9Qz9cihkWsNTwjh7i7ABFeXgwTI";

      MailApp.sendEmail({
        to: "admarknet2025@gmail.com",
        subject: "MAN Application — " + r["Full Name"],
        body: msg
      });
    }

    ════════════════════════════════════════════════════════════
    */
```
