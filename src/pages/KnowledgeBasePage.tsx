import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, ChevronLeft, ChevronRight, Loader2, Lock, Menu, Search, X } from 'lucide-react';

// Articles and page images live in the private Supabase Storage bucket "kb".
// Only signed-in users can download them, so the content never ships in the site bundle.
const BUCKET = 'kb';

type Slice = { f: string; w: number; h: number };
type Doc = { id: string; title: string; cat: string; sub: string; text: string; slices: Slice[] };

const imageCache = new Map<string, string>();

async function loadImage(path: string): Promise<string> {
    const cached = imageCache.get(path);
    if (cached) return cached;
    // Uploaded as "img/<file>" by the upload script; older uploads used "app/<file>".
    const candidates = [path, 'app/' + path.replace(/^img\//, '')];
    for (const p of candidates) {
        const { data } = await supabase.storage.from(BUCKET).download(p);
        if (data) {
            const url = URL.createObjectURL(data);
            imageCache.set(path, url);
            return url;
        }
    }
    throw new Error('Image not found');
}

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
    if (!terms.length) return <>{text}</>;
    const re = new RegExp('(' + terms.map(escapeRegExp).join('|') + ')', 'gi');
    return (
        <>
            {text.split(re).map((part, i) =>
                i % 2 === 1 ? <mark key={i} className="bg-yellow-100 text-slate-900 rounded px-0.5">{part}</mark> : part
            )}
        </>
    );
}

function ArticleImage({ slice }: { slice: Slice }) {
    const [src, setSrc] = useState<string | null>(imageCache.get(slice.f) ?? null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        if (!src) {
            loadImage(slice.f).then((u) => alive && setSrc(u)).catch(() => alive && setFailed(true));
        }
        return () => { alive = false; };
    }, [slice.f, src]);

    if (failed) {
        return <div className="p-6 text-sm text-slate-400 text-center bg-slate-50">This image could not be loaded.</div>;
    }
    return src ? (
        <img src={src} alt="" width={slice.w} height={slice.h} className="w-full h-auto block" />
    ) : (
        <div className="w-full bg-slate-100 animate-pulse" style={{ aspectRatio: `${slice.w} / ${slice.h}` }} />
    );
}

export default function KnowledgeBasePage({ articleId }: { articleId?: string | null }) {
    const [user, setUser] = useState<any>(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [docs, setDocs] = useState<Doc[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [navOpen, setNavOpen] = useState(false);
    const loadedFor = useRef<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setAuthChecked(true);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }, []);

    // Fetch the article index once the visitor is signed in.
    useEffect(() => {
        if (!user) {
            setDocs([]);
            loadedFor.current = null;
            imageCache.forEach((u) => URL.revokeObjectURL(u));
            imageCache.clear();
            return;
        }
        if (loadedFor.current === user.id) return;
        loadedFor.current = user.id;
        setLoadingDocs(true);
        setError('');
        supabase.storage.from(BUCKET).download('manifest.json')
            .then(async ({ data, error }) => {
                if (error || !data) throw error || new Error('missing');
                setDocs(JSON.parse(await data.text()));
            })
            .catch(() => setError('Your account doesn’t have access to the knowledge base yet. Please contact us to request access.'))
            .finally(() => setLoadingDocs(false));
    }, [user]);

    const current = useMemo(() => docs.find((d) => d.id === articleId) ?? null, [docs, articleId]);
    const categories = useMemo(() => [...new Set(docs.map((d) => d.cat))], [docs]);
    const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);

    const results = useMemo(() => {
        if (!terms.length) return [];
        return docs
            .map((d) => {
                const t = d.title.toLowerCase();
                const x = d.text.toLowerCase();
                if (!terms.every((w) => t.includes(w) || x.includes(w))) return null;
                let score = 0;
                terms.forEach((w) => {
                    if (t.includes(w)) score += 20;
                    score += Math.min(x.split(w).length - 1, 15);
                });
                const i = Math.max(0, x.indexOf(terms[0]));
                return { d, score, snippet: d.text.slice(Math.max(0, i - 60), i + 160) };
            })
            .filter((r): r is { d: Doc; score: number; snippet: string } => r !== null)
            .sort((a, b) => b.score - a.score);
    }, [docs, terms]);

    useEffect(() => {
        document.title = (current ? current.title + ' · ' : '') + 'Knowledge Base · lidar.rentals';
        window.scrollTo(0, 0);
        setNavOpen(false);
    }, [current]);

    const go = (id?: string) => {
        setQuery('');
        window.location.hash = id ? `/knowledge-base/${id}` : '/knowledge-base';
    };

    if (!authChecked || loadingDocs) {
        return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" /></div>;
    }

    if (!user) {
        return (
            <div className="max-w-md mx-auto px-4 py-20 text-center">
                <Lock className="mx-auto text-blue-600 w-8 h-8" />
                <h1 className="mt-4 text-2xl font-bold text-slate-900">Members only</h1>
                <p className="mt-2 text-slate-500">Sign in to your rental account to access the Knowledge Base.</p>
                <a href="#/account?mode=login" className="mt-6 inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition">
                    Sign In
                </a>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-md mx-auto px-4 py-20 text-center">
                <Lock className="mx-auto text-slate-400 w-8 h-8" />
                <h1 className="mt-4 text-2xl font-bold text-slate-900">Knowledge Base</h1>
                <p className="mt-2 text-slate-500">{error}</p>
            </div>
        );
    }

    const index = current ? docs.indexOf(current) : -1;
    const prev = index > 0 ? docs[index - 1] : null;
    const next = index >= 0 && index < docs.length - 1 ? docs[index + 1] : null;

    const sidebar = (
        <nav className="space-y-4 text-sm">
            {categories.map((cat) => {
                let lastSub: string | null = null;
                return (
                    <details key={cat} open={!current || current.cat === cat} className="group">
                        <summary className="cursor-pointer font-semibold text-slate-900 py-1">{cat}</summary>
                        <div className="mt-1 ml-1 border-l border-slate-200 pl-3 space-y-0.5">
                            {docs.filter((d) => d.cat === cat).map((d) => {
                                const showSub = d.sub && d.sub !== lastSub;
                                lastSub = d.sub;
                                return (
                                    <div key={d.id}>
                                        {showSub && <div className="mt-2 mb-1 text-[11px] uppercase tracking-wide text-slate-400">{d.sub}</div>}
                                        <a
                                            href={`#/knowledge-base/${d.id}`}
                                            onClick={() => setQuery('')}
                                            className={`block py-1 rounded ${current?.id === d.id ? 'text-blue-600 font-medium' : 'text-slate-600 hover:text-slate-900'}`}
                                        >
                                            {d.title}
                                        </a>
                                    </div>
                                );
                            })}
                        </div>
                    </details>
                );
            })}
        </nav>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <button
                    type="button"
                    onClick={() => setNavOpen(!navOpen)}
                    className="lg:hidden p-2 rounded-lg border border-slate-200 bg-white"
                    aria-label="Toggle article list"
                >
                    {navOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
                <button type="button" onClick={() => go()} className="flex items-center gap-2 bg-transparent border-0 cursor-pointer">
                    <BookOpen className="text-blue-600 w-6 h-6" />
                    <span className="text-xl font-bold text-slate-900">Knowledge Base</span>
                </button>
                <div className="relative flex-1 min-w-[200px] sm:ml-auto sm:max-w-sm">
                    <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                        placeholder="Search articles…"
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-white"
                    />
                </div>
            </div>

            <div className="flex gap-8">
                <aside className={`${navOpen ? 'block' : 'hidden'} lg:block w-full lg:w-72 shrink-0 lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto bg-white lg:bg-transparent p-4 lg:p-0 rounded-2xl border lg:border-0 border-slate-100`}>
                    {sidebar}
                </aside>

                <main className={`${navOpen ? 'hidden' : 'block'} lg:block flex-1 min-w-0`}>
                    {terms.length > 0 ? (
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 mb-4">{results.length} result{results.length === 1 ? '' : 's'}</h1>
                            <div className="space-y-3">
                                {results.map(({ d, snippet }) => (
                                    <a key={d.id} href={`#/knowledge-base/${d.id}`} onClick={() => setQuery('')} className="block bg-white p-5 rounded-2xl border border-slate-100 hover:border-blue-200 transition">
                                        <div className="font-semibold text-slate-900"><Highlight text={d.title} terms={terms} /></div>
                                        <div className="text-xs text-slate-400 mt-0.5">{d.cat}{d.sub ? ` › ${d.sub}` : ''}</div>
                                        <p className="mt-2 text-sm text-slate-600">…<Highlight text={snippet} terms={terms} />…</p>
                                    </a>
                                ))}
                            </div>
                        </div>
                    ) : current ? (
                        <article>
                            <div className="text-sm text-slate-400">{current.cat}{current.sub ? ` › ${current.sub}` : ''}</div>
                            <h1 className="sr-only">{current.title}</h1>
                            <div className="mt-3 bg-white rounded-2xl border border-slate-100 overflow-hidden max-w-[861px]">
                                {current.slices.map((s) => <ArticleImage key={s.f} slice={s} />)}
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-4 max-w-[861px]">
                                {prev ? (
                                    <a href={`#/knowledge-base/${prev.id}`} className="bg-white p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition">
                                        <span className="flex items-center gap-1 text-xs text-slate-400"><ChevronLeft className="w-3 h-3" />Previous</span>
                                        <span className="block mt-1 text-sm font-medium text-slate-800">{prev.title}</span>
                                    </a>
                                ) : <span />}
                                {next ? (
                                    <a href={`#/knowledge-base/${next.id}`} className="bg-white p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition text-right">
                                        <span className="flex items-center justify-end gap-1 text-xs text-slate-400">Next<ChevronRight className="w-3 h-3" /></span>
                                        <span className="block mt-1 text-sm font-medium text-slate-800">{next.title}</span>
                                    </a>
                                ) : <span />}
                            </div>
                        </article>
                    ) : (
                        <div>
                            <div className="bg-slate-900 text-white rounded-2xl p-8">
                                <h1 className="text-2xl font-bold">How can we help?</h1>
                                <p className="mt-2 text-slate-300">Setup guides, flight procedures, post-processing and troubleshooting for your rental equipment.</p>
                            </div>
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {categories.map((cat) => (
                                    <div key={cat} className="bg-white p-5 rounded-2xl border border-slate-100">
                                        <h3 className="font-semibold text-slate-900">{cat}</h3>
                                        <div className="mt-3 space-y-1.5">
                                            {docs.filter((d) => d.cat === cat).map((d) => (
                                                <a key={d.id} href={`#/knowledge-base/${d.id}`} className="block text-sm text-blue-600 hover:underline">{d.title}</a>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="mt-10 text-xs text-slate-400">
                        Documentation content © Exyn Technologies. All rights reserved. Nexys and ExynView are trademarks of their respective owner.
                    </p>
                </main>
            </div>
        </div>
    );
}
