import QueryForm from "@/components/QueryForm";

export const dynamic = "force-dynamic";

export default function NewQueryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Query</h1>
        <p className="text-sm text-slate-500">
          Capture a travel enquiry to start the sales pipeline.
        </p>
      </div>
      <QueryForm />
    </div>
  );
}
