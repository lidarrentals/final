import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, FileText, Loader2, Lock, Building2, MapPin, UserCheck } from 'lucide-react';

export default function AccountPage() {
    const [user, setUser] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [fullName, setFullName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [address, setAddress] = useState('');

    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Function to look at the URL hash structure and update state dynamically
        const checkHashMode = () => {
            const hash = window.location.hash;
            if (hash.includes('mode=register')) {
                setIsRegister(true);
            } else if (hash.includes('mode=login')) {
                setIsRegister(false);
            }
        };

        // Check the link structure on initial load
        checkHashMode();

        // Also check localStorage fallback
        const savedMode = localStorage.getItem('auth_mode');
        if (savedMode === 'register') {
            setIsRegister(true);
            localStorage.removeItem('auth_mode');
        }

        // Listen for real-time header button clicks while on this page
        window.addEventListener('hashchange', checkHashMode);

        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => window.removeEventListener('hashchange', checkHashMode);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert(error.message);
            setLoading(false);
            return;
        }
        setUser(data.user);
        setLoading(false);
        // Take customers straight to the members-only Knowledge Base after signing in
        window.location.hash = '/knowledge-base';
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    company_name: companyName,
                    business_address: address
                }
            }
        });

        if (error) {
            alert(error.message);
        } else {
            alert('Registration successful! Check your email for verification.');
            setIsRegister(false);
        }
        setLoading(false);
    };

    if (loading) {
        return <div className="flex justify-center p-20" > <Loader2 className="animate-spin text-blue-600" /> </div>;
    }

    return (
        <div className= "max-w-4xl mx-auto px-4 py-12" >
        {!user ? (
            <div className= "max-w-md mx-auto bg-white border border-slate-200 p-8 rounded-2xl shadow-sm" >
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6" >
                <Lock className="text-blue-600" />
                { isRegister? 'Create Rental Profile': 'Secure Portal Gateway' }
                    </h2>

                    < form onSubmit = { isRegister? handleSignUp: handleLogin } className = "space-y-4" >
                    { isRegister && (
                            <>
                            <div className="relative" >
                                <UserCheck className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                    <input type="text" placeholder = "Full Name" value = { fullName } onChange = { e => setFullName(e.target.value) } className = "w-full pl-10 pr-4 py-2 border rounded-xl" required />
                                        </div>
                                        < div className = "relative" >
                                            <Building2 className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                                <input type="text" placeholder = "Company Name" value = { companyName } onChange = { e => setCompanyName(e.target.value) } className = "w-full pl-10 pr-4 py-2 border rounded-xl" required />
                                                    </div>
                                                    < div className = "relative" >
                                                        <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                                            <input type="text" placeholder = "Business Address" value = { address } onChange = { e => setAddress(e.target.value) } className = "w-full pl-10 pr-4 py-2 border rounded-xl" required />
                                                                </div>
                                                                </>
            )
}

<input type="email" placeholder = "Email Address" value = { email } onChange = { e => setEmail(e.target.value) } className = "w-full px-4 py-2 border rounded-xl" required />
    <input type="password" placeholder = "Password" value = { password } onChange = { e => setPassword(e.target.value) } className = "w-full px-4 py-2 border rounded-xl" required />

        <div className="flex flex-col gap-3 pt-2" >
        {
            isRegister?(
                <>
            <button type="submit" className = "w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-sm hover:bg-blue-500 transition" > Create Account </button>
                < button type = "button" onClick = {() => { setIsRegister(false); window.location.hash = '/account?mode=login'; }} className = "w-full py-2 text-sm text-slate-500 hover:text-slate-800 transition" > Already have an account ? Sign In </button>
                    </>
              ) : (
    <>
    <button type= "submit" className = "w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-sm hover:bg-blue-500 transition" > Sign In </button>
        < button type = "button" onClick = {() => { setIsRegister(true); window.location.hash = '/account?mode=register'; }} className = "w-full py-2 text-sm text-slate-500 hover:text-slate-800 transition" > Need an account ? Register here </button>
            </>
              )}
</div>
    </form>
    </div>
      ) : (
    <div className= "space-y-8" >
    <div className="flex justify-between items-center border-b border-slate-100 pb-4" >
        <div>
        <h1 className="text-2xl font-bold text-slate-900" > Welcome Back </h1>
            < p className = "text-sm text-slate-500" > { user.email } </p>
{
    user.user_metadata?.company_name && (
        <p className="text-xs font-semibold text-blue-600 mt-0.5" > { user.user_metadata.company_name } </p>
            )
}
</div>
    < button onClick = {() => { supabase.auth.signOut(); setUser(null); }} className = "px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50" > Log Out </button>
        </div>

        < div >
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2" > <FileText /> Portal Management</h2 >
            <p className="text-slate-500 text-sm bg-slate-50 p-6 rounded-xl border border-dashed border-slate-200 text-center" > Your company account profile information has been successfully linked.</p>
                <a href="#/knowledge-base" className="mt-4 flex items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-300 transition">
                    <span className="flex items-center gap-3">
                        <BookOpen className="text-blue-600 w-5 h-5" />
                        <span>
                            <span className="block font-semibold text-slate-900">Knowledge Base</span>
                            <span className="block text-sm text-slate-500">Nexys flight procedures, post-processing guides and support.</span>
                        </span>
                    </span>
                    <span className="text-sm font-medium text-blue-600">Open &rarr;</span>
                </a>
                </div>
                </div>
      )}
</div>
  );
}
