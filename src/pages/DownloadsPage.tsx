export default function DownloadsPage() {
    // Place your live public storage or Google Drive links here when you have them!
    const manualUrl = "/manual.pdf";
    const droneSpecUrl = "/agreement.pdf";
    const rentalAgreementUrl = "/agreement.pdf";
    const intakeFormUrl = "/intake-form.pdf";

    return (
        <div className= "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12" >
        <h1 className="text-3xl font-bold text-slate-900" > Downloads </h1>
            < p className = "mt-4 text-slate-600" > Manuals and agreement forms for rentals.Click to download.</p>

      {/* Grid container arranging cards into 2 clean columns on desktop screens */ }
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6" >

    {/* CARD 1: User Manual */ }
        < div className = "bg-white p-6 rounded-2xl border border-slate-100 flex flex-col justify-between" >
            <div>
            <h3 className="font-semibold text-slate-900" > User Manual </h3>
                < p className = "mt-2 text-sm text-slate-500" > PDF user manual for equipment operation and safety.</p>
                    </div>
                    < div className = "mt-4" >
                        <a className="inline-block text-sm text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium transition-colors" href = { manualUrl } target = "_blank" rel = "noreferrer" >
                            Download Manual
                                </a>
                                </div>
                                </div>

    {/* CARD 2: Autonomous Drone Spec Sheet */ }
    <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col justify-between" >
        <div>
        <h3 className="font-semibold text-slate-900" > Autonomous Drone Spec Sheet </h3>
            < p className = "mt-2 text-sm text-slate-500" > Specifications to indoor GPS Denied drone only.</p>
                </div>
                < div className = "mt-4" >
                    <a className="inline-block text-sm text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium transition-colors" href = { droneSpecUrl } target = "_blank" rel = "noreferrer" >
                        Download Spec Sheet
                            </a>
                            </div>
                            </div>

    {/* CARD 3: Rental Agreement */ }
    <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col justify-between" >
        <div>
        <h3 className="font-semibold text-slate-900" > Rental Agreement </h3>
            < p className = "mt-2 text-sm text-slate-500" > Signed rental agreement and terms for equipment hire.</p>
                </div>
                < div className = "mt-4" >
                <a className= "inline-block text-sm text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium transition-colors" href = { rentalAgreementUrl } target = "_blank" rel = "noreferrer" >
                    Download Agreement
                        </a>
                        </div>
                        </div>

    {/* CARD 4: Onsite Intake Form */ }
    <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col justify-between" >
        <div>
        <h3 className="font-semibold text-slate-900" > Onsite Intake Form </h3>
            < p className = "mt-2 text-sm text-slate-500" > Important Information To Determine Site Safety Requirements.</p>
                </div>
                < div className = "mt-4" >
                    <a className="inline-block text-sm text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium transition-colors" href = { intakeFormUrl } target = "_blank" rel = "noreferrer" >
                        Download Intake Form
                            </a>
                            </div>
                            </div>

                            </div>
                            </div>
  );
}
