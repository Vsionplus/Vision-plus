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
  LogIn,
  UserPlus,
  LogOut,
  MailCheck,
  MailWarning,
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
    openAuthModal,
    openVerifyEmailScreen,
    logout,
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
    if (!addrLabel.trim() || !addrCity.trim()) return;
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
      openAuthModal('login', false);
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{t('حسابي والوصفات المحفوظة', 'Profile & Saved Prescriptions')}</h1>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
            {t('إدارة بياناتك وعناوينك في السودان وقياسات النظر لإعادة الطلب بسهولة', 'Manage Sudan delivery addresses and reusable optical prescriptions')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PWAInstallButton variant="profile" />
          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className="min-h-[44px] px-3.5 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] text-xs font-semibold"
          >
            {t('المفضلة', 'Favorites')} ({user.favoriteProductIds.length})
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="min-h-[44px] px-3.5 py-2 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 bg-white dark:bg-[#181B1E] text-xs font-bold inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('تسجيل الخروج', 'Sign Out')}
          </button>
        </div>
      </div>

      {/* Auth / Verification Status Card */}
      {isGuest ? (
        <div className="bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold">
              {t('أنت داخل كضيف، سجّل دخولك لإتمام الشراء', 'Browsing as Guest')}
            </h2>
            <p className="text-xs text-stone-600 dark:text-zinc-400">
              {t(
                'سجّل دخولك أو أنشئ حساباً جديداً الآن لحفظ سلتك ومقاساتك وعناوينك وإتمام الطلبات.',
                'Sign in or register to save your cart, prescriptions, addresses, and complete orders.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openAuthModal('login', false)}
              style={{ backgroundColor: appearance.primaryColor }}
              className="min-h-[44px] px-4 rounded-xl text-white text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              {t('تسجيل الدخول', 'Sign In')}
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('register', false)}
              style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
              className="min-h-[44px] px-4 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              {t('إنشاء حساب جديد', 'Create Account')}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            {isEmailVerified ? (
              <MailCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <MailWarning className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div>
              <div className="font-bold">
                {isEmailVerified
                  ? t('البريد الإلكتروني مؤكد ومفعل', 'Email Address Verified')
                  : t('البريد الإلكتروني بانتظار التأكيد', 'Email Verification Pending')}
              </div>
              <div dir="ltr" className="text-stone-500 dark:text-zinc-400 font-mono-num">
                {user.email}
              </div>
            </div>
          </div>
          {!isEmailVerified && (
            <button
              type="button"
              onClick={openVerifyEmailScreen}
              style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
              className="min-h-[44px] px-4 rounded-xl text-xs font-extrabold"
            >
              {t('تأكيد البريد الآن', 'Verify Email Now')}
            </button>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 text-xs">
          <h2 className="text-base font-bold">{t('البيانات الشخصية', 'Account Details')}</h2>
          {isGuest ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 space-y-3">
              <p className="font-bold text-[#11223E] dark:text-amber-200">
                {t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature')}
              </p>
              <button
                type="button"
                onClick={() => openAuthModal('login', false)}
                style={{ backgroundColor: appearance.primaryColor }}
                className="min-h-[44px] px-4 rounded-xl text-white font-bold inline-flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                {t('تسجيل الدخول', 'Sign In')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">{t('الاسم', 'Name')}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base" />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('الهاتف (+249)', 'Phone (+249)')}</label>
                <input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num text-base" />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('البريد الإلكتروني', 'Email')}</label>
                <input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base" />
              </div>
              <button type="submit" style={{ backgroundColor: appearance.primaryColor }} className="w-full min-h-[44px] py-2.5 rounded-lg text-white font-bold">
                {t('حفظ التعديلات', 'Save Changes')}
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 text-xs">
          <h2 className="text-base font-bold">{t('العناوين المحفوظة', 'Saved Addresses')}</h2>
          {isGuest ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 space-y-3">
              <p className="font-bold text-[#11223E] dark:text-amber-200">
                {t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature')}
              </p>
              <button
                type="button"
                onClick={() => openAuthModal('login', false)}
                style={{ backgroundColor: appearance.primaryColor }}
                className="min-h-[44px] px-4 rounded-xl text-white font-bold inline-flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                {t('تسجيل الدخول', 'Sign In')}
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {user.addresses.map((a) => {
                  const st = settings.deliveryFees.find((s) => s.id === a.stateId);
                  return (
                    <div key={a.id} className="p-3 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{a.recipientName || user.name} ({a.label})</span>
                          {a.isDefault && (
                            <span className="px-1.5 py-0.5 rounded bg-[#11223E] text-white text-[10px]">
                              {t('افتراضي', 'Default')}
                            </span>
                          )}
                        </div>
                        <div className="font-mono-num text-[11px] text-stone-500" dir="ltr">{a.phone}</div>
                        <div className="text-stone-500 dark:text-zinc-400">
                          {locale === 'ar' ? st?.nameAr : st?.nameEn} — {a.city}, {a.area}
                        </div>
                        <div className="text-stone-500 dark:text-zinc-400">{a.details}</div>
                        {!a.isDefault && (
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(a.id)}
                            className="min-h-[36px] text-[11px] font-bold text-[#B38B2D] hover:underline pt-1"
                          >
                            {t('تعيين كافتراضي', 'Set Default')}
                          </button>
                        )}
                      </div>
                      <button type="button" onClick={() => deleteAddress(a.id)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-rose-600 self-start">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleAddAddress} className="space-y-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                <div className="grid grid-cols-2 gap-2">
                  <input required value={addrRecipient} onChange={(e) => setAddrRecipient(e.target.value)} placeholder={t('اسم المستلم', 'Recipient')} className="min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base" />
                  <input required value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} placeholder={t('التسمية (المنزل)', 'Label')} className="min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base" />
                </div>
                <input required dir="ltr" value={addrPhone} onChange={(e) => setAddrPhone(e.target.value)} placeholder="0912345678 / +249..." className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num text-base" />
                <select value={addrState} onChange={(e) => setAddrState(e.target.value)} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base">
                  {settings.deliveryFees.map((s) => (
                    <option key={s.id} value={s.id}>
                      {locale === 'ar' ? s.nameAr : s.nameEn} ({formatSdg(s.feeSdg)})
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input required value={addrCity} onChange={(e) => setAddrCity(e.target.value)} placeholder={t('المدينة', 'City')} className="min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base" />
                  <input required value={addrArea} onChange={(e) => setAddrArea(e.target.value)} placeholder={t('الحي', 'Area')} className="min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base" />
                </div>
                <input required value={addrDetails} onChange={(e) => setAddrDetails(e.target.value)} placeholder={t('الشارع وأقرب معلم', 'Details / Landmark')} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base" />
                <input dir="ltr" type="url" value={addrMapUrl} onChange={(e) => setAddrMapUrl(e.target.value)} placeholder={t('رابط الخريطة (اختياري)', 'Map URL (optional)')} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base" />
                <label className="min-h-[44px] flex items-center gap-2 cursor-pointer font-semibold">
                  <input type="checkbox" checked={addrDefault} onChange={(e) => setAddrDefault(e.target.checked)} className="w-4 h-4 accent-[#D9B24C]" />
                  <span>{t('اجعله العنوان الافتراضي', 'Set as default')}</span>
                </label>
                <button type="submit" className="w-full min-h-[44px] py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold inline-flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" />
                  {t('إضافة عنوان', 'Add Address')}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 text-xs">
          <h2 className="text-base font-bold">{t('وصفات النظر المحفوظة', 'Saved Prescriptions (Rx)')}</h2>
          {isGuest ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 space-y-3">
              <p className="font-bold text-[#11223E] dark:text-amber-200">
                {t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature')}
              </p>
              <button
                type="button"
                onClick={() => openAuthModal('login', false)}
                style={{ backgroundColor: appearance.primaryColor }}
                className="min-h-[44px] px-4 rounded-xl text-white font-bold inline-flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                {t('تسجيل الدخول', 'Sign In')}
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {user.prescriptions.map((rx) => (
                  <div key={rx.id} className="p-3 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-bold">{rx.label}</div>
                      <div className="font-mono-num text-[11px] text-[#B38B2D]">
                        OD: {rx.rightEye.sph} / {rx.rightEye.cyl} × {rx.rightEye.axis}°
                      </div>
                      <div className="font-mono-num text-[11px] text-[#B38B2D]">
                        OS: {rx.leftEye.sph} / {rx.leftEye.cyl} × {rx.leftEye.axis}° · PD {rx.pd}
                      </div>
                    </div>
                    <button type="button" onClick={() => deletePrescription(rx.id)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-stone-400 hover:text-rose-600 self-start">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddRx} className="space-y-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                <input required value={rxLabel} onChange={(e) => setRxLabel(e.target.value)} placeholder={t('اسم الوصفة (مثلاً: كشف 2026)', 'Rx Label')} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base" />
                <div className="grid grid-cols-4 gap-1.5 items-center font-mono-num">
                  <span className="font-bold">OD</span>
                  <select value={odSph} onChange={(e) => setOdSph(e.target.value)} className="min-h-[44px] p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base">
                    {SPH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={odCyl} onChange={(e) => setOdCyl(e.target.value)} className="min-h-[44px] p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base">
                    {CYL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select disabled={!isNonZeroCyl(odCyl)} value={odAxis} onChange={(e) => setOdAxis(e.target.value)} className="min-h-[44px] p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base disabled:opacity-45">
                    {AXIS_OPTIONS.map((o) => <option key={o} value={o}>{o}°</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-4 gap-1.5 items-center font-mono-num">
                  <span className="font-bold">OS</span>
                  <select value={osSph} onChange={(e) => setOsSph(e.target.value)} className="min-h-[44px] p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base">
                    {SPH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={osCyl} onChange={(e) => setOsCyl(e.target.value)} className="min-h-[44px] p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base">
                    {CYL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select disabled={!isNonZeroCyl(osCyl)} value={osAxis} onChange={(e) => setOsAxis(e.target.value)} className="min-h-[44px] p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base disabled:opacity-45">
                    {AXIS_OPTIONS.map((o) => <option key={o} value={o}>{o}°</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">PD (mm)</span>
                  <select value={pd} onChange={(e) => setPd(e.target.value)} className="flex-1 min-h-[44px] p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num text-base">
                    {PD_SINGLE_OPTIONS.map((o) => <option key={o} value={o}>{o} mm</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full min-h-[44px] py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold inline-flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" />
                  {t('حفظ وصفة جديدة', 'Save New Rx')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">
          {t(`عن ${settings.storeNameAr} والتواصل`, `About ${settings.storeNameEn} & Policies`)}
        </h1>
        <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
          {locale === 'ar' ? appTexts.aboutUsAr : appTexts.aboutUsEn}
        </p>
      </div>

      <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5 text-sm">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 shrink-0 mt-0.5" style={{ color: appearance.secondaryColor }} />
          <div>
            <h2 className="font-bold">{t('عنوان المتجر', 'Store Address')}</h2>
            <p className="text-stone-600 dark:text-zinc-400 mt-0.5">
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
            <p className="text-stone-600 dark:text-zinc-400 mt-0.5">
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
                className="px-4 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 font-mono-num text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                {settings.phone}
              </a>
              <a
                href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {t('تواصل عبر واتساب', 'Chat on WhatsApp')}
              </a>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 dark:border-zinc-800">
          <h2 className="font-bold mb-3">{t('حسابات التواصل الاجتماعي', 'Social Media')}</h2>
          <div className="flex flex-wrap gap-2">
            {socialItems.map((s) => (
              <a
                key={s.key}
                href={s.item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs font-semibold hover:border-[var(--vp-secondary)]"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Policies managed dynamically from Admin */}
      <div className="grid md:grid-cols-3 gap-4 text-xs">
        <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4 space-y-1.5">
          <h3 className="font-bold flex items-center gap-1.5">
            <FileText className="w-4 h-4" style={{ color: appearance.secondaryColor }} />
            {t('سياسة الخصوصية', 'Privacy Policy')}
          </h3>
          <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
            {locale === 'ar' ? appTexts.privacyPolicyAr : appTexts.privacyPolicyEn}
          </p>
        </div>
        <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4 space-y-1.5">
          <h3 className="font-bold flex items-center gap-1.5">
            <FileText className="w-4 h-4" style={{ color: appearance.secondaryColor }} />
            {t('الشروط والأحكام', 'Terms & Conditions')}
          </h3>
          <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
            {locale === 'ar' ? appTexts.termsConditionsAr : appTexts.termsConditionsEn}
          </p>
        </div>
        <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4 space-y-1.5">
          <h3 className="font-bold flex items-center gap-1.5">
            <FileText className="w-4 h-4" style={{ color: appearance.secondaryColor }} />
            {t('سياسة الإرجاع والاستبدال', 'Return Policy')}
          </h3>
          <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
            {locale === 'ar' ? appTexts.returnPolicyAr : appTexts.returnPolicyEn}
          </p>
        </div>
      </div>

      {/* FAQ Section managed dynamically from Admin */}
      {visibleFaqs.length > 0 && (
        <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <HelpCircle className="w-5 h-5" style={{ color: appearance.secondaryColor }} />
            {t('الأسئلة الشائعة', 'Frequently Asked Questions')}
          </h2>
          <div className="divide-y divide-stone-100 dark:divide-zinc-800 text-xs">
            {visibleFaqs.map((f) => (
              <div key={f.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="font-bold text-sm">
                  {locale === 'ar' ? f.questionAr : f.questionEn}
                </div>
                <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
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
