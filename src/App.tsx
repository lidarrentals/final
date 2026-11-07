import { CartProvider } from '@/context/CartContext';
import { useRouter } from '@/lib/router';
import Layout from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import EquipmentCatalogPage from '@/pages/EquipmentCatalogPage';
import EquipmentDetailPage from '@/pages/EquipmentDetailPage';
import ServicesPage from '@/pages/ServicesPage';
import ServiceDetailPage from '@/pages/ServiceDetailPage';
import CheckoutPage from '@/pages/CheckoutPage';
import AccountPage from '@/components/AccountPage';
import AdminDashboard from './pages/AdminDashboard';
import AboutPage from '@/pages/AboutPage';
import DownloadsPage from '@/pages/DownloadsPage';
import ReviewsPage from '@/pages/ReviewsPage';
import KnowledgeBasePage from '@/pages/KnowledgeBasePage';

function Routes() {
    const route = useRouter();

    // Ensure we have a leading slash for predictable matching
    const path = route && route.startsWith('/') ? route : `/${route}`;

    // Dynamic route helpers - correctly extracts the clean string ID at index 2
    const equipmentId = path.startsWith('/equipment/') ? path.split('/')[2] : null;
    const serviceId = path.startsWith('/services/') ? path.split('/')[2] : null;

    if (path === '/' || path === '') return <HomePage />;
    if (path === '/equipment') return <EquipmentCatalogPage />;
    if (equipmentId) return <EquipmentDetailPage id={ equipmentId } />;
    if (path === '/services') return <ServicesPage />;
    if (serviceId) return <ServiceDetailPage id={ serviceId } />;

    // Maps both /checkout and /cart paths directly to your CheckoutPage component
    if (path === '/checkout' || path === '/cart') return <CheckoutPage />;

    if (path === '/account') return <AccountPage />;
    if (path === '/about') return <AboutPage />;
    if (path === '/downloads') return <DownloadsPage />;
    if (path === '/reviews') return <ReviewsPage />;
    if (path === '/knowledge-base' || path.startsWith('/knowledge-base/')) {
        return <KnowledgeBasePage articleId={ path.split('/')[2] || null } />;
    }
    if (path === '/admin') return <AdminDashboard />;

    return (
        <div className= "max-w-2xl mx-auto px-4 py-20 text-center" >
        <h1 className="text-4xl font-bold text-slate-900" > 404 </h1>
            < p className = "text-slate-500 mt-3" > Page not found </p>
                < a href = "#/" className = "mt-6 inline-block text-blue-600 font-medium hover:underline" >
                    Go home
                        </a>
                        </div>
  );
}

export default function App() {
    return (
        <CartProvider>
        <Layout>
        <Routes />
        </Layout>
        </CartProvider>
    );
}
