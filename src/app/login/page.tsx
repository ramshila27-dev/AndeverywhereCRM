import Image from "next/image";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-brand-900 p-12 text-white lg:flex">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent-500 to-brand-500" />
        <Image
          src="/andeverywhere-logo.png"
          alt="Andeverywhere"
          width={220}
          height={64}
          className="h-16 w-auto object-contain"
          priority
        />
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            Crafting seamless journeys — everywhere.
          </h1>
          <p className="mt-4 max-w-md text-brand-200">
            B2B travel enquiries, quotations and itineraries with your
            contracted rates, all in one workspace.
          </p>
        </div>
        <p className="text-sm text-brand-300">
          © 2026 Andeverywhere. All rights reserved.
        </p>
      </div>

      {/* Login form */}
      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Image
              src="/andeverywhere-logo-dark.png"
              alt="Andeverywhere"
              width={200}
              height={56}
              className="h-14 w-auto object-contain"
              priority
            />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use the credentials provided by your administrator.
          </p>
          <div className="mt-6">
            <LoginForm next={searchParams.next} />
          </div>
        </div>
      </div>
    </div>
  );
}
