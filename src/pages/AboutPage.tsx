export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={import.meta.env.VITE_SERVICES_BG || '/autonomy-2.png'}
            alt="LiDAR scanning background"
            className="w-full h-full object-cover opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/85 to-slate-900/50" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">About lidar.rentals</h1>
            <p className="mt-6 text-lg text-slate-300 leading-relaxed">
              lidar.rentals provides LiDAR equipment rentals and professional onsite 3D scanning services. Our mission is to
              make advanced aerial and mobile LiDAR scanning accessible to small teams and enterprise projects alike with short
              term rentals, insured delivery, and expert support.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white p-6 rounded-2xl border border-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">Why choose us</h2>
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
            <li>High-quality calibrated scanners</li>
            <li>Flexible rental durations</li>
            <li>Insured delivery & support</li>
          </ul>
        </div>

        <section className="mt-8">
          <h3 className="text-lg font-semibold">Contact</h3>
          <p className="text-sm text-slate-600 mt-2">
            For questions or custom quotes, email{' '}
            <a className="text-blue-600 hover:underline font-medium" href="mailto:info@lidar.rentals">
              info@lidar.rentals
            </a>{' '}
            or call +1 (416) 789-5304.
          </p>
        </section>
      </section>
    </div>
  );
}
