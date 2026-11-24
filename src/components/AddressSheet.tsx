import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  ExternalLink,
  LogIn,
  MapPin,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { SavedAddress } from '../types';
import { formatSdg, isValidSudanPhone, normalizeSudanPhone } from '../utils/format';

interface AddressSheetProps {
  open: boolean;
  selectedAddressId?: string | null;
  initialEditAddress?: SavedAddress | null;
  onClose: () => void;
  onSelectAddress: (addr: SavedAddress) => void;
}

export const AddressSheet: React.FC<AddressSheetProps> = ({
  open,
  selectedAddressId,
  initialEditAddress,
  onClose,
  onSelectAddress,
}) => {
  const {
    locale,
    t,
    user,
    isGuest,
    settings,
    appearance,
    openAuthModal,
    saveAddress,
    updateAddress,
    setDefaultAddress,
    deleteAddress,
    showToast,
  } = useStore();

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [stateId, setStateId] = useState('khartoum');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [details, setDetails] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (initialEditAddress) {
      setMode('form');
      setEditingId(initialEditAddress.id);
      setLabel(initialEditAddress.label || '');
      setRecipientName(initialEditAddress.recipientName || user.name || '');
      setPhone(initialEditAddress.phone || user.phone || '');
      setStateId(initialEditAddress.stateId || settings.deliveryFees[0]?.id || 'khartoum');
      setCity(initialEditAddress.city || '');
      setArea(initialEditAddress.area || '');
      setDetails(initialEditAddress.details || '');
      setMapUrl(initialEditAddress.mapUrl || '');
      setIsDefault(Boolean(initialEditAddress.isDefault));
    } else if (user.addresses.length === 0) {
      setMode('form');
      setEditingId(null);
      setLabel(t('المنزل', 'Home'));
      setRecipientName(isGuest ? '' : user.name || '');
      setPhone(isGuest ? '' : user.phone || '');
      setStateId(settings.deliveryFees[0]?.id || 'khartoum');
      setCity('');
      setArea('');
      setDetails('');
      setMapUrl('');
      setIsDefault(true);
    } else {
      setMode('list');
      setEditingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialEditAddress]);

  if (!open) return null;

  const startNewForm = () => {
    setFormError(null);
    setEditingId(null);
    setLabel(t('المنزل', 'Home'));
    setRecipientName(isGuest ? '' : user.name || '');
    setPhone(isGuest ? '' : user.phone || '');
    setStateId(settings.deliveryFees[0]?.id || 'khartoum');
    setCity('');
    setArea('');
    setDetails('');
    setMapUrl('');
    setIsDefault(user.addresses.length === 0);
    setMode('form');
  };

  const startEditForm = (addr: SavedAddress) => {
    setFormError(null);
    setEditingId(addr.id);
    setLabel(addr.label || '');
    setRecipientName(addr.recipientName || user.name || '');
    setPhone(addr.phone || user.phone || '');
    setStateId(addr.stateId || settings.deliveryFees[0]?.id || 'khartoum');
    setCity(addr.city || '');
    setArea(addr.area || '');
    setDetails(addr.details || '');
    setMapUrl(addr.mapUrl || '');
    setIsDefault(Boolean(addr.isDefault));
    setMode('form');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!recipientName.trim()) {
      setFormError(t('يرجى إدخال اسم المستلم', 'Recipient name is required'));
      return;
    }
    if (!isValidSudanPhone(phone)) {
      setFormError(
        t(
          'يرجى إدخال رقم هاتف سوداني صحيح (مثل 0912345678 أو +249912345678)',
          'Enter a valid Sudan phone (e.g. 0912345678 or +249912345678)'
        )
      );
      return;
    }
    if (!stateId) {
      setFormError(t('يرجى اختيار الولاية', 'Please select a Sudan state'));
      return;
    }
    if (!city.trim() || !area.trim() || !details.trim()) {
      setFormError(
        t('يرجى إكمال المدينة والحي والشارع/أقرب معلم', 'Complete city, area, and street/landmark')
      );
      return;
    }

    const normalizedPhone = normalizeSudanPhone(phone);
    if (editingId) {
      const updated: SavedAddress = {
        id: editingId,
        label: label.trim() || t('عنوان التوصيل', 'Delivery Address'),
        recipientName: recipientName.trim(),
        phone: normalizedPhone,
        stateId,
        city: city.trim(),
        area: area.trim(),
        details: details.trim(),
        mapUrl: mapUrl.trim() || undefined,
        isDefault,
      };
      updateAddress(updated);
      onSelectAddress(updated);
      onClose();
      return;
    }

    const created = saveAddress({
      label: label.trim() || t('عنوان التوصيل', 'Delivery Address'),
      recipientName: recipientName.trim(),
      phone: normalizedPhone,
      stateId,
      city: city.trim(),
      area: area.trim(),
      details: details.trim(),
      mapUrl: mapUrl.trim() || undefined,
      isDefault,
    });
    onSelectAddress(created);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-xl bg-white dark:bg-[#131C2E] sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#D9B24C]" />
            <h2 className="text-sm sm:text-base font-extrabold">
              {mode === 'form'
                ? editingId
                  ? t('تعديل عنوان التوصيل', 'Edit Delivery Address')
                  : t('إضافة عنوان جديد', 'Add New Address')
                : t('عنوان التوصيل', 'Delivery Address')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('إغلاق', 'Close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {isGuest ? (
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 text-center space-y-4">
              <div className="space-y-1.5">
                <h3 className="text-sm sm:text-base font-extrabold text-[#11223E] dark:text-amber-200">
                  {t('العناوين المحفوظة للتوصيل', 'Saved Delivery Addresses')}
                </h3>
                <p className="text-xs sm:text-sm font-bold text-[#11223E] dark:text-slate-200">
                  {t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature')}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuthModal('login', true);
                  }}
                  style={{ backgroundColor: appearance.primaryColor }}
                  className="min-h-[44px] px-5 rounded-xl text-white font-extrabold inline-flex items-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{t('تسجيل الدخول', 'Sign In')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuthModal('register', true);
                  }}
                  style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
                  className="min-h-[44px] px-5 rounded-xl font-extrabold"
                >
                  {t('إنشاء حساب جديد', 'Create Account')}
                </button>
              </div>
            </div>
          ) : mode === 'list' ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={startNewForm}
                style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
                className="w-full min-h-[46px] px-4 rounded-xl font-extrabold inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{t('إضافة عنوان جديد', 'Add New Address')}</span>
              </button>

              {user.addresses.length === 0 ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400">
                  {t('لا توجد عناوين محفوظة بعد', 'No saved addresses yet')}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {user.addresses.map((addr) => {
                    const st = settings.deliveryFees.find((s) => s.id === addr.stateId);
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        className={`p-3.5 rounded-xl border transition-colors space-y-2 ${
                          isSelected
                            ? 'border-[#D9B24C] bg-[#D9B24C]/10'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAddress(addr);
                              onClose();
                            }}
                            className="flex-1 text-start space-y-1 min-w-0"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-extrabold text-sm">
                                {addr.recipientName || user.name}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500">
                                ({addr.label})
                              </span>
                              {addr.isDefault && (
                                <span className="px-2 py-0.5 rounded bg-[#11223E] text-white text-[10px] font-bold inline-flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-[#D9B24C] text-[#D9B24C]" />
                                  {t('الافتراضي', 'Default')}
                                </span>
                              )}
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                            </div>
                            <div className="font-mono-num text-slate-600 dark:text-slate-300" dir="ltr">
                              {addr.phone || user.phone}
                            </div>
                            <div className="text-slate-700 dark:text-slate-200 font-semibold">
                              {locale === 'ar' ? st?.nameAr : st?.nameEn} — {addr.city}، {addr.area}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400">{addr.details}</div>
                            {st && (
                              <div className="font-mono-num text-[11px] font-bold text-[#B38B2D] dark:text-[#E2BD5B]">
                                {t('رسوم التوصيل:', 'Delivery Fee:')} {formatSdg(st.feeSdg)}
                              </div>
                            )}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAddress(addr);
                              onClose();
                            }}
                            style={{ backgroundColor: appearance.primaryColor }}
                            className="min-h-[38px] px-3 rounded-lg text-white font-bold"
                          >
                            {t('توصيل لهذا العنوان', 'Deliver Here')}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditForm(addr)}
                            className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 font-bold inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {t('تعديل', 'Edit')}
                          </button>
                          {!addr.isDefault && (
                            <button
                              type="button"
                              onClick={() => setDefaultAddress(addr.id)}
                              className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 font-bold"
                            >
                              {t('تعيين كافتراضي', 'Set Default')}
                            </button>
                          )}
                          {addr.mapUrl && (
                            <a
                              href={addr.mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1 text-[#B38B2D]"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              {t('الخريطة', 'Map')}
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              deleteAddress(addr.id);
                              showToast(t('تم حذف العنوان', 'Address deleted'));
                            }}
                            aria-label={t('حذف', 'Delete')}
                            className="min-h-[38px] px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 ms-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <form id="vp-address-form" onSubmit={handleSaveForm} className="space-y-3">
              {user.addresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="text-[#B38B2D] font-bold hover:underline"
                >
                  {t('← العودة للعناوين المحفوظة', '← Back to saved addresses')}
                </button>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">
                    {t('اسم المستلم *', 'Recipient Name *')}
                  </label>
                  <input
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={t('الاسم الكامل للمستلم', 'Recipient full name')}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">
                    {t('تسمية العنوان', 'Label (Home / Work)')}
                  </label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={t('المنزل / العمل', 'Home / Office')}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">
                    {t('رقم الهاتف السوداني *', 'Sudan Phone *')}
                  </label>
                  <input
                    required
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912345678 / +249912345678"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono-num text-base"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{t('الولاية *', 'Sudan State *')}</label>
                  <select
                    value={stateId}
                    onChange={(e) => setStateId(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base"
                  >
                    {settings.deliveryFees.map((st) => (
                      <option key={st.id} value={st.id}>
                        {locale === 'ar' ? st.nameAr : st.nameEn} ({formatSdg(st.feeSdg)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">
                    {t('المدينة / المحلية *', 'City / Locality *')}
                  </label>
                  <input
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t('الخرطوم، بحري، أم درمان، مدني...', 'City')}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">
                    {t('الحي / المنطقة *', 'Neighborhood / Area *')}
                  </label>
                  <input
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder={t('العمارات، الرياض، الطائف...', 'Area')}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  {t('الشارع وأقرب معلم بارز *', 'Street & Nearest Landmark *')}
                </label>
                <input
                  required
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={t('مثال: شارع 15، بجوار صيدلية النيل', 'Street and nearest landmark')}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">
                  {t('رابط الموقع على الخريطة (اختياري)', 'Google Maps Link (Optional)')}
                </label>
                <input
                  dir="ltr"
                  type="url"
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-bold pt-1">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 accent-[#D9B24C]"
                />
                <span>{t('اجعله العنوان الافتراضي', 'Set as default address')}</span>
              </label>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-bold">
                  {formError}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
          >
            {t('إغلاق', 'Close')}
          </button>
          {!isGuest && mode === 'form' && (
            <button
              type="submit"
              form="vp-address-form"
              style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
              className="min-h-[44px] px-5 rounded-xl text-xs font-extrabold"
            >
              {editingId ? t('حفظ التعديلات واستخدام العنوان', 'Save & Use Address') : t('حفظ واستخدام العنوان', 'Save & Select')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
