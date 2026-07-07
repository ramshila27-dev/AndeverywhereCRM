import { requireUser } from "@/lib/auth";
import PasswordForm from "@/components/PasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">
        {user.mustChangePassword ? "Set your password" : "Change password"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {user.mustChangePassword
          ? "Before you continue, please choose a new password for your account."
          : "Update the password you use to sign in."}
      </p>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <PasswordForm forced={user.mustChangePassword} />
      </div>
    </div>
  );
}
