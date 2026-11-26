import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Phone, Send, Upload, Stethoscope } from 'lucide-react';
import { compressImageFileToBlob } from '../lib/firebase';
import { useStore } from '../store/StoreContext';
import { ConsultTopic } from '../types';
import { formatShortDate, isValidSudanPhone, normalizeSudanPhone } from '../utils/format';
import { FieldValidationRule, useFormValidation } from '../hooks/useFormValidation';
import { FieldError, ValidationSummaryBanner } from './FormValidationUI';
import { VALIDATION_MESSAGES, pickMsg } from '../utils/validationMessages';

export const ConsultView: React.FC = () => {
  const {
    locale,
    t,
    consults,
    consultTopics,
    user,
    settings,
    appearance,
    createConsult,
    replyConsult,
  } = useStore();

  const visibleTopics = useMemo(
    () => consultTopics.filter((tp) => tp.visible),
    [consultTopics]
  );

  const [topic, setTopic] = useState<ConsultTopic>(visibleTopics[0]?.id || 'choosing_frames');
  const [phone, setPhone] = useState(user.phone);
  const [message, setMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  const v = useFormValidation({ formId: 'consult-optician' });

  const buildRules = useCallback((): FieldValidationRule[] => {
    const cleanPhone = phone.trim();
    return [
      {
        field: 'topic',
        label: t('موضوع الاستشارة', 'Topic'),
        error: !topic ? pickMsg(VALIDATION_MESSAGES.consultTopicRequired, locale) : null,
      },
      {
        field: 'phone',
        label: t('رقم الهاتف', 'Phone Number'),
        error: !cleanPhone
          ? pickMsg(VALIDATION_MESSAGES.phoneRequired, locale)
          : !isValidSudanPhone(cleanPhone)
          ? pickMsg(VALIDATION_MESSAGES.phoneInvalidSudan, locale)
          : null,
      },
      {
        field: 'message',
        label: t('تفاصيل الاستشارة', 'Consultation Details'),
        error: !message.trim() ? pickMsg(VALIDATION_MESSAGES.consultMessageRequired, locale) : null,
      },
    ];
  }, [topic, phone, message, locale, t]);

  useEffect(() => {
    if (v.submitted) {
      v.revalidate(buildRules());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.submitted, buildRules]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl } = await compressImageFileToBlob(file, 900, 0.78);
      if (dataUrl) setPhotoUrl(dataUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setPhotoUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.validateAll(buildRules())) return;

    createConsult(topic, message.trim(), normalizeSudanPhone(phone), photoUrl || undefined);
    setMessage('');
    setPhotoUrl('');
    v.reset();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Stethoscope className="w-6 h-6" style={{ color: appearance.secondaryColor }} />
            {t('استشر أخصائي البصريات', 'Consult an Optician')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'أرسل سؤالك أو صورة كشف النظر ليجيبك أخصائي البصريات داخل التطبيق أو عبر واتساب',
              'Send your inquiry or Rx photo for licensed optician guidance'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <MessageCircle className="w-4 h-4" />
            {t('واتساب', 'WhatsApp')}
          </a>
          <a
            href={`tel:${settings.phone}`}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111927] text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Phone className="w-4 h-4" />
            {t('اتصال', 'Call')}
          </a>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <form
          noValidate
          onSubmit={handleCreate}
          className="lg:col-span-5 bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 text-xs"
        >
          <h2 className="text-base font-bold">{t('استشارة جديدة', 'New Consultation')}</h2>

          <ValidationSummaryBanner errors={v.errors} onSelectField={v.focusField} />

          <div {...v.getFieldWrapperProps('topic')}>
            <label className="block font-semibold mb-1.5">{t('الموضوع', 'Topic')}</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              {...v.getInputA11yProps('topic')}
              className={`w-full min-h-[44px] px-3 rounded-xl ${v.getControlClasses(
                'topic',
                'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
              )}`}
            >
              {visibleTopics.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {locale === 'ar' ? tp.labelAr : tp.labelEn}
                </option>
              ))}
            </select>
            <FieldError id={v.getErrorId('topic')} message={v.getError('topic')} />
          </div>

          <div {...v.getFieldWrapperProps('phone')}>
            <label className="block font-semibold mb-1.5">{t('رقم الهاتف (+249)', 'Phone (+249)')}</label>
            <input
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+249912345678"
              {...v.getInputA11yProps('phone')}
              className={`w-full min-h-[44px] px-3 rounded-xl font-mono-num ${v.getControlClasses(
                'phone',
                'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
              )}`}
            />
            <FieldError id={v.getErrorId('phone')} message={v.getError('phone')} />
          </div>

          <div {...v.getFieldWrapperProps('message')}>
            <label className="block font-semibold mb-1.5">{t('تفاصيل استشارتك', 'Message')}</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('اكتب استفسارك للأخصائي...', 'Describe your question...')}
              {...v.getInputA11yProps('message')}
              className={`w-full px-3 py-2.5 rounded-xl ${v.getControlClasses(
                'message',
                'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
              )}`}
            />
            <FieldError id={v.getErrorId('message')} message={v.getError('message')} />
          </div>

          <label className="min-h-[44px] flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
            <Upload className="w-4 h-4" style={{ color: appearance.secondaryColor }} />
            <span>
              {photoUrl ? t('تم إرفاق صورة الكشف ✓', 'Photo attached ✓') : t('إرفاق صورة اختيارية', 'Optional photo (Rx or frame)')}
            </span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>

          <button
            type="submit"
            style={{ backgroundColor: appearance.primaryColor }}
            className="w-full min-h-[44px] rounded-xl text-white font-bold text-sm"
          >
            {t('إرسال الاستشارة', 'Submit Consultation')}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-4">
          {consults.length === 0 ? (
            <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              {t('لا توجد استشارات سابقة. أرسل استفسارك الأول عبر النموذج.', 'No consultations yet. Submit your first inquiry.')}
            </div>
          ) : (
            consults.map((c) => {
              const topicObj = consultTopics.find((tp) => tp.id === c.topic);
              const statusText =
                c.status === 'open'
                  ? t('مفتوحة', 'Open')
                  : c.status === 'answered'
                  ? t('تم الرد', 'Answered')
                  : t('مغلقة', 'Closed');
              return (
                <div
                  key={c.id}
                  className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold">
                        {topicObj ? (locale === 'ar' ? topicObj.labelAr : topicObj.labelEn) : c.topic}
                      </h3>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatShortDate(c.createdAt, locale)} · <span className="font-mono-num">{c.phone}</span>
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#B38B2D] dark:text-[#E2BD5B]">
                      {statusText}
                    </span>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {c.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl text-xs space-y-1 max-w-[90%] ${
                          m.sender === 'optician'
                            ? 'bg-[#D9B24C]/10 border border-[#D9B24C]/30 ms-auto'
                            : 'bg-slate-100 dark:bg-slate-900 me-auto'
                        }`}
                      >
                        <div className="font-bold text-[11px] text-slate-700 dark:text-slate-300">
                          {m.senderName}
                        </div>
                        <p className="leading-relaxed">{m.text}</p>
                        {m.imageUrl && <img src={m.imageUrl} alt="" className="h-24 rounded-lg object-cover mt-1" />}
                      </div>
                    ))}
                  </div>

                  {c.status !== 'closed' && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyTexts[c.id] || ''}
                        onChange={(e) => setReplyTexts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder={t('اكتب رداً...', 'Reply in thread...')}
                        className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const txt = (replyTexts[c.id] || '').trim();
                          if (!txt) return;
                          replyConsult(c.id, txt, 'customer');
                          setReplyTexts((prev) => ({ ...prev, [c.id]: '' }));
                        }}
                        style={{ backgroundColor: appearance.primaryColor }}
                        className="min-h-[44px] px-4 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {t('إرسال', 'Send')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
