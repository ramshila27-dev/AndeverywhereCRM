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
import type { QuoteItem, QuoteItemKind } from "@/lib/types";

const NAVY = "#1b2857";
const RED = "#e11d2a";
const INK = "#1f2937";
const MUTE = "#6b7280";
const LINE = "#e5e7eb";
const SOFT = "#f4f6fb";

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
const KIND_ORDER: QuoteItemKind[] = ["hotel", "transfer", "activity", "guide", "other", "charge"];

export interface PdfInvoiceInput {
  reference: string;
  title: string;
  city: string;
  dateRange: string;
  pax: string;
  currency: string;
  total: number;
  billTo: string;
  guestName?: string;
  salesTeam?: string;
  dateStr: string;
  dueDateStr?: string;
  items: QuoteItem[];
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
  docTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1 },
  docRef: { fontSize: 9, color: MUTE },
  billRow: { flexDirection: "row", marginTop: 14, gap: 14 },
  billPanel: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 10 },
  billTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 4, textTransform: "uppercase" },
  billText: { fontSize: 9, color: INK, lineHeight: 1.4 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, backgroundColor: SOFT, borderRadius: 4, padding: 10 },
  metaCell: { width: "33%", marginBottom: 6 },
  metaLabel: { fontSize: 7.5, color: MUTE, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 10, color: INK, marginTop: 1, fontFamily: "Helvetica-Bold" },
  sectionBar: { width: 3, height: 11, backgroundColor: RED, marginRight: 5 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 6 },
  item: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: LINE, borderRadius: 5, padding: 7, marginBottom: 6 },
  itemBody: { flex: 1 },
  itemLabel: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: INK },
  itemDetail: { fontSize: 8.5, color: MUTE, marginTop: 2 },
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

function InvoiceDocument({ q, logo }: { q: PdfInvoiceInput; logo: string | null }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.accentBar} fixed />

        <View style={s.headRow}>
          {logo ? <Image src={logo} style={s.logo} /> : <Text style={s.coName}>{COMPANY.name}</Text>}
          <View style={s.headRight}>
            <Text style={s.coName}>{COMPANY.name}</Text>
            <Text style={s.coLine}>{COMPANY.offices[0].lines.join(" ")}</Text>
            <Text style={s.coLine}>{COMPANY.email} · {COMPANY.phone}</Text>
            <Text style={s.coLine}>{COMPANY.website}</Text>
          </View>
        </View>

        <View style={s.titleRow}>
          <Text style={s.docTitle}>INVOICE</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.docRef}>Invoice No: {q.reference}</Text>
            <Text style={s.docRef}>Date: {q.dateStr}</Text>
            {q.dueDateStr && <Text style={s.docRef}>Due: {q.dueDateStr}</Text>}
          </View>
        </View>

        <View style={s.billRow}>
          <View style={s.billPanel}>
            <Text style={s.billTitle}>Bill To</Text>
            <Text style={s.billText}>{q.billTo}</Text>
          </View>
        </View>

        <View style={s.metaRow}>
          <Meta label="Guest" value={q.guestName || q.title} />
          <Meta label="Destination" value={q.city} />
          <Meta label="Travel dates" value={q.dateRange} />
          <Meta label="Guests" value={q.pax} />
          <Meta label="Prepared by" value={q.salesTeam || "Andeverywhere"} />
        </View>

        {KIND_ORDER.map((kind) => {
          const group = q.items.filter((it) => it.kind === kind);
          if (!group.length) return null;
          return (
            <View key={kind} wrap={false}>
              <View style={s.sectionTitleRow}>
                <View style={s.sectionBar} />
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY }}>{KIND_LABEL[kind]}</Text>
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

        <View style={s.totalRow}>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>AMOUNT DUE ({q.currency})</Text>
            <Text style={s.totalValue}>{formatMoney(q.total, q.currency)}</Text>
          </View>
        </View>

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
            <Text style={s.panelTitle}>Payment Terms</Text>
            <Text style={s.note}>
              • Amount is payable in {q.currency}.{"\n"}
              • Please reference the invoice number above with your payment.{"\n"}
              • Contact us promptly with any billing questions.
            </Text>
          </View>
        </View>

        <Text style={s.note}>
          Thank you for your business with {COMPANY.name}. For billing queries, reach us at {COMPANY.email} or {COMPANY.phone}.
        </Text>

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

export async function renderInvoicePdf(q: PdfInvoiceInput): Promise<Buffer> {
  const logo = fileToDataUri("/andeverywhere-logo-dark.png");
  return renderToBuffer(<InvoiceDocument q={q} logo={logo} />);
}
