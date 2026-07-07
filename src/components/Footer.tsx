import Logo from "./Logo";

function Office({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
        <span className="h-3 w-1 rounded-full bg-accent-500" />
        {label}
      </h3>
      <p className="text-sm leading-relaxed text-brand-100">{children}</p>
    </div>
  );
}

// Minimal inline social icons (no external requests).
function Social({ path, label }: { path: string; label: string }) {
  return (
    <a
      href="#"
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-accent-500"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d={path} />
      </svg>
    </a>
  );
}

const ICONS = {
  facebook:
    "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z",
  instagram:
    "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1C2.6 9.9 2.6 10.3 2.6 12s0 2.1.1 3.3c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-3.3s0-2.1-.1-3.3c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.3-.4-.4-.8-.6-1.3-.8-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2zm5.1-.3a1.1 1.1 0 1 1-2.3 0 1.1 1.1 0 0 1 2.3 0z",
  linkedin:
    "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.6h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H9z",
  x: "M18.9 2h3.3l-7.2 8.2L23.5 22h-6.6l-5.2-6.8L5.8 22H2.5l7.7-8.8L1.9 2h6.8l4.7 6.2zm-1.2 18h1.8L7.4 3.9H5.5z",
};

export default function Footer() {
  return (
    <footer className="mt-16 bg-brand-800 text-white">
      <div className="h-1 bg-gradient-to-r from-brand-600 via-accent-500 to-accent-500" />
      <div className="grid w-full gap-8 px-4 py-12 sm:px-6 lg:px-10 md:grid-cols-2 lg:grid-cols-4">
        {/* Brand + social */}
        <div className="space-y-4">
          <Logo onDark className="h-11 w-auto" />
          <p className="text-sm leading-relaxed text-brand-100">
            Crafting seamless journeys — everywhere. B2B travel, itineraries and
            contracted rates in one place.
          </p>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-200">
              Follow Our Social Media
            </p>
            <div className="flex gap-2">
              <Social path={ICONS.facebook} label="Facebook" />
              <Social path={ICONS.instagram} label="Instagram" />
              <Social path={ICONS.linkedin} label="LinkedIn" />
              <Social path={ICONS.x} label="X" />
            </div>
          </div>
        </div>

        {/* Corporate + North India */}
        <div className="space-y-6">
          <Office label="Corporate Office">
            BSI Business Park, Suite no 107, H block H161, Noida Sector 63, Pin
            code 201301
          </Office>
          <Office label="North India Office">
            E-4, Nemi Krishna, Kandivali (W) Mumbai 400067
          </Office>
        </div>

        {/* Global office */}
        <div className="space-y-6">
          <Office label="Global Office">
            Office No. 105-25, Owned by Salem Ahmed Abdullah Bin Dasmal Al
            Suwaidi — Al Quoz Industrial 1 – P.O. BOX 364595
          </Office>
        </div>

        {/* Contact */}
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <span className="h-3 w-1 rounded-full bg-accent-500" />
              Email Address
            </h3>
            <a
              href="mailto:Query@andeverywhere.co"
              className="text-sm text-brand-100 hover:text-white"
            >
              Query@andeverywhere.co
            </a>
          </div>
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <span className="h-3 w-1 rounded-full bg-accent-500" />
              Phone
            </h3>
            <a
              href="tel:+919820033423"
              className="text-sm text-brand-100 hover:text-white"
            >
              +91 98200 33423
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="flex w-full flex-col items-center justify-between gap-2 px-4 py-4 sm:px-6 lg:px-10 text-xs text-brand-200 sm:flex-row">
          <span>
            © {2026} Andeverywhere. All rights reserved.
          </span>
          <span>Query@andeverywhere.co · +91 98200 33423</span>
        </div>
      </div>
    </footer>
  );
}
