import fs from "fs";
import path from "path";
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { formatMoney } from "@/lib/pricing";
import type { QuoteDayPlan, QuoteItem, QuoteItemKind } from "@/lib/types";

const NAVY = "#1b2857";
const NAVY2 = "#2b3f89";
const RED = "#e11d2a";
const INK = "#1f2937";
const MUTE = "#6b7280";
const LINE = "#e5e7eb";
const SOFT = "#f4f6fb";

// The company logo is the only image on this document now (per-item photos
// were removed from the Rates section and are no longer shown here either).
function fileToDataUri(rel: string): string | null {
  try {
    const p = path.join(process.cwd(), "public", rel.replace(/^\//, ""));
    const buf = fs.readFileSync(p);
    const ext = path.extname(p).slice(1) || "png";
    return `data:image/${ext};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------

// The standard PDF font (WinAnsi) lacks some Unicode glyphs (e.g. "→").
// Normalize those to supported equivalents so text always renders cleanly.
function clean(t?: string): string {
  return (t || "")
    .replace(/\s*→\s*/g, " to ")
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"');
}

const KIND_LABEL: Record<QuoteItemKind, string> = {
  hotel: "Accommodation",
  transfer: "Transfers",
  activity: "Activities & Tickets",
  guide: "Guide",
  other: "Other Services",
  charge: "Additional Charges",
};
// Shorter labels for the day-wise table (matches how the person referred to
// them: "Accommodation:", "Transfer:", "Activities:").
const DAY_KIND_LABEL: Record<QuoteItemKind, string> = {
  hotel: "Accommodation:",
  transfer: "Transfer:",
  activity: "Activities:",
  guide: "Guide:",
  other: "Other Services:",
  charge: "Additional Charges:",
};
const KIND_ORDER: QuoteItemKind[] = ["hotel", "transfer", "activity", "guide", "other", "charge"];

export interface PdfQuoteInput {
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

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 70, paddingHorizontal: 34, fontSize: 9.5, color: INK, fontFamily: "Helvetica" },
  accentBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: RED },

  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10 },
  logo: { height: 34, objectFit: "contain" },
  headRight: { textAlign: "right", maxWidth: 250 },
  coName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  coLine: { fontSize: 8, color: MUTE, marginTop: 1 },

  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16, borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 6 },
  quoteTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1 },
  quoteRef: { fontSize: 9, color: MUTE },

  metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, backgroundColor: SOFT, borderRadius: 4, padding: 10 },
  metaCell: { width: "33%", marginBottom: 6 },
  metaLabel: { fontSize: 7.5, color: MUTE, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 10, color: INK, marginTop: 1, fontFamily: "Helvetica-Bold" },

  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 16, marginBottom: 6 },
  sectionBar: { width: 3, height: 11, backgroundColor: RED, marginRight: 5 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 6 },

  dayBox: { borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 8, marginBottom: 6 },
  dayTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 3 },
  dayItemRow: { flexDirection: "row", marginBottom: 2.5, alignItems: "flex-start" },
  dayItemKind: { width: 82, fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY },
  dayItemLabel: { fontSize: 8.5, color: INK, flex: 1 },

  item: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 7, marginBottom: 6 },
  itemBody: { flex: 1 },
  itemLabel: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: INK },
  itemDetail: { fontSize: 8.5, color: MUTE, marginTop: 2 },

  perPaxRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  priceSummaryBox: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10, marginTop: 4, marginBottom: 6 },
  perPaxBox: { borderWidth: 1, borderColor: LINE, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 10 },
  perPaxLabel: { fontSize: 7.5, color: MUTE, textTransform: "uppercase" },
  perPaxValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 1 },

  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  totalBox: { backgroundColor: NAVY, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" },
  totalLabel: { color: "#c7d0ea", fontSize: 9, marginRight: 14 },
  totalValue: { color: "#ffffff", fontSize: 15, fontFamily: "Helvetica-Bold" },

  twoCol: { flexDirection: "row", marginTop: 18, gap: 14 },
  panel: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 10 },
  panelTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 6 },
  kv: { flexDirection: "row", marginBottom: 3 },
  kvK: { width: 82, fontSize: 8.5, color: MUTE },
  kvV: { flex: 1, fontSize: 8.5, color: INK, fontFamily: "Helvetica-Bold" },

  note: { fontSize: 7.5, color: MUTE, marginTop: 10, lineHeight: 1.4 },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: NAVY, paddingVertical: 10, paddingHorizontal: 34 },
  footRow: { flexDirection: "row", justifyContent: "space-between" },
  footCol: { width: "31%" },
  footLabel: { color: RED, fontSize: 7.5, fontFamily: "Helvetica-Bold", marginBottom: 2, textTransform: "uppercase" },
  footText: { color: "#dbe1f2", fontSize: 7.5, lineHeight: 1.35 },
  footBottom: { color: "#9fb0d8", fontSize: 7, marginTop: 8, textAlign: "center" },
});

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaCell}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value || "—"}</Text>
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvK}>{k}</Text>
      <Text style={s.kvV}>{v}</Text>
    </View>
  );
}

function QuoteDocument({
  q,
  items,
  logo,
}: {
  q: PdfQuoteInput;
  items: QuoteItem[];
  logo: string | null;
}) {
  const cur = q.currency;
  return (
    <Document title={`Quotation ${q.reference}`} author={COMPANY.name}>
      <Page size="A4" style={s.page}>
        <View style={s.accentBar} fixed />

        {/* Header */}
        <View style={s.headRow}>
          {logo ? <Image src={logo} style={s.logo} /> : <Text style={s.coName}>{COMPANY.name}</Text>}
          <View style={s.headRight}>
            <Text style={s.coName}>{COMPANY.name}</Text>
            <Text style={s.coLine}>{COMPANY.offices[0].lines.join(" ")}</Text>
            <Text style={s.coLine}>
              {COMPANY.email} · {COMPANY.phone}
            </Text>
            <Text style={s.coLine}>{COMPANY.website}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={s.titleRow}>
          <Text style={s.quoteTitle}>QUOTATION</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.quoteRef}>Ref: {q.reference}</Text>
            <Text style={s.quoteRef}>Date: {q.dateStr}</Text>
          </View>
        </View>

        {/* Meta */}
        <View style={s.metaRow}>
          <Meta label="Prepared for" value={q.guestName || q.title} />
          <Meta label="Destination" value={q.city} />
          <Meta label="Travel dates" value={q.dateRange} />
          <Meta label="Guests" value={q.pax} />
          <Meta label="Prepared by" value={q.salesTeam || "Andeverywhere"} />
          <Meta label="Status" value={q.status} />
        </View>

        {/* Day-wise itinerary */}
        {q.days && q.days.length > 0 && (
          <View wrap={false}>
            <View style={s.sectionTitleRow}>
              <View style={s.sectionBar} />
              <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY }}>
                Day-wise Itinerary
              </Text>
            </View>
            {q.days.map((day) => {
              // Group same-kind items into one table row per category, per
              // the requested "Accommodation: / Transfer: / Activities:"
              // layout, rather than one badge per item.
              const byKind = KIND_ORDER.map((kind) => ({
                kind,
                labels: day.items.filter((it) => it.kind === kind).map((it) => clean(it.label)),
              })).filter((g) => g.labels.length > 0);
              return (
                <View key={day.date} style={s.dayBox} wrap={false}>
                  <Text style={s.dayTitle}>Day {day.dayNumber} — {day.date}</Text>
                  {byKind.length === 0 ? (
                    <Text style={{ fontSize: 8, color: MUTE }}>No services scheduled this day.</Text>
                  ) : (
                    byKind.map((g) => (
                      <View key={g.kind} style={s.dayItemRow}>
                        <Text style={s.dayItemKind}>{DAY_KIND_LABEL[g.kind]}</Text>
                        <Text style={s.dayItemLabel}>{g.labels.join("; ")}</Text>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Price Summary — its own section, wrapped so it can never be split
            across a page break (that's what caused the Total to land on a
            separate page from the per-pax boxes). */}
        <View style={s.priceSummaryBox} wrap={false}>
          <View style={s.sectionTitleRow}>
            <View style={s.sectionBar} />
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY }}>
              Price Summary
            </Text>
          </View>

          <View style={s.perPaxRow}>
            <View style={s.perPaxBox}>
              <Text style={s.perPaxLabel}>Per Adult ({q.adults} pax)</Text>
              <Text style={s.perPaxValue}>{formatMoney(q.perAdultPrice, cur)}</Text>
            </View>
            {q.perChildPrice != null && (
              <View style={s.perPaxBox}>
                <Text style={s.perPaxLabel}>Per Child ({q.children} pax)</Text>
                <Text style={s.perPaxValue}>{formatMoney(q.perChildPrice, cur)}</Text>
              </View>
            )}
          </View>

          <View style={s.totalRow}>
            <View style={s.totalBox}>
              <Text style={s.totalLabel}>TOTAL ({cur}, net)</Text>
              <Text style={s.totalValue}>{formatMoney(q.total, cur)}</Text>
            </View>
          </View>
        </View>

        {/* Item sections (Hotels, Transport, Activities, Guide, Other Services, Charges) */}
        {KIND_ORDER.map((kind) => {
          const group = items.filter((it) => it.kind === kind);
          if (!group.length) return null;
          return (
            <View key={kind} wrap={false}>
              <View style={s.sectionTitleRow}>
                <View style={s.sectionBar} />
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY }}>
                  {KIND_LABEL[kind]}
                </Text>
              </View>
              {group.map((it, i) => (
                <View key={i} style={s.item} wrap={false}>
                  <View style={s.itemBody}>
                    <Text style={s.itemLabel}>{clean(it.label)}</Text>
                    {it.detail ? <Text style={s.itemDetail}>{clean(it.detail)}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          );
        })}

        {/* Bank details + terms */}
        <View style={s.twoCol}>
          <View style={s.panel}>
            <Text style={s.panelTitle}>Bank Details</Text>
            <KV k="Account Name" v={COMPANY.bank.accountName} />
            <KV k="Bank" v={COMPANY.bank.bankName} />
            <KV k="Account No." v={COMPANY.bank.accountNumber} />
            <KV k="IFSC" v={COMPANY.bank.ifsc} />
            <KV k="Branch" v={COMPANY.bank.branch} />
            <KV k="SWIFT/BIC" v={COMPANY.bank.swift} />
          </View>
          <View style={s.panel}>
            <Text style={s.panelTitle}>Terms</Text>
            <Text style={s.note}>
              • Rates are net and quoted in {cur}.{"\n"}
              • Prices are subject to availability at the time of confirmation.
              {"\n"}• A valid confirmation requires an advance as per company
              policy.{"\n"}• This quotation is valid for 7 days from the date
              above.
            </Text>
          </View>
        </View>

        <Text style={s.note}>
          Thank you for choosing {COMPANY.name}. For any assistance regarding
          this quotation, reach us at {COMPANY.email} or {COMPANY.phone}.
        </Text>

        {/* Footer with offices */}
        <View style={s.footer} fixed>
          <View style={s.footRow}>
            {COMPANY.offices.map((o) => (
              <View key={o.label} style={s.footCol}>
                <Text style={s.footLabel}>{o.label}</Text>
                <Text style={s.footText}>{o.lines.join(" ")}</Text>
              </View>
            ))}
          </View>
          <Text style={s.footBottom}>
            {COMPANY.name} · {COMPANY.email} · {COMPANY.phone} · {COMPANY.website}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(q: PdfQuoteInput): Promise<Buffer> {
  const logo = fileToDataUri("/andeverywhere-logo-dark.png");
  return renderToBuffer(<QuoteDocument q={q} items={q.items} logo={logo} />);
}
