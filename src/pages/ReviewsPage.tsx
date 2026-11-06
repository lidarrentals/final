import { useState } from 'react';

export default function ReviewsPage() {
    const [copied, setCopied] = useState(false);

    // Your official direct 5-star Google review link
    const reviewUrl = 'https://g.page';

    return (
        <div className= "max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12" >
        <h1 className="text-3xl font-bold text-slate-900" > Leave a Review </h1>
            < p className = "mt-4 text-slate-600" > We appreciate your feedback.You can leave a public Google review(recommended) or submit quick feedback below.</p>

    {/* Grid wrapper for the layout */ }
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6" >

    {/* BLOCK 1: Google Reviews Button + Your QR Code */ }
        < div className = "bg-white p-6 rounded-2xl border border-slate-100 flex flex-col items-center justify-between text-center" >
            <div className="w-full" >
                <h3 className="font-semibold text-slate-900" > Google Reviews </h3>
                    < p className = "mt-2 text-sm text-slate-500" > Click the button below to directly open the 5 - star review page for lidar.rentals.</p>
                        </div>

                        < a className = "mt-4 w-full text-center text-sm text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg" href = { reviewUrl } target = "_blank" rel = "noreferrer" >
                            Open Google Reviews
                                </a>

    {/* YOUR QR CODE IMAGE ATTACHED RIGHT UNDER THE BUTTON */ }
    <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center" >
        <p className="text-xs font-medium text-slate-600 mb-3" > Scan with your phone camera: </p>
            < img
    src = "/google-qr.png"
    alt = "Google Review QR Code"
    className = "w-32 h-32 object-contain"
        />
        </div>
        </div>

    {/* BLOCK 2: Quick Email Feedback Form */ }
    <div className="bg-white p-6 rounded-2xl border border-slate-100" >
        <h3 className="font-semibold text-slate-900" > Quick Feedback </h3>
            < p className = "mt-2 text-sm text-slate-500" > Leave a short rating and comment.This feedback is sent to our support email.</p>
                < form action = {`mailto:hello@lidar.rentals?subject=Site%20Feedback`
} method = "GET" >
    <label className="block text-sm text-slate-700 mt-2" > Rating(1 - 5) </label>
        < input name = "rating" type = "number" min = { 1} max = { 5} className = "mt-1 w-24 p-2 border rounded" />
            <label className="block text-sm text-slate-700 mt-3" > Comment </label>
                < textarea name = "comment" rows = { 4} className = "mt-1 w-full p-2 border rounded" />
                    <div className="mt-4 flex items-center gap-3" >
                        <button type="submit" className = "text-white bg-blue-600 px-4 py-2 rounded text-sm" > Send Feedback </button>
                            < button
type = "button"
onClick = {() => { navigator.clipboard?.writeText(reviewUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
className = "px-3 py-2 border rounded text-sm"
    >
{ copied? 'Copied': 'Copy Link' }
    </button>
    </div>
    </form>
    </div>

    </div>
    </div>
  );
}

