import { useState, useEffect } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { Service } from '@/types';
import { supabase } from '@/lib/supabase';

export default function ServiceCard({ service }: { service: Service }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        companyName: '',
        address: '',
        fullName: '',
        phone: '',
        email: '',
        urgency: 'no rush',
        comments: ''
    });

    // --- ADDED: Listen for the global action button click ---
    useEffect(() => {
        const handleGlobalOpen = () => {
            setIsOpen(true);
        };

        window.addEventListener('open-consultation', handleGlobalOpen);
        return () => {
            window.removeEventListener('open-consultation', handleGlobalOpen);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // 1. Save data payload to your Supabase table
            const { error } = await supabase
                .from('leads')
                .insert([
                    {
                        service_id: service?.id || 'general',
                        service_name: service?.name || 'General Inquiry',
                        company_name: formData.companyName,
                        address: formData.address,
                        full_name: formData.fullName,
                        phone: formData.phone,
                        email: formData.email,
                        urgency: formData.urgency,
                        comments: formData.comments
                    }
                ]);

            if (error) throw error;

            // 2. Open Calendly in a brand new browser tab or window
            window.open('https://calendly.com/lidar-rentals', '_blank');

            // 3. Close the modal on your main page and reset submitting state
            setIsOpen(false);
            setIsSubmitting(false);
        } catch (error) {
            console.error('Error saving data:', error);
            alert('Something went wrong. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <>
        {/* Service Card UI */ }
        < div className = "group text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col h-full" >
            <div className="relative aspect-[16/10] overflow-hidden bg-slate-100" >
                {
                    service?.image_url ? (
                        <img
                            src={service.image_url}
                            alt={service.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <span className="text-4xl">📐</span>
                        </div>
                    )
}
<span className="absolute top-3 left-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur text-white text-xs font-semibold rounded-full" >
    Onsite Service
        </span>
        </div>

        < div className = "p-5 flex flex-col flex-grow justify-between" >
            <div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors" >
            { service?.name || 'General Consultation'}
</h3>
    < p className = "text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed" >
    { service?.description || 'Schedule an operational strategy assessment with our onsite specialists.'}
</p>
    </div>

    < button
onClick = {() => setIsOpen(true)}
className = "mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors group/btn"
    >
    <span>Click here to schedule a consultation </span>
        < ArrowRight className = "w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
            </div>
            </div>

{/* Pop-up Window Form Overlay */ }
{
    isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" >
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative" >
                <button
              onClick={ () => setIsOpen(false) }
    className = "absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
        <X className="w-5 h-5" />
            </button>

            < div className = "mb-6" >
                <h2 className="text-xl font-bold text-slate-900" > Consultation Request </h2>
                    < p className = "text-sm text-slate-500 mt-1" > Tell us about your company to continue scheduling for { service?.name || 'General Consultation'}.</p>
                        </div>

                        < form onSubmit = { handleSubmit } className = "space-y-4" >
                            <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1" > Full Name * </label>
                                < input
required
type = "text"
className = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
value = { formData.fullName }
onChange = { e => setFormData({ ...formData, fullName: e.target.value })}
                />
    </div>

    < div className = "grid grid-cols-1 sm:grid-cols-2 gap-4" >
        <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1" > Email * </label>
            < input
required
type = "email"
className = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
value = { formData.email }
onChange = { e => setFormData({ ...formData, email: e.target.value })}
                  />
    </div>
    < div >
    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1" > Phone Number * </label>
        < input
required
type = "tel"
className = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
value = { formData.phone }
onChange = { e => setFormData({ ...formData, phone: e.target.value })}
                  />
    </div>
    </div>

    < div >
    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1" > Company Name * </label>
        < input
required
type = "text"
className = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
value = { formData.companyName }
onChange = { e => setFormData({ ...formData, companyName: e.target.value })}
                />
    </div>

    < div >
    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1" > Company Address * </label>
        < input
required
type = "text"
className = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
value = { formData.address }
onChange = { e => setFormData({ ...formData, address: e.target.value })}
                />
    </div>

    < div >
    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1" > Urgency * </label>
        < select
className = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
value = { formData.urgency }
onChange = { e => setFormData({ ...formData, urgency: e.target.value })}
                >
    <option value="urgent" > Urgent </option>
        < option value = "asap" > ASAP </option>
            < option value = "no rush" > No Rush </option>
                < option value = "planning" > Planning </option>
                    </select>
                    </div>

                    < div >
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1" > What are you looking for? </label>
                        < textarea
                  rows = { 3}
                  className = "w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                  value = { formData.comments }
onChange = { e => setFormData({ ...formData, comments: e.target.value })}
                />
    </div>

    < button
type = "submit"
disabled = { isSubmitting }
className = "w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors"
    >
{ isSubmitting? 'Saving...': 'Continue to Schedule' }
{ !isSubmitting && <ArrowRight className="w-4 h-4" />}
</button>
    </form>
    </div>
    </div>
      )}
</>
  );
}
