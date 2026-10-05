import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import TokenLoginPage from './pages/auth/TokenLoginPage';
import OAuthCallbackPage from './pages/auth/OAuthCallbackPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import CampaignsPage from './pages/campaigns/CampaignsPage';
import CampaignStatisticsPage from './pages/campaigns/CampaignStatisticsPage';
import CampaignLogPage from './pages/campaigns/CampaignLogPage';
import CampaignSubviewPage from './pages/campaigns/CampaignSubviewPage';
import CampaignWizardPage from './pages/campaigns/wizard/CampaignWizardPage';
import ListsPage from './pages/lists/ListsPage';
import ListsOverviewPage from './pages/lists/ListsOverviewPage';
import FormsPage from './pages/lists/FormsPage';
import CreateFormPage from './pages/lists/CreateFormPage';
import PublicFormPage from './pages/lists/PublicFormPage';
import StorePage from './pages/store/StorePage';
import PublicProfilePage from './pages/lists/PublicProfilePage';
import PublicConfirmPage from './pages/lists/PublicConfirmPage';
import ListDetailOverviewPage from './pages/lists/ListDetailOverviewPage';
import ListStatisticsPage from './pages/lists/ListStatisticsPage';
import SegmentsPage from './pages/lists/SegmentsPage';
import ListEmptyTabPage from './pages/lists/ListEmptyTabPage';
import ManageListFieldsPage from './pages/lists/ManageListFieldsPage';
import EmailVerificationPage from './pages/lists/EmailVerificationPage';
import SubscribersPage from './pages/subscribers/SubscribersPage';
import TemplatesPage from './pages/templates/TemplatesPage';
import NewTemplatePage from './pages/templates/NewTemplatePage';
import TemplateEditorPage from './pages/templates/TemplateEditorPage';

// GrapesJS is heavy — only load the visual builder chunks when they're opened.
const TemplateBuilderPage = lazy(() => import('./pages/templates/TemplateBuilderPage'));
const FormBuilderPage = lazy(() => import('./pages/lists/FormBuilderPage'));
const InvoiceTemplatePage = lazy(() => import('./pages/admin/InvoiceTemplatePage'));
import SendingDomainsPage from './pages/sending/SendingDomainsPage';
import NewSendingDomainPage from './pages/sending/NewSendingDomainPage';
import SendingDomainDetailPage from './pages/sending/SendingDomainDetailPage';
import SendingResourcePage from './pages/sending/SendingResourcePage';
import NewTrackingDomainPage from './pages/sending/NewTrackingDomainPage';
import VerificationServerEditorPage from './pages/sending/VerificationServerEditorPage';
import SendingBlacklistPage from './pages/sending/BlacklistPage';
import SendingBlacklistImportPage from './pages/sending/BlacklistImportPage';
import SendingSignaturesPage from './pages/sending/SignaturesPage';
import SendersPage from './pages/sending/SendersPage';
import SignatureEditorPage from './pages/sending/SignatureEditorPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import AddWebsitePage from './pages/integration/AddWebsitePage';
import ManageConnectionsPage from './pages/integration/ManageConnectionsPage';
import CampaignApiPage from './pages/campaign-api/CampaignApiPage';
import AdminPage from './pages/admin/AdminPage';
import AdminCustomerDetailPage from './pages/admin/AdminCustomerDetailPage';
import RoleEditorPage from './pages/admin/RoleEditorPage';
import PlanEditorPage from './pages/admin/PlanEditorPage';
import CreditPlanEditorPage from './pages/admin/CreditPlanEditorPage';
import EvpEditorPage from './pages/admin/EvpEditorPage';
import CurrencyEditorPage from './pages/admin/CurrencyEditorPage';
import TaxSettingsPage from './pages/admin/TaxSettingsPage';
import AdminEditorPage from './pages/admin/AdminEditorPage';
import AdminGroupEditorPage from './pages/admin/AdminGroupEditorPage';
import SendingServerTypePage from './pages/admin/SendingServerTypePage';
import SendingServerEditorPage from './pages/admin/SendingServerEditorPage';
import MailboxHandlerEditorPage from './pages/admin/MailboxHandlerEditorPage';
import EmailVerificationServerEditorPage from './pages/admin/EmailVerificationServerEditorPage';
import OAuthPage from './pages/admin/OAuthPage';
import OAuthSettingsPage from './pages/admin/OAuthSettingsPage';
import TemplateGalleryPage from './pages/admin/TemplateGalleryPage';
import TemplateGalleryNewPage from './pages/admin/TemplateGalleryNewPage';
const TemplateGalleryDesignPage = lazy(() => import('./pages/admin/TemplateGalleryDesignPage'));
import FormTemplatesPage from './pages/admin/FormTemplatesPage';
const FormTemplateBuilderPage = lazy(() => import('./pages/admin/FormTemplateBuilderPage'));
import CustomEmailsPage from './pages/admin/CustomEmailsPage';
const CustomEmailEditorPage = lazy(() => import('./pages/admin/CustomEmailEditorPage'));
import LanguagesPage from './pages/admin/LanguagesPage';
import LanguageEditorPage from './pages/admin/LanguageEditorPage';
import TranslationEditorPage from './pages/admin/TranslationEditorPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import PaymentGatewaysPage from './pages/admin/PaymentGatewaysPage';
import PaymentGatewayTypePage from './pages/admin/PaymentGatewayTypePage';
import PaymentGatewayEditorPage from './pages/admin/PaymentGatewayEditorPage';
import WebhooksPage from './pages/admin/WebhooksPage';
import WebhookEditorPage from './pages/admin/WebhookEditorPage';
import PluginsPage from './pages/admin/PluginsPage';
import InstallPluginPage from './pages/admin/InstallPluginPage';
import ReportLogPage from './pages/admin/ReportLogPage';
import BlacklistPage from './pages/admin/BlacklistPage';
import BlacklistImportPage from './pages/admin/BlacklistImportPage';
import SettingsPage from './pages/admin/SettingsPage';
import BillingPage from './pages/billing/BillingPage';
import ActivitiesPage from './pages/activities/ActivitiesPage';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';

const App = () => (
  <BrowserRouter>
    <ChunkErrorBoundary>
    <Routes>
      {/* Public routes */}
      {/* Public subscriber-facing pages — no auth, standalone */}
      <Route path="/forms/:formUid" element={<PublicFormPage />} />
      <Route path="/profile/:subscriberUid" element={<PublicProfilePage />} />
      <Route path="/subscribe/confirm/:token" element={<PublicConfirmPage />} />
      <Route path="/login/token/:token" element={<TokenLoginPage />} />
      <Route path="/auth/google/callback" element={<OAuthCallbackPage />} />

      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/campaigns" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
      <Route path="/campaigns/create" element={<ProtectedRoute><CampaignWizardPage /></ProtectedRoute>} />
      <Route path="/campaigns/:uid/edit" element={<ProtectedRoute><CampaignWizardPage /></ProtectedRoute>} />
      <Route path="/campaigns/:uid/statistics" element={<ProtectedRoute><CampaignStatisticsPage /></ProtectedRoute>} />
      <Route path="/campaigns/:uid/logs/:type" element={<ProtectedRoute><CampaignLogPage /></ProtectedRoute>} />
      <Route path="/campaigns/:uid/links" element={<ProtectedRoute><CampaignSubviewPage view="links" /></ProtectedRoute>} />
      <Route path="/campaigns/:uid/subscribers" element={<ProtectedRoute><CampaignSubviewPage view="subscribers" /></ProtectedRoute>} />
      <Route path="/campaigns/:uid/review" element={<ProtectedRoute><CampaignSubviewPage view="review" /></ProtectedRoute>} />
      <Route path="/lists" element={<Navigate to="/lists/overview" replace />} />
      <Route path="/lists/overview" element={<ProtectedRoute><ListsOverviewPage /></ProtectedRoute>} />
      <Route path="/lists/detail-overview" element={<ProtectedRoute><ListDetailOverviewPage /></ProtectedRoute>} />
      <Route path="/lists/all" element={<ProtectedRoute><ListsPage /></ProtectedRoute>} />
      <Route path="/lists/contacts" element={<ProtectedRoute><SubscribersPage /></ProtectedRoute>} />
      <Route path="/lists/segments" element={<ProtectedRoute><SegmentsPage /></ProtectedRoute>} />
      <Route path="/lists/settings" element={<ProtectedRoute><ListEmptyTabPage activeTitle="Settings" icon="settings" emptyText="List settings layout is ready" /></ProtectedRoute>} />
      <Route path="/lists/fields" element={<ProtectedRoute><ManageListFieldsPage /></ProtectedRoute>} />
      <Route path="/lists/email-verification" element={<ProtectedRoute><EmailVerificationPage /></ProtectedRoute>} />
      <Route path="/lists/:uid/statistics" element={<ProtectedRoute><ListStatisticsPage /></ProtectedRoute>} />
      <Route path="/lists/forms" element={<ProtectedRoute><FormsPage /></ProtectedRoute>} />
      <Route path="/lists/forms/create" element={<ProtectedRoute><CreateFormPage /></ProtectedRoute>} />
      <Route path="/lists/forms/:listUid/:formUid/edit" element={<ProtectedRoute><Suspense fallback={<div style={{ minHeight: '100vh' }} />}><FormBuilderPage /></Suspense></ProtectedRoute>} />
      <Route path="/subscribers" element={<Navigate to="/lists/contacts" replace />} />
      <Route path="/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
      <Route path="/templates/new" element={<ProtectedRoute><NewTemplatePage /></ProtectedRoute>} />
      <Route path="/templates/:uid/builder" element={<ProtectedRoute><Suspense fallback={<div style={{ minHeight: '100vh' }} />}><TemplateBuilderPage /></Suspense></ProtectedRoute>} />
      <Route path="/templates/:uid/edit" element={<ProtectedRoute><TemplateEditorPage /></ProtectedRoute>} />
      <Route path="/sending" element={<Navigate to="/sending/domains" replace />} />
      <Route path="/sending/servers" element={<ProtectedRoute><SendingResourcePage type="servers" /></ProtectedRoute>} />
      <Route path="/sending/domains" element={<ProtectedRoute><SendingDomainsPage /></ProtectedRoute>} />
      <Route path="/sending/domains/new" element={<ProtectedRoute><NewSendingDomainPage /></ProtectedRoute>} />
      <Route path="/sending/domains/:id" element={<ProtectedRoute><SendingDomainDetailPage /></ProtectedRoute>} />
      <Route path="/sending/tracking-domains" element={<ProtectedRoute><SendingResourcePage type="tracking" /></ProtectedRoute>} />
      <Route path="/sending/tracking-domains/new" element={<ProtectedRoute><NewTrackingDomainPage /></ProtectedRoute>} />
      <Route path="/sending/verification-servers" element={<ProtectedRoute><SendingResourcePage type="verification" /></ProtectedRoute>} />
      <Route path="/sending/email-verification-servers" element={<ProtectedRoute><SendingResourcePage type="verification" /></ProtectedRoute>} />
      <Route path="/sending/email-verification-servers/new" element={<ProtectedRoute><VerificationServerEditorPage /></ProtectedRoute>} />
      <Route path="/sending/email-verification-servers/:id/edit" element={<ProtectedRoute><VerificationServerEditorPage /></ProtectedRoute>} />
      <Route path="/sending/blacklist" element={<ProtectedRoute><SendingBlacklistPage /></ProtectedRoute>} />
      <Route path="/sending/blacklist/import" element={<ProtectedRoute><SendingBlacklistImportPage /></ProtectedRoute>} />
      <Route path="/sending/senders" element={<ProtectedRoute><SendersPage /></ProtectedRoute>} />
      <Route path="/sending/signatures" element={<ProtectedRoute><SendingSignaturesPage /></ProtectedRoute>} />
      <Route path="/sending/signatures/new" element={<ProtectedRoute><SignatureEditorPage /></ProtectedRoute>} />
      <Route path="/sending/signatures/:id/edit" element={<ProtectedRoute><SignatureEditorPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/store" element={<ProtectedRoute><StorePage /></ProtectedRoute>} />
      <Route path="/integration" element={<Navigate to="/integration/website" replace />} />
      <Route path="/integration/website" element={<ProtectedRoute><AddWebsitePage /></ProtectedRoute>} />
      <Route path="/integration/connections" element={<ProtectedRoute><ManageConnectionsPage /></ProtectedRoute>} />
      <Route path="/campaign-api" element={<ProtectedRoute><CampaignApiPage /></ProtectedRoute>} />
      <Route path="/campaign-api/:section" element={<ProtectedRoute><CampaignApiPage /></ProtectedRoute>} />
      <Route path="/admin/account" element={<ProtectedRoute><CampaignApiPage /></ProtectedRoute>} />
      <Route path="/admin/account/:section" element={<ProtectedRoute><CampaignApiPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/customers/:uid" element={<ProtectedRoute><AdminCustomerDetailPage /></ProtectedRoute>} />
      <Route path="/admin/roles/new" element={<ProtectedRoute><RoleEditorPage /></ProtectedRoute>} />
      <Route path="/admin/roles/:uid/edit" element={<ProtectedRoute><RoleEditorPage /></ProtectedRoute>} />
      <Route path="/admin/plans/:uid/edit" element={<ProtectedRoute><PlanEditorPage /></ProtectedRoute>} />
      <Route path="/admin/sending-credit-plans/new" element={<ProtectedRoute><CreditPlanEditorPage /></ProtectedRoute>} />
      <Route path="/admin/sending-credit-plans/:uid/edit" element={<ProtectedRoute><CreditPlanEditorPage /></ProtectedRoute>} />
      <Route path="/admin/email-verification-plans/new" element={<ProtectedRoute><EvpEditorPage /></ProtectedRoute>} />
      <Route path="/admin/email-verification-plans/:uid/edit" element={<ProtectedRoute><EvpEditorPage /></ProtectedRoute>} />
      <Route path="/admin/currencies/:id/edit" element={<ProtectedRoute><CurrencyEditorPage /></ProtectedRoute>} />
      <Route path="/admin/taxes" element={<ProtectedRoute><TaxSettingsPage /></ProtectedRoute>} />
      <Route path="/admin/admins/new" element={<ProtectedRoute><AdminEditorPage /></ProtectedRoute>} />
      <Route path="/admin/admins/:uid/edit" element={<ProtectedRoute><AdminEditorPage /></ProtectedRoute>} />
      <Route path="/admin/admin-groups/new" element={<ProtectedRoute><AdminGroupEditorPage /></ProtectedRoute>} />
      <Route path="/admin/admin-groups/:id/edit" element={<ProtectedRoute><AdminGroupEditorPage /></ProtectedRoute>} />
      <Route path="/admin/sending-servers/new" element={<ProtectedRoute><SendingServerTypePage /></ProtectedRoute>} />
      <Route path="/admin/sending-servers/create" element={<ProtectedRoute><SendingServerEditorPage /></ProtectedRoute>} />
      <Route path="/admin/sending-servers/:id/edit" element={<ProtectedRoute><SendingServerEditorPage /></ProtectedRoute>} />
      <Route path="/admin/bounce-handlers/new" element={<ProtectedRoute><MailboxHandlerEditorPage kind="bounce" /></ProtectedRoute>} />
      <Route path="/admin/bounce-handlers/:uid/edit" element={<ProtectedRoute><MailboxHandlerEditorPage kind="bounce" /></ProtectedRoute>} />
      <Route path="/admin/feedback-handlers/new" element={<ProtectedRoute><MailboxHandlerEditorPage kind="feedback" /></ProtectedRoute>} />
      <Route path="/admin/feedback-handlers/:uid/edit" element={<ProtectedRoute><MailboxHandlerEditorPage kind="feedback" /></ProtectedRoute>} />
      <Route path="/admin/email-verification-servers/new" element={<ProtectedRoute><EmailVerificationServerEditorPage /></ProtectedRoute>} />
      <Route path="/admin/email-verification-servers/:uid/edit" element={<ProtectedRoute><EmailVerificationServerEditorPage /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/admin/oauth" element={<ProtectedRoute><OAuthPage /></ProtectedRoute>} />
      <Route path="/admin/oauth/:provider" element={<ProtectedRoute><OAuthSettingsPage /></ProtectedRoute>} />
      <Route path="/admin/template-gallery" element={<ProtectedRoute><TemplateGalleryPage /></ProtectedRoute>} />
      <Route path="/admin/template-gallery/new" element={<ProtectedRoute><TemplateGalleryNewPage /></ProtectedRoute>} />
      <Route path="/admin/template-gallery/:uid/design" element={<ProtectedRoute><Suspense fallback={<div style={{ minHeight: '100vh' }} />}><TemplateGalleryDesignPage /></Suspense></ProtectedRoute>} />
      <Route path="/admin/form-templates" element={<ProtectedRoute><FormTemplatesPage /></ProtectedRoute>} />
      <Route path="/admin/form-templates/:uid/builder" element={<ProtectedRoute><Suspense fallback={<div style={{ minHeight: '100vh' }} />}><FormTemplateBuilderPage /></Suspense></ProtectedRoute>} />
      <Route path="/admin/custom-emails" element={<ProtectedRoute><CustomEmailsPage /></ProtectedRoute>} />
      <Route path="/admin/custom-emails/:uid/edit" element={<ProtectedRoute><Suspense fallback={<div style={{ minHeight: '100vh' }} />}><CustomEmailEditorPage /></Suspense></ProtectedRoute>} />
      <Route path="/admin/payment-gateways" element={<ProtectedRoute><PaymentGatewaysPage /></ProtectedRoute>} />
      <Route path="/admin/payment-gateways/new" element={<ProtectedRoute><PaymentGatewayTypePage /></ProtectedRoute>} />
      <Route path="/admin/payment-gateways/:uid/edit" element={<ProtectedRoute><PaymentGatewayEditorPage /></ProtectedRoute>} />
      <Route path="/admin/webhooks" element={<ProtectedRoute><WebhooksPage /></ProtectedRoute>} />
      <Route path="/admin/webhooks/new" element={<ProtectedRoute><WebhookEditorPage /></ProtectedRoute>} />
      <Route path="/admin/languages/new" element={<ProtectedRoute><LanguageEditorPage /></ProtectedRoute>} />
      <Route path="/admin/languages/:code/translate" element={<ProtectedRoute><TranslationEditorPage /></ProtectedRoute>} />
      <Route path="/admin/languages" element={<ProtectedRoute><LanguagesPage /></ProtectedRoute>} />
      <Route path="/admin/notifications" element={<ProtectedRoute><AdminNotificationsPage /></ProtectedRoute>} />
      <Route path="/admin/plugins" element={<ProtectedRoute><PluginsPage /></ProtectedRoute>} />
      <Route path="/admin/plugins/new" element={<ProtectedRoute><InstallPluginPage /></ProtectedRoute>} />
      <Route path="/admin/blacklist" element={<ProtectedRoute><BlacklistPage /></ProtectedRoute>} />
      <Route path="/admin/blacklist/import" element={<ProtectedRoute><BlacklistImportPage /></ProtectedRoute>} />
      <Route path="/admin/tracking-log" element={<ProtectedRoute><ReportLogPage type="delivery" /></ProtectedRoute>} />
      <Route path="/admin/bounce-log" element={<ProtectedRoute><ReportLogPage type="bounce" /></ProtectedRoute>} />
      <Route path="/admin/feedback-log" element={<ProtectedRoute><ReportLogPage type="feedback" /></ProtectedRoute>} />
      <Route path="/admin/open-log" element={<ProtectedRoute><ReportLogPage type="open" /></ProtectedRoute>} />
      <Route path="/admin/click-log" element={<ProtectedRoute><ReportLogPage type="click" /></ProtectedRoute>} />
      <Route path="/admin/unsubscribe-log" element={<ProtectedRoute><ReportLogPage type="unsubscribe" /></ProtectedRoute>} />
      <Route path="/admin/invoice-template" element={<ProtectedRoute><Suspense fallback={<div style={{ minHeight: '100vh' }} />}><InvoiceTemplatePage /></Suspense></ProtectedRoute>} />
      <Route path="/admin/:section" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/activities" element={<ProtectedRoute><ActivitiesPage /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </ChunkErrorBoundary>
  </BrowserRouter>
);

export default App;
