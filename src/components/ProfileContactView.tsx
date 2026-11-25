import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Phone,
  Clock,
  Plus,
  Trash2,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  FileText,
  MailCheck,
  MailWarning,
  User,
  Eye,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { formatSdg, isValidSudanPhone, normalizeSudanPhone } from '../utils/format';
import {
  AXIS_OPTIONS,
  CYL_OPTIONS,
  PD_SINGLE_OPTIONS,
  SPH_OPTIONS,
  isNonZeroCyl,
} from '../utils/prescription';
import { PWAInstallButton } from './PWAInstallButton';

export const ProfileView: React.FC = () => {
  const {
    locale,
    t,
    user,
    isGuest,
    isEmailVerified,
    openVerifyEmailScreen,
    settings,
    appearance,
    updateProfile,
    saveAddress,
    setDefaultAddress,
    deleteAddress,
    savePrescription,
    deletePrescription,
    setActiveTab,
    showToast,
  } = useStore();

  const [sectionTab, setSectionTab] = useState<'account' | 'addresses' | 'rx'>('account');
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email);

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone);
    setEmail(user.email);
  }, [user.uid, user.name, user.phone, user.email]);

  const [addrLabel, setAddrLabel] = useState('');
  const [addrRecipient, setAddrRecipient] = useState(user.name || '');
  const [addrPhone, setAddrPhone] = useState(user.phone || '');
  const [addrState, setAddrState] = useState('khartoum');
  const [addrCity, setAddrCity] = useState('');
  const [addrArea, setAddrArea] = useState('');
  const [addrDetails, setAddrDetails] = useState('');
  const [addrMapUrl, setAddrMapUrl] = useState('');
  const [addrDefault, setAddrDefault] = useState(false);

  const [rxLabel, setRxLabel] = useState('');
  const [odSph, setOdSph] = useState('-1.00');
  const [odCyl, setOdCyl] = useState('0.00');
  const [odAxis, setOdAxis] = useState('0');
  const [osSph, setOsSph] = useState('-1.00');
  const [osCyl, setOsCyl] = useState('0.00');
  const [osAxis, setOsAxis] = useState('0');
  const [pd, setPd] = useState('63');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidSudanPhone(phone)) {
      showToast(t('يرجى إدخال رقم سوداني بصيغة +249 أو 09', 'Enter a valid Sudan phone number'));
      return;
    }
    updateProfile(name.trim(), normalizeSudanPhone(phone), email.trim());
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrLabel.trim() || !addrCity.trim() || !addrArea.trim() || !addrDetails.trim()) {
      showToast(t('يرجى إكمال جميع حقول العنوان المطلوبة', 'Please complete all required address fields'));
      return;
    }
    const phoneToUse = addrPhone.trim() || user.phone;
    if (!isValidSudanPhone(phoneToUse)) {
      showToast(t('يرجى إدخال رقم سوداني صحيح للعنوان', 'Enter a valid Sudan phone number'));
      return;
    }
    saveAddress({
      label: addrLabel.trim(),
      recipientName: addrRecipient.trim() || user.name,
      stateId: addrState,
      city: addrCity.trim(),
      area: addrArea.trim(),
      details: addrDetails.trim(),
      phone: normalizeSudanPhone(phoneToUse),
      mapUrl: addrMapUrl.trim() || undefined,
      isDefault: addrDefault,
    });
    setAddrLabel('');
    setAddrCity('');
    setAddrArea('');
    setAddrDetails('');
    setAddrMapUrl('');
    setAddrDefault(false);
  };

  const handleAddRx = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      showToast(t('هذه الميزة متاحة للحسابات المسجلة فقط', 'Available for registered accounts'));
      return;
    }
    if (!rxLabel.trim()) return;
    savePrescription({
      label: rxLabel.trim(),
      kind: 'eyeglasses',
      rightEye: { sph: odSph, cyl: odCyl, axis: odAxis },
      leftEye: { sph: osSph, cyl: osCyl, axis: osAxis },
      pd,
    });
    setRxLabel('');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{t('حسابي والوصفات', 'Profile & Prescriptions')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('إدارة بياناتك وعناوينك وقياسات النظر المحفوظة', 'Manage your details, addresses, and saved prescriptions')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PWAInstallButton variant="profile" />
          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111927] text-xs font-semibold"
          >
            {t('المفضلة', 'Favorites')} ({user.favoriteProductIds.length})
          </button>
        </div>
      </div>

      {/* Verification / Guest Notice */}
      {isGuest ? (
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-4 space-y-1">
          <h2 className="text-sm font-extrabold">{t('أنت تتصفح الآن كضيف', 'Browsing as Guest')}</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t(
              'يمكنك التصفح والإضافة للسلة والمفضلة. عند إتمام الطلب سيُطلب منك تسجيل الدخول لحفظ عناوينك وقياساتك.',
              'Browse and add items freely. Sign in during checkout to save addresses and prescriptions.'
            )}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            {isEmailVerified ? (
              <MailCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <MailWarning className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div>
              <div className="font-bold">
                {isEmailVerified
                  ? t('البريد الإلكتروني مؤكد', 'Email Verified')
                  : t('البريد الإلكتروني بانتظار التأكيد', 'Email Verification Pending')}
              </div>
              <div dir="ltr" className="text-slate-500 dark:text-slate-400 font-mono-num">
                {user.email}
              </div>
            </div>
          </div>
          {!isEmailVerified && (
            <button
              type="button"
              onClick={openVerifyEmailScreen}
              style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
              className="min-h-[40px] px-4 rounded-xl text-xs font-extrabold"
            >
              {t('تأكيد البريد', 'Verify Email')}
            </button>
          )}
        </div>
      )}

      {/* Clean 3-Tab Switcher instead of 3 squeezed columns */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {(
          [
            { id: 'account', icon: User, ar: 'بياناتي', en: 'My Info' },
            { id: 'addresses', icon: MapPin, ar: `العناوين (${user.addresses.length})`, en: `Addresses (${user.addresses.length})` },
            { id: 'rx', icon: Eye, ar: `وصفات النظر (${user.prescriptions.length})`, en: `Prescriptions (${user.prescriptions.length})` },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = sectionTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSectionTab(tab.id)}
              style={active ? { backgroundColor: appearance.primaryColor } : undefined}
              className={`min-h-[42px] px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                active
                  ? 'text-white'
                  : 'bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t(tab.ar, tab.en)}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Personal Info */}
      {sectionTab === 'account' && (
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 text-xs">
          <h2 className="text-base font-bold">{t('البيانات الشخصية', 'Account Details')}</h2>
          {isGuest ? (
            <p className="text-slate-600 dark:text-slate-400">
              {t('إدارة البيانات الشخصية متاحة للحسابات المسجلة.', 'Available for registered accounts.')}
            </p>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1.5">{t('الاسم', 'Name')}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1.5">{t('الهاتف (+249)', 'Phone (+249)')}</label>
                <input
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono-num text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1.5">{t('البريد الإلكتروني', 'Email')}</label>
                <input
                  dir="ltr"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>
              <button
                type="submit"
                style={{ backgroundColor: appearance.primaryColor }}
                className="min-h-[44px] px-6 rounded-xl text-white font-bold"
              >
                {t('حفظ التعديلات', 'Save Changes')}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Tab 2: Saved Addresses */}
      {sectionTab === 'addresses' && (
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 text-xs">
          <h2 className="text-base font-bold">{t('العناوين المحفوظة', 'Saved Addresses')}</h2>
          {isGuest ? (
            <p className="text-slate-600 dark:text-slate-400">
              {t('العناوين المحفوظة متاحة للحسابات المسجلة.', 'Available for registered accounts.')}
            </p>
          ) : (
            <>
              {user.addresses.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {user.addresses.map((a) => {
                    const st = settings.deliveryFees.find((s) => s.id === a.stateId);
                    return (
                      <div key={a.id} className="py-3 first:pt-0 flex justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="font-bold flex items-center gap-2">
                            <span>{a.recipientName || user.name} ({a.label})</span>
                            {a.isDefault && (
                              <span className="px-1.5 py-0.5 rounded bg-[#11223E] text-white text-[10px]">
                                {t('افتراضي', 'Default')}
                              </span>
                            )}
                          </div>
                          <div className="font-mono-num text-[11px] text-slate-500" dir="ltr">{a.phone}</div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {locale === 'ar' ? st?.nameAr : st?.nameEn} — {a.city}, {a.area} — {a.details}
                          </div>
                          {!a.isDefault && (
                            <button
                              type="button"
                              onClick={() => setDefaultAddress(a.id)}
                              className="text-[11px] font-bold text-[#B38B2D] hover:underline pt-1"
                            >
                              {t('تعيين كافتراضي', 'Set Default')}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteAddress(a.id)}
                          aria-label={t('حذف العنوان', 'Delete address')}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-rose-600 self-start"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleAddAddress} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="font-bold text-sm">{t('إضافة عنوان جديد', 'Add New Address')}</div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <input required value={addrRecipient} onChange={(e) => setAddrRecipient(e.target.value)} placeholder={t('اسم المستلم', 'Recipient')} className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" />
                  <input required value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} placeholder={t('التسمية (المنزل / العمل)', 'Label')} className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" />
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <input required dir="ltr" value={addrPhone} onChange={(e) => setAddrPhone(e.target.value)} placeholder="0912345678 / +249..." className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono-num text-sm" />
                  <select value={addrState} onChange={(e) => setAddrState(e.target.value)} className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm">
                    {settings.deliveryFees.map((s) => (
                      <option key={s.id} value={s.id}>
                        {locale === 'ar' ? s.nameAr : s.nameEn} ({formatSdg(s.feeSdg)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <input required value={addrCity} onChange={(e) => setAddrCity(e.target.value)} placeholder={t('المدينة', 'City')} className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" />
                  <input required value={addrArea} onChange={(e) => setAddrArea(e.target.value)} placeholder={t('الحي', 'Area')} className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" />
                </div>
                <input required value={addrDetails} onChange={(e) => setAddrDetails(e.target.value)} placeholder={t('الشارع وأقرب معلم', 'Details / Landmark')} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" />
                <input dir="ltr" type="url" value={addrMapUrl} onChange={(e) => setAddrMapUrl(e.target.value)} placeholder={t('رابط الخريطة (اختياري)', 'Map URL (optional)')} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" />
                <label className="min-h-[40px] flex items-center gap-2 cursor-pointer font-semibold">
                  <input type="checkbox" checked={addrDefault} onChange={(e) => setAddrDefault(e.target.checked)} className="w-4 h-4 accent-[#D9B24C]" />
                  <span>{t('اجعله العنوان الافتراضي', 'Set as default')}</span>
                </label>
                <button
                  type="submit"
                  style={{ backgroundColor: appearance.primaryColor }}
                  className="min-h-[44px] px-6 rounded-xl text-white font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {t('إضافة عنوان', 'Add Address')}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Tab 3: Saved Prescriptions */}
      {sectionTab === 'rx' && (
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 text-xs">
          <h2 className="text-base font-bold">{t('وصفات النظر المحفوظة', 'Saved Prescriptions (Rx)')}</h2>
          {isGuest ? (
            <p className="text-slate-600 dark:text-slate-400">
              {t('حفظ وصفات النظر متاح للحسابات المسجلة.', 'Available for registered accounts.')}
            </p>
          ) : (
            <>
              {user.prescriptions.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {user.prescriptions.map((rx) => (
                    <div key={rx.id} className="py-3 first:pt-0 flex justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm">{rx.label}</div>
                        <div className="font-mono-num text-[11px] text-[#B38B2D] dark:text-[#E2BD5B]">
                          OD: {rx.rightEye.sph} / {rx.rightEye.cyl} × {rx.rightEye.axis}°
                        </div>
                        <div className="font-mono-num text-[11px] text-[#B38B2D] dark:text-[#E2BD5B]">
                          OS: {rx.leftEye.sph} / {rx.leftEye.cyl} × {rx.leftEye.axis}° · PD {rx.pd}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deletePrescription(rx.id)}
                        aria-label={t('حذف الوصفة', 'Delete prescription')}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-rose-600 self-start"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddRx} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="font-bold text-sm">{t('حفظ وصفة جديدة', 'Save New Rx')}</div>
                <input required value={rxLabel} onChange={(e) => setRxLabel(e.target.value)} placeholder={t('اسم الوصفة (مثلاً: كشف 2026)', 'Rx Label')} className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" />
                <div className="grid grid-cols-4 gap-2 items-center font-mono-num">
                  <span className="font-bold">OD</span>
                  <select value={odSph} onChange={(e) => setOdSph(e.target.value)} className="min-h-[42px] p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm">
                    {SPH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={odCyl} onChange={(e) => setOdCyl(e.target.value)} className="min-h-[42px] p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm">
                    {CYL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select disabled={!isNonZeroCyl(odCyl)} value={odAxis} onChange={(e) => setOdAxis(e.target.value)} className="min-h-[42px] p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm disabled:opacity-45">
                    {AXIS_OPTIONS.map((o) => <option key={o} value={o}>{o}°</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center font-mono-num">
                  <span className="font-bold">OS</span>
                  <select value={osSph} onChange={(e) => setOsSph(e.target.value)} className="min-h-[42px] p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm">
                    {SPH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={osCyl} onChange={(e) => setOsCyl(e.target.value)} className="min-h-[42px] p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm">
                    {CYL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select disabled={!isNonZeroCyl(osCyl)} value={osAxis} onChange={(e) => setOsAxis(e.target.value)} className="min-h-[42px] p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm disabled:opacity-45">
                    {AXIS_OPTIONS.map((o) => <option key={o} value={o}>{o}°</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">PD (mm)</span>
                  <select value={pd} onChange={(e) => setPd(e.target.value)} className="flex-1 min-h-[42px] p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono-num text-sm">
                    {PD_SINGLE_OPTIONS.map((o) => <option key={o} value={o}>{o} mm</option>)}
                  </select>
                </div>
                <button
                  type="submit"
                  style={{ backgroundColor: appearance.primaryColor }}
                  className="min-h-[44px] px-6 rounded-xl text-white font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {t('حفظ الوصفة', 'Save New Rx')}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const ContactAboutView: React.FC = () => {
  const { locale, t, settings, appTexts, appearance } = useStore();

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

  const visibleFaqs = appTexts.faq.filter((f) => f.visible);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">
          {t(`عن ${settings.storeNameAr} والتواصل`, `About ${settings.storeNameEn} & Policies`)}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {locale === 'ar' ? appTexts.aboutUsAr : appTexts.aboutUsEn}
        </p>
      </div>

      <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-5 text-sm">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 shrink-0 mt-0.5" style={{ color: appearance.secondaryColor }} />
          <div>
            <h2 className="font-bold">{t('عنوان المتجر', 'Store Address')}</h2>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              {locale === 'ar' ? settings.addressAr : settings.addressEn}
            </p>
            <a
              href={settings.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#B38B2D] hover:underline"
            >
              {t('فتح الموقع على الخريطة', 'Open in Google Maps')}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 shrink-0 mt-0.5" style={{ color: appearance.secondaryColor }} />
          <div>
            <h2 className="font-bold">{t('ساعات العمل', 'Working Hours')}</h2>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              {locale === 'ar' ? settings.workingHoursAr : settings.workingHoursEn}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Phone className="w-5 h-5 shrink-0 mt-0.5" style={{ color: appearance.secondaryColor }} />
          <div className="space-y-2">
            <h2 className="font-bold">{t('الهاتف والواتساب', 'Phone & WhatsApp')}</h2>
            <div className="flex flex-wrap gap-2">
              <a
                href={`tel:${settings.phone}`}
                dir="ltr"
                className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-mono-num text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                {settings.phone}
              </a>
              <a
                href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-4 rounded-xl bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {t('واتساب', 'Chat on WhatsApp')}
              </a>
            </div>
          </div>
        </div>

        {socialItems.length > 0 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="font-bold mb-2.5">{t('حسابات التواصل الاجتماعي', 'Social Media')}</h2>
            <div className="flex flex-wrap gap-2">
              {socialItems.map((s) => (
                <a
                  key={s.key}
                  href={s.item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold hover:border-[var(--vp-secondary)]"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Policies */}
      <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
        <div className="pb-4 space-y-1.5">
          <h3 className="font-bold text-sm flex items-center gap-1.5">
            <FileText className="w-4 h-4" style={{ color: appearance.secondaryColor }} />
            {t('سياسة الخصوصية', 'Privacy Policy')}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {locale === 'ar' ? appTexts.privacyPolicyAr : appTexts.privacyPolicyEn}
          </p>
        </div>
        <div className="py-4 space-y-1.5">
          <h3 className="font-bold text-sm flex items-center gap-1.5">
            <FileText className="w-4 h-4" style={{ color: appearance.secondaryColor }} />
            {t('الشروط والأحكام', 'Terms & Conditions')}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {locale === 'ar' ? appTexts.termsConditionsAr : appTexts.termsConditionsEn}
          </p>
        </div>
        <div className="pt-4 space-y-1.5">
          <h3 className="font-bold text-sm flex items-center gap-1.5">
            <FileText className="w-4 h-4" style={{ color: appearance.secondaryColor }} />
            {t('سياسة الإرجاع والاستبدال', 'Return Policy')}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {locale === 'ar' ? appTexts.returnPolicyAr : appTexts.returnPolicyEn}
          </p>
        </div>
      </div>

      {/* FAQ */}
      {visibleFaqs.length > 0 && (
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <HelpCircle className="w-5 h-5" style={{ color: appearance.secondaryColor }} />
            {t('الأسئلة الشائعة', 'Frequently Asked Questions')}
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {visibleFaqs.map((f) => (
              <div key={f.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="font-bold text-sm">
                  {locale === 'ar' ? f.questionAr : f.questionEn}
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {locale === 'ar' ? f.answerAr : f.answerEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
