import React from 'react';
import { Phone, MessageCircle, Mail, MapPin, Clock, ExternalLink } from 'lucide-react';
import { useStore } from '../store/StoreContext';

const SocialBrandIcon: React.FC<{ platform: string }> = ({ platform }) => {
  switch (platform) {
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.7V4.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H8v3h2.4v8h3.1z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" className="fill-current stroke-none" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.3 1.2-1.8 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.7-3-1.3-4.9-4.4-5.1-4.6-.1-.2-1.2-1.6-1.2-3 0-1.5.8-2.2 1.1-2.5.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.6.8 2 .9 2.1.1.2.1.4 0 .6-.1.2-.2.3-.3.5l-.4.5c-.2.2-.3.4-.1.7.2.3.8 1.4 1.8 2.2 1.2 1.1 2.2 1.4 2.6 1.6.3.1.5.1.7-.1.2-.2.8-1 1-1.3.2-.3.5-.3.8-.2.3.1 2 .9 2.3 1.1.3.2.6.3.7.4.1.2.1.9-.1 1.5z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M16.6 5.8A4.8 4.8 0 0 1 15 2.5h-3v12.8a2.8 2.8 0 1 1-2-2.7V9.5a5.8 5.8 0 1 0 5 5.8V8.8a7.8 7.8 0 0 0 4.5 1.4V7.2a4.8 4.8 0 0 1-2.9-1.4z" />
        </svg>
      );
    case 'telegram':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M21.5 4.2 2.9 11.4c-1.3.5-1.3 1.3-.2 1.6l4.8 1.5 11.1-7c.5-.3 1-.1.6.2l-9 8.1-.3 4.9c.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.8c.3-1.3-.5-1.9-1.3-1.7z" />
        </svg>
      );
    case 'snapchat':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M12 2.5c-3.1 0-5.4 2.2-5.4 5.5v1.9c-.6.2-1.2.1-1.5.4-.3.3-.1.9.5 1.1.9.3 1.1.8.8 1.5-.6 1.5-1.9 2.6-3.4 3-.5.1-.7.6-.4 1 .4.5 1.4.8 2.6 1 .2.5.4 1.1.9 1.2.6.1 1.4-.3 2.5-.3s1.7.6 3.4.6 2.3-.6 3.4-.6 1.9.4 2.5.3c.5-.1.7-.7.9-1.2 1.2-.2 2.2-.5 2.6-1 .3-.4.1-.9-.4-1-1.5-.4-2.8-1.5-3.4-3-.3-.7-.1-1.2.8-1.5.6-.2.8-.8.5-1.1-.3-.3-.9-.2-1.5-.4V8c0-3.3-2.3-5.5-5.4-5.5z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM10 15.1V8.9l5.2 3.1L10 15.1z" />
        </svg>
      );
    case 'x':
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
          <path d="M18.3 3H21l-6 6.9L22 21h-5.5l-4.3-5.6L7.2 21H4.5l6.4-7.4L4 3h5.6l3.9 5.2L18.3 3zm-1 16.2h1.5L8.7 4.7H7.1l10.2 14.5z" />
        </svg>
      );
  }
};

export const Footer: React.FC = () => {
  const { locale, t, settings, appearance, setActiveTab, openCatalog } = useStore();
  const vis = settings.contactVisibility;

  const socialItems = [
    { key: 'facebook', label: 'Facebook', item: settings.socialLinks.facebook },
    { key: 'instagram', label: 'Instagram', item: settings.socialLinks.instagram },
    { key: 'whatsapp', label: 'WhatsApp', item: settings.socialLinks.whatsapp },
    { key: 'tiktok', label: 'TikTok', item: settings.socialLinks.tiktok },
    { key: 'telegram', label: 'Telegram', item: settings.socialLinks.telegram },
    { key: 'snapchat', label: 'Snapchat', item: settings.socialLinks.snapchat },
    { key: 'youtube', label: 'YouTube', item: settings.socialLinks.youtube },
    { key: 'x', label: 'X', item: settings.socialLinks.x },
  ].filter((s) => s.item.visible && Boolean(s.item.url && s.item.url.trim().length > 0));

  const showPhone = vis.phone && Boolean(settings.phone?.trim());
  const showWhatsapp = vis.whatsapp && Boolean(settings.whatsapp?.trim());
  const showEmail = vis.email && Boolean(settings.email?.trim());
  const addressText = locale === 'ar' ? settings.addressAr : settings.addressEn;
  const showAddress = vis.address && Boolean(addressText?.trim());
  const hoursText = locale === 'ar' ? settings.workingHoursAr : settings.workingHoursEn;
  const showHours = vis.workingHours && Boolean(hoursText?.trim());

  const quickLinks = [
    { id: 'home', label: t('الرئيسية', 'Home'), action: () => setActiveTab('home') },
    { id: 'catalog', label: t('التصنيفات', 'Categories'), action: () => openCatalog('all', '') },
    { id: 'cart', label: t('سلة المشتريات', 'Cart'), action: () => setActiveTab('cart') },
    { id: 'orders', label: t('طلباتي', 'Orders'), action: () => setActiveTab('orders') },
    { id: 'consult', label: t('استشارة أخصائي البصريات', 'Consult an Optician'), action: () => setActiveTab('consult') },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{ backgroundColor: appearance.primaryColor }}
      className="mt-0 md:mt-6 text-white border-t border-white/10 pt-10 pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center space-y-7">
        {/* 1. Title: تواصل معنا */}
        <div className="space-y-1.5">
          <h2
            className="text-xl sm:text-2xl font-extrabold tracking-tight"
            style={{ color: appearance.secondaryColor }}
          >
            {t('تواصل معنا', 'Contact Us')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            {locale === 'ar' ? settings.storeNameAr : settings.storeNameEn} — {appearance.wordmarkText}
          </p>
        </div>

        {/* 2. Contact buttons & store details (Firestore settings/store) */}
        {(showPhone || showWhatsapp || showEmail || showAddress || showHours) && (
          <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {showPhone && (
              <a
                href={`tel:${settings.phone}`}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/12 flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="w-4 h-4 shrink-0" style={{ color: appearance.secondaryColor }} />
                <span dir="ltr" className="font-mono-num font-bold">
                  {settings.phone}
                </span>
              </a>
            )}

            {showWhatsapp && (
              <a
                href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-400/30 flex items-center justify-center gap-2 transition-colors font-bold"
              >
                <MessageCircle className="w-4 h-4 shrink-0 text-emerald-300" />
                <span>{t('واتساب خدمة العملاء', 'WhatsApp Support')}</span>
              </a>
            )}

            {showEmail && (
              <a
                href={`mailto:${settings.email}`}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/12 flex items-center justify-center gap-2 transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" style={{ color: appearance.secondaryColor }} />
                <span dir="ltr" className="truncate font-medium">
                  {settings.email}
                </span>
              </a>
            )}

            {showAddress && (
              <a
                href={settings.mapUrl || '#'}
                target={settings.mapUrl ? '_blank' : undefined}
                rel={settings.mapUrl ? 'noopener noreferrer' : undefined}
                className="min-h-[44px] sm:col-span-2 lg:col-span-2 px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/12 flex items-center justify-center gap-2 transition-colors"
              >
                <MapPin className="w-4 h-4 shrink-0" style={{ color: appearance.secondaryColor }} />
                <span className="leading-snug">{addressText}</span>
                {settings.mapUrl && <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-75" />}
              </a>
            )}

            {showHours && (
              <div className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center gap-2 text-slate-200">
                <Clock className="w-4 h-4 shrink-0" style={{ color: appearance.secondaryColor }} />
                <span className="leading-snug">{hoursText}</span>
              </div>
            )}
          </div>
        )}

        {/* 3. Social Media Icon Buttons */}
        {socialItems.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {socialItems.map((s) => (
              <a
                key={s.key}
                href={s.item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-[#D9B24C] hover:text-[#11223E] border border-white/15 flex items-center justify-center transition-all hover:scale-105"
              >
                <SocialBrandIcon platform={s.key} />
              </a>
            ))}
          </div>
        )}

        {/* 4. Quick Links */}
        <nav
          aria-label={t('روابط سريعة', 'Quick Links')}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm font-semibold text-slate-200 pt-2 border-t border-white/10 w-full max-w-3xl"
        >
          {quickLinks.map((lnk) => (
            <button
              key={lnk.id}
              type="button"
              onClick={lnk.action}
              className="min-h-[40px] px-2 hover:text-[#D9B24C] transition-colors whitespace-nowrap"
            >
              {lnk.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className="min-h-[40px] px-2 text-slate-300 hover:text-[#D9B24C] transition-colors whitespace-nowrap"
          >
            {t('من نحن والسياسات', 'About & Policies')}
          </button>
        </nav>

        {/* 5. Copyright line */}
        <div className="text-xs text-slate-300/90 pt-2 border-t border-white/10 w-full max-w-3xl">
          © {currentYear} Vision Plus - فيجن بلس
        </div>
      </div>
    </footer>
  );
};
