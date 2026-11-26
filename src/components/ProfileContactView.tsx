import React, { useCallback, useEffect, useState } from 'react';
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
  ADD_OPTIONS,
  AXIS_OPTIONS,
  CYL_OPTIONS,
  PD_SINGLE_OPTIONS,
  SPH_OPTIONS,
  isNonZeroCyl,
  validateEyeglassesEye,
} from '../utils/prescription';
import { PWAInstallButton } from './PWAInstallButton';
import { FieldValidationRule, useFormValidation } from '../hooks/useFormValidation';
import { FieldError, ValidationSummaryBanner } from './FormValidationUI';
import { VALIDATION_MESSAGES, pickMsg } from '../utils/validationMessages';

export const ProfileView: React.FC = () => {
  const {
    locale,
    t,
    user,
    isGuest,
    isEmailVerified,
    openAuthModal,
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
  const [odAdd, setOdAdd] = useState('');
  const [osSph, setOsSph] = useState('-1.00');
  const [osCyl, setOsCyl] = useState('0.00');
  const [osAxis, setOsAxis] = useState('0');
  const [osAdd, setOsAdd] = useState('');
  const [pd, setPd] = useState('63');

  const profileVal = useFormValidation({ formId: 'profile-info' });
  const addrVal = useFormValidation({ formId: 'profile-address' });
  const rxVal = useFormValidation({ formId: 'profile-rx' });

  const buildProfileRules = useCallback((): FieldValidationRule[] => {
    const cleanEmail = email.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return [
      {
        field: 'name',
        label: t('الاسم', 'Name'),
        error: !name.trim() ? pickMsg(VALIDATION_MESSAGES.nameRequired, locale) : null,
      },
      {
        field: 'phone',
        label: t('رقم الهاتف', 'Phone'),
        error: !phone.trim()
          ? pickMsg(VALIDATION_MESSAGES.phoneRequired, locale)
          : !isValidSudanPhone(phone)
          ? pickMsg(VALIDATION_MESSAGES.phoneInvalidSudan, locale)
          : null,
      },
      {
        field: 'email',
        label: t('البريد الإلكتروني', 'Email'),
        error:
          cleanEmail && !emailPattern.test(cleanEmail)
            ? pickMsg(VALIDATION_MESSAGES.emailInvalid, locale)
            : null,
      },
    ];
  }, [name, phone, email, locale, t]);

  const buildAddressRules = useCallback((): FieldValidationRule[] => {
    const cleanMap = addrMapUrl.trim();
    const phoneToCheck = addrPhone.trim() || user.phone.trim();
    return [
      {
        field: 'addrRecipient',
        label: t('اسم المستلم', 'Recipient name'),
        error: !addrRecipient.trim()
          ? pickMsg(VALIDATION_MESSAGES.recipientNameRequired, locale)
          : null,
      },
      {
        field: 'addrLabel',
        label: t('تسمية العنوان', 'Address label'),
        error: !addrLabel.trim()
          ? pickMsg(VALIDATION_MESSAGES.addressLabelRequired, locale)
          : null,
      },
      {
        field: 'addrPhone',
        label: t('رقم هاتف التوصيل', 'Delivery phone'),
        error: !phoneToCheck
          ? pickMsg(VALIDATION_MESSAGES.phoneRequired, locale)
          : !isValidSudanPhone(phoneToCheck)
          ? pickMsg(VALIDATION_MESSAGES.phoneInvalidSudan, locale)
          : null,
      },
      {
        field: 'addrState',
        label: t('الولاية', 'State'),
        error: !addrState ? pickMsg(VALIDATION_MESSAGES.deliveryStateRequired, locale) : null,
      },
      {
        field: 'addrCity',
        label: t('المدينة', 'City'),
        error: !addrCity.trim() ? pickMsg(VALIDATION_MESSAGES.cityRequired, locale) : null,
      },
      {
        field: 'addrArea',
        label: t('الحي / المنطقة', 'Area'),
        error: !addrArea.trim() ? pickMsg(VALIDATION_MESSAGES.areaRequired, locale) : null,
      },
      {
        field: 'addrDetails',
        label: t('الشارع وأقرب معلم', 'Street details'),
        error: !addrDetails.trim()
          ? pickMsg(VALIDATION_MESSAGES.streetDetailsRequired, locale)
          : null,
      },
      {
        field: 'addrMapUrl',
        label: t('رابط الخريطة', 'Map URL'),
        error:
          cleanMap && !/^https?:\/\//i.test(cleanMap)
            ? pickMsg(VALIDATION_MESSAGES.mapUrlInvalid, locale)
            : null,
      },
    ];
  }, [
    addrRecipient,
    addrLabel,
    addrPhone,
    user.phone,
    addrState,
    addrCity,
    addrArea,
    addrDetails,
    addrMapUrl,
    locale,
    t,
  ]);

  const buildRxRules = useCallback((): FieldValidationRule[] => {
    return [
      {
        field: 'rxLabel',
        label: t('اسم الوصفة', 'Rx Label'),
        error: !rxLabel.trim() ? pickMsg(VALIDATION_MESSAGES.rxLabelRequired, locale) : null,
      },
      {
        field: 'odEye',
        label: t('العين اليمنى (OD)', 'Right Eye (OD)'),
        error: validateEyeglassesEye(
          {
            sph: odSph,
            cyl: odCyl,
            axis: isNonZeroCyl(odCyl) ? odAxis : '0',
            add: odAdd || undefined,
          },
          'العين اليمنى (OD)',
          'Right Eye (OD)',
          locale
        ),
      },
      {
        field: 'osEye',
        label: t('العين اليسرى (OS)', 'Left Eye (OS)'),
        error: validateEyeglassesEye(
          {
            sph: osSph,
            cyl: osCyl,
            axis: isNonZeroCyl(osCyl) ? osAxis : '0',
            add: osAdd || undefined,
          },
          'العين اليسرى (OS)',
          'Left Eye (OS)',
          locale
        ),
      },
    ];
  }, [rxLabel, odSph, odCyl, odAxis, odAdd, osSph, osCyl, osAxis, osAdd, locale, t]);

  useEffect(() => {
    if (profileVal.submitted) profileVal.revalidate(buildProfileRules());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileVal.submitted, buildProfileRules]);

  useEffect(() => {
    if (addrVal.submitted) addrVal.revalidate(buildAddressRules());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrVal.submitted, buildAddressRules]);

  useEffect(() => {
    if (rxVal.submitted) rxVal.revalidate(buildRxRules());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rxVal.submitted, buildRxRules]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileVal.validateAll(buildProfileRules())) return;
    updateProfile(name.trim(), normalizeSudanPhone(phone), email.trim());
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrVal.validateAll(buildAddressRules())) return;
    const phoneToUse = addrPhone.trim() || user.phone;
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
    addrVal.reset();
  };

  const handleAddRx = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      showToast(t('هذه الميزة متاحة للحسابات المسجلة فقط', 'Available for registered accounts'));
      return;
    }
    if (!rxVal.validateAll(buildRxRules())) return;
    savePrescription({
      label: rxLabel.trim(),
      kind: 'eyeglasses',
      rightEye: {
        sph: odSph,
        cyl: odCyl,
        axis: isNonZeroCyl(odCyl) ? odAxis : '0',
        add: odAdd || undefined,
      },
      leftEye: {
        sph: osSph,
        cyl: osCyl,
        axis: isNonZeroCyl(osCyl) ? osAxis : '0',
        add: osAdd || undefined,
      },
      pd,
    });
    setRxLabel('');
    setOdAdd('');
    setOsAdd('');
    rxVal.reset();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">
            {t('حسابي والوصفات', 'Profile & Prescriptions')}
          </h1>
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

      {isGuest ? (
        <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-bold text-sm">{t('أنت تتصفح كضيف', 'Browsing as Guest')}</div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
              {t('سجّل دخولك أو أنشئ حساباً لحفظ عناوينك ووصفات النظر وطلباتك.', 'Sign in or create an account to save addresses, Rx, and orders.')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('choice', false)}
            style={{ backgroundColor: appearance.primaryColor }}
            className="min-h-[40px] px-4 rounded-xl text-white text-xs font-extrabold shrink-0"
          >
            {t('تسجيل الدخول / حساب جديد', 'Sign In / Register')}
          </button>
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

      {/* Clean 3-Tab Switcher */}
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
            <form noValidate onSubmit={handleSaveProfile} className="space-y-4">
              <ValidationSummaryBanner
                errors={profileVal.errors}
                onSelectField={profileVal.focusField}
                mode="form"
              />
              <div {...profileVal.getFieldWrapperProps('name')}>
                <label className="block font-semibold mb-1.5">{t('الاسم *', 'Name *')}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  {...profileVal.getInputA11yProps('name')}
                  className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${profileVal.getControlClasses(
                    'name',
                    'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                  )}`}
                />
                <FieldError
                  id={profileVal.getErrorId('name')}
                  message={profileVal.getError('name')}
                />
              </div>
              <div {...profileVal.getFieldWrapperProps('phone')}>
                <label className="block font-semibold mb-1.5">{t('الهاتف (+249) *', 'Phone (+249) *')}</label>
                <input
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  {...profileVal.getInputA11yProps('phone')}
                  className={`w-full min-h-[44px] px-3 rounded-xl font-mono-num text-sm ${profileVal.getControlClasses(
                    'phone',
                    'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                  )}`}
                />
                <FieldError
                  id={profileVal.getErrorId('phone')}
                  message={profileVal.getError('phone')}
                />
              </div>
              <div {...profileVal.getFieldWrapperProps('email')}>
                <label className="block font-semibold mb-1.5">{t('البريد الإلكتروني', 'Email')}</label>
                <input
                  dir="ltr"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  {...profileVal.getInputA11yProps('email')}
                  className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${profileVal.getControlClasses(
                    'email',
                    'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                  )}`}
                />
                <FieldError
                  id={profileVal.getErrorId('email')}
                  message={profileVal.getError('email')}
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

              <form noValidate onSubmit={handleAddAddress} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="font-bold text-sm">{t('إضافة عنوان جديد', 'Add New Address')}</div>
                <ValidationSummaryBanner
                  errors={addrVal.errors}
                  onSelectField={addrVal.focusField}
                  mode="form"
                />
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div {...addrVal.getFieldWrapperProps('addrRecipient')}>
                    <input
                      value={addrRecipient}
                      onChange={(e) => setAddrRecipient(e.target.value)}
                      placeholder={t('اسم المستلم *', 'Recipient *')}
                      {...addrVal.getInputA11yProps('addrRecipient')}
                      className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${addrVal.getControlClasses(
                        'addrRecipient',
                        'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                      )}`}
                    />
                    <FieldError
                      id={addrVal.getErrorId('addrRecipient')}
                      message={addrVal.getError('addrRecipient')}
                    />
                  </div>
                  <div {...addrVal.getFieldWrapperProps('addrLabel')}>
                    <input
                      value={addrLabel}
                      onChange={(e) => setAddrLabel(e.target.value)}
                      placeholder={t('التسمية (المنزل / العمل) *', 'Label *')}
                      {...addrVal.getInputA11yProps('addrLabel')}
                      className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${addrVal.getControlClasses(
                        'addrLabel',
                        'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                      )}`}
                    />
                    <FieldError
                      id={addrVal.getErrorId('addrLabel')}
                      message={addrVal.getError('addrLabel')}
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div {...addrVal.getFieldWrapperProps('addrPhone')}>
                    <input
                      dir="ltr"
                      value={addrPhone}
                      onChange={(e) => setAddrPhone(e.target.value)}
                      placeholder="0912345678 / +249... *"
                      {...addrVal.getInputA11yProps('addrPhone')}
                      className={`w-full min-h-[44px] px-3 rounded-xl font-mono-num text-sm ${addrVal.getControlClasses(
                        'addrPhone',
                        'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                      )}`}
                    />
                    <FieldError
                      id={addrVal.getErrorId('addrPhone')}
                      message={addrVal.getError('addrPhone')}
                    />
                  </div>
                  <div {...addrVal.getFieldWrapperProps('addrState')}>
                    <select
                      value={addrState}
                      onChange={(e) => setAddrState(e.target.value)}
                      {...addrVal.getInputA11yProps('addrState')}
                      className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${addrVal.getControlClasses(
                        'addrState',
                        'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                      )}`}
                    >
                      {settings.deliveryFees.map((s) => (
                        <option key={s.id} value={s.id}>
                          {locale === 'ar' ? s.nameAr : s.nameEn} ({formatSdg(s.feeSdg)})
                        </option>
                      ))}
                    </select>
                    <FieldError
                      id={addrVal.getErrorId('addrState')}
                      message={addrVal.getError('addrState')}
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <div {...addrVal.getFieldWrapperProps('addrCity')}>
                    <input
                      value={addrCity}
                      onChange={(e) => setAddrCity(e.target.value)}
                      placeholder={t('المدينة *', 'City *')}
                      {...addrVal.getInputA11yProps('addrCity')}
                      className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${addrVal.getControlClasses(
                        'addrCity',
                        'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                      )}`}
                    />
                    <FieldError
                      id={addrVal.getErrorId('addrCity')}
                      message={addrVal.getError('addrCity')}
                    />
                  </div>
                  <div {...addrVal.getFieldWrapperProps('addrArea')}>
                    <input
                      value={addrArea}
                      onChange={(e) => setAddrArea(e.target.value)}
                      placeholder={t('الحي *', 'Area *')}
                      {...addrVal.getInputA11yProps('addrArea')}
                      className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${addrVal.getControlClasses(
                        'addrArea',
                        'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                      )}`}
                    />
                    <FieldError
                      id={addrVal.getErrorId('addrArea')}
                      message={addrVal.getError('addrArea')}
                    />
                  </div>
                </div>
                <div {...addrVal.getFieldWrapperProps('addrDetails')}>
                  <input
                    value={addrDetails}
                    onChange={(e) => setAddrDetails(e.target.value)}
                    placeholder={t('الشارع وأقرب معلم *', 'Details / Landmark *')}
                    {...addrVal.getInputA11yProps('addrDetails')}
                    className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${addrVal.getControlClasses(
                      'addrDetails',
                      'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    )}`}
                  />
                  <FieldError
                    id={addrVal.getErrorId('addrDetails')}
                    message={addrVal.getError('addrDetails')}
                  />
                </div>
                <div {...addrVal.getFieldWrapperProps('addrMapUrl')}>
                  <input
                    dir="ltr"
                    type="url"
                    value={addrMapUrl}
                    onChange={(e) => setAddrMapUrl(e.target.value)}
                    placeholder={t('رابط الخريطة (اختياري)', 'Map URL (optional)')}
                    {...addrVal.getInputA11yProps('addrMapUrl')}
                    className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${addrVal.getControlClasses(
                      'addrMapUrl',
                      'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    )}`}
                  />
                  <FieldError
                    id={addrVal.getErrorId('addrMapUrl')}
                    message={addrVal.getError('addrMapUrl')}
                  />
                </div>
                <label className="min-h-[44px] flex items-center gap-2 cursor-pointer font-semibold">
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
                          {rx.rightEye.add ? ` · ADD ${rx.rightEye.add}` : ''}
                        </div>
                        <div className="font-mono-num text-[11px] text-[#B38B2D] dark:text-[#E2BD5B]">
                          OS: {rx.leftEye.sph} / {rx.leftEye.cyl} × {rx.leftEye.axis}°
                          {rx.leftEye.add ? ` · ADD ${rx.leftEye.add}` : ''} · PD {rx.pd}
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

              <form noValidate onSubmit={handleAddRx} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="font-bold text-sm">{t('حفظ وصفة جديدة', 'Save New Rx')}</div>
                <ValidationSummaryBanner
                  errors={rxVal.errors}
                  onSelectField={rxVal.focusField}
                  mode="form"
                />
                <div {...rxVal.getFieldWrapperProps('rxLabel')}>
                  <input
                    value={rxLabel}
                    onChange={(e) => setRxLabel(e.target.value)}
                    placeholder={t('اسم الوصفة (مثلاً: كشف 2026) *', 'Rx Label *')}
                    {...rxVal.getInputA11yProps('rxLabel')}
                    className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${rxVal.getControlClasses(
                      'rxLabel',
                      'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    )}`}
                  />
                  <FieldError
                    id={rxVal.getErrorId('rxLabel')}
                    message={rxVal.getError('rxLabel')}
                  />
                </div>
                <div
                  {...rxVal.getFieldWrapperProps('odEye')}
                  className={rxVal.getControlClasses('odEye', 'space-y-1.5', 'p-2.5 rounded-xl space-y-1.5')}
                >
                  <div className="grid grid-cols-5 gap-1.5 items-center font-mono-num">
                    <span className="font-bold">OD</span>
                    <select value={odSph} onChange={(e) => setOdSph(e.target.value)} className="min-h-[44px] p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm">
                      {SPH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={odCyl} onChange={(e) => setOdCyl(e.target.value)} className="min-h-[44px] p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm">
                      {CYL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select
                      disabled={!isNonZeroCyl(odCyl)}
                      value={odAxis}
                      aria-invalid={rxVal.hasError('odEye') && isNonZeroCyl(odCyl) ? true : undefined}
                      onChange={(e) => setOdAxis(e.target.value)}
                      className={`min-h-[44px] p-1.5 rounded-xl font-mono-num text-xs sm:text-sm disabled:opacity-45 ${
                        rxVal.hasError('odEye') && isNonZeroCyl(odCyl)
                          ? 'border-2 border-[#DC2626] bg-[#FEF2F2] dark:bg-rose-950/30'
                          : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                      }`}
                    >
                      {AXIS_OPTIONS.map((o) => <option key={o} value={o}>{o}°</option>)}
                    </select>
                    <select value={odAdd} onChange={(e) => setOdAdd(e.target.value)} aria-label="OD ADD" className="min-h-[44px] p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm">
                      <option value="">ADD</option>
                      {ADD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <FieldError
                    id={rxVal.getErrorId('odEye')}
                    message={rxVal.getError('odEye')}
                  />
                </div>
                <div
                  {...rxVal.getFieldWrapperProps('osEye')}
                  className={rxVal.getControlClasses('osEye', 'space-y-1.5', 'p-2.5 rounded-xl space-y-1.5')}
                >
                  <div className="grid grid-cols-5 gap-1.5 items-center font-mono-num">
                    <span className="font-bold">OS</span>
                    <select value={osSph} onChange={(e) => setOsSph(e.target.value)} className="min-h-[44px] p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm">
                      {SPH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={osCyl} onChange={(e) => setOsCyl(e.target.value)} className="min-h-[44px] p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm">
                      {CYL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select
                      disabled={!isNonZeroCyl(osCyl)}
                      value={osAxis}
                      aria-invalid={rxVal.hasError('osEye') && isNonZeroCyl(osCyl) ? true : undefined}
                      onChange={(e) => setOsAxis(e.target.value)}
                      className={`min-h-[44px] p-1.5 rounded-xl font-mono-num text-xs sm:text-sm disabled:opacity-45 ${
                        rxVal.hasError('osEye') && isNonZeroCyl(osCyl)
                          ? 'border-2 border-[#DC2626] bg-[#FEF2F2] dark:bg-rose-950/30'
                          : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                      }`}
                    >
                      {AXIS_OPTIONS.map((o) => <option key={o} value={o}>{o}°</option>)}
                    </select>
                    <select value={osAdd} onChange={(e) => setOsAdd(e.target.value)} aria-label="OS ADD" className="min-h-[44px] p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm">
                      <option value="">ADD</option>
                      {ADD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <FieldError
                    id={rxVal.getErrorId('osEye')}
                    message={rxVal.getError('osEye')}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">PD (mm)</span>
                  <select value={pd} onChange={(e) => setPd(e.target.value)} className="flex-1 min-h-[44px] p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono-num text-sm">
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
