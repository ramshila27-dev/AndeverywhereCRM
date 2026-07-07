// Central company profile used across the app and on client-facing documents
// (the PDF quotation header, bank details, and footer).
//
// NOTE: bank details below are placeholders — replace with the real values.

export const COMPANY = {
  name: "Andeverywhere",
  tagline: "Crafting seamless journeys — everywhere.",
  email: "Query@andeverywhere.co",
  phone: "+91 98200 33423",
  website: "andeverywhere.co",

  offices: [
    {
      label: "Corporate Office",
      lines: [
        "BSI Business Park, Suite no 107, H block H161,",
        "Noida Sector 63, Pin code 201301",
      ],
    },
    {
      label: "North India Office",
      lines: ["E-4, Nemi Krishna, Kandivali (W)", "Mumbai 400067"],
    },
    {
      label: "Global Office",
      lines: [
        "Office No. 105-25, Al Quoz Industrial 1,",
        "P.O. BOX 364595, Dubai, UAE",
      ],
    },
  ],

  // Replace these with your real bank details.
  bank: {
    accountName: "Andeverywhere",
    bankName: "— add bank name —",
    accountNumber: "— add account number —",
    ifsc: "— add IFSC —",
    branch: "— add branch —",
    swift: "— add SWIFT/BIC (for international) —",
  },
} as const;
