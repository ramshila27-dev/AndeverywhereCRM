import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";
import { formatMoney } from "@/lib/pricing";
import { COMPANY } from "@/lib/company";
import type { QuoteDayPlan, QuoteItem, QuoteItemKind } from "@/lib/types";

const KIND_LABEL: Record<QuoteItemKind, string> = {
  hotel: "Accommodation",
  transfer: "Transfers",
  activity: "Activities & Tickets",
  guide: "Guide",
  other: "Other Services",
  charge: "Additional Charges",
};
const DAY_KIND_LABEL: Record<QuoteItemKind, string> = {
  hotel: "Accommodation:",
  transfer: "Transfer:",
  activity: "Activities:",
  guide: "Guide:",
  other: "Other Services:",
  charge: "Additional Charges:",
};
const KIND_ORDER: QuoteItemKind[] = ["hotel", "transfer", "activity", "guide", "other", "charge"];

export interface WordQuoteInput {
  reference: string;
  title: string;
  city: string;
  dateRange: string;
  pax: string;
  adults: number;
  children: number;
  status: string;
  currency: string;
  total: number;
  perAdultPrice: number;
  perChildPrice: number | null;
  guestName?: string;
  salesTeam?: string;
  dateStr: string;
  items: QuoteItem[];
  days?: QuoteDayPlan[];
}

function metaCell(label: string, value: string) {
  return new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: [
      new Paragraph({ children: [new TextRun({ text: label.toUpperCase(), size: 14, color: "6b7280" })] }),
      new Paragraph({ children: [new TextRun({ text: value || "—", bold: true, size: 20 })] }),
    ],
  });
}

export async function renderQuoteWord(q: WordQuoteInput): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: COMPANY.name, bold: true, size: 28, color: "1b2857" })] }),
    new Paragraph({ children: [new TextRun({ text: `${COMPANY.email} · ${COMPANY.phone} · ${COMPANY.website}`, size: 18, color: "6b7280" })], spacing: { after: 200 } }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "QUOTATION", bold: true, color: "1b2857" })] }),
    new Paragraph({ children: [new TextRun({ text: `Ref: ${q.reference}   Date: ${q.dateStr}`, size: 18, color: "6b7280" })], spacing: { after: 200 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [metaCell("Prepared for", q.guestName || q.title), metaCell("Destination", q.city), metaCell("Travel dates", q.dateRange)] }),
        new TableRow({ children: [metaCell("Guests", q.pax), metaCell("Prepared by", q.salesTeam || "Andeverywhere"), metaCell("Status", q.status)] }),
      ],
    }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
  ];

  if (q.days && q.days.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "Day-wise Itinerary", bold: true, color: "1b2857" })],
        spacing: { before: 100, after: 100 },
      }),
    );
    for (const day of q.days) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Day ${day.dayNumber} — ${day.date}`, bold: true, size: 20 })],
          spacing: { before: 100 },
        }),
      );
      if (day.items.length === 0) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: "No services scheduled this day.", size: 16, color: "6b7280", italics: true })] }),
        );
      } else {
        for (const kind of KIND_ORDER) {
          const labels = day.items.filter((it) => it.kind === kind).map((it) => it.label);
          if (labels.length === 0) continue;
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: DAY_KIND_LABEL[kind] + " ", bold: true, size: 18 }),
                new TextRun({ text: labels.join("; "), size: 18 }),
              ],
            }),
          );
        }
      }
    }
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  }

  children.push(
    new Paragraph({ text: "", spacing: { before: 100 } }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: `Per Adult (${q.adults} pax):  `, size: 18, color: "6b7280" }),
        new TextRun({ text: formatMoney(q.perAdultPrice, q.currency), bold: true, size: 20, color: "1b2857" }),
      ],
      spacing: { after: 60 },
    }),
    ...(q.perChildPrice != null
      ? [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: `Per Child (${q.children} pax):  `, size: 18, color: "6b7280" }),
              new TextRun({ text: formatMoney(q.perChildPrice, q.currency), bold: true, size: 20, color: "1b2857" }),
            ],
            spacing: { after: 60 },
          }),
        ]
      : []),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: `TOTAL (${q.currency}, net):  `, size: 22, color: "6b7280" }),
        new TextRun({ text: formatMoney(q.total, q.currency), bold: true, size: 28, color: "1b2857" }),
      ],
      spacing: { after: 200 },
    }),
  );

  for (const kind of KIND_ORDER) {
    const group = q.items.filter((it) => it.kind === kind);
    if (!group.length) continue;
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: KIND_LABEL[kind], bold: true, color: "1b2857" })],
        spacing: { before: 200, after: 100 },
      }),
    );
    for (const it of group) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: it.label, bold: true })] }),
      );
      if (it.detail) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: it.detail, size: 18, color: "6b7280" })], spacing: { after: 100 } }),
        );
      }
    }
  }

  children.push(
    new Paragraph({ text: "", spacing: { before: 100 } }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            "Rates are net and quoted in the currency shown above. Prices are subject to availability at the time of " +
            "confirmation. A valid confirmation requires an advance as per company policy. This quotation is valid for " +
            "7 days from the date above.",
          size: 16,
          color: "6b7280",
          italics: true,
        }),
      ],
    }),
  );

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
