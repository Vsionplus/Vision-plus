import React, { useMemo, useState } from 'react';
import { MessageCircle, Phone, Send, Upload, Stethoscope } from 'lucide-react';
import { compressImageFileToBlob } from '../lib/firebase';
import { useStore } from '../store/StoreContext';
import { ConsultTopic } from '../types';
import { formatShortDate, isValidSudanPhone, normalizeSudanPhone } from '../utils/format';

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
    showToast,
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
    if (!message.trim()) return;
    if (!isValidSudanPhone(phone)) {
      showToast(t('أدخل رقم هاتف سوداني صحيح +249', 'Enter a valid +249 Sudan phone'));
      return;
    }
    createConsult(topic, message.trim(), normalizeSudanPhone(phone), photoUrl || undefined);
    setMessage('');
    setPhotoUrl('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Stethoscope className="w-6 h-6" style={{ color: appearance.secondaryColor }} />
            {t('استشر أخصائي البصريات', 'Consult an Optician')}
          </h1>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
            {t(
              'أرسل سؤالك أو صورة كشف النظر ليجيبك أخصائي البصريات داخل التطبيق أو عبر واتساب',
              'Send your optical inquiry or Rx image for direct licensed optician guidance'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <MessageCircle className="w-4 h-4" />
            {t('محادثة واتساب', 'Chat on WhatsApp')}
          </a>
          <a
            href={`tel:${settings.phone}`}
            className="px-4 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Phone className="w-4 h-4" />
            {t('اتصال مباشر', 'Call')}
          </a>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleCreate}
          className="lg:col-span-5 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 text-xs"
        >
          <h2 className="text-base font-bold">{t('فتح استشارة جديدة', 'New Consultation')}</h2>

          <div>
            <label className="block font-semibold mb-1">{t('موضوع الاستشارة', 'Topic')}</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
            >
              {visibleTopics.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {locale === 'ar' ? tp.labelAr : tp.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">{t('رقم الهاتف (+249)', 'Phone (+249)')}</label>
            <input
              required
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">{t('تفاصيل استشارتك', 'Message')}</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('اكتب استفسارك للأخصائي...', 'Describe your question for the optician...')}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
            />
          </div>

          <label className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-stone-300 dark:border-zinc-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-zinc-900">
            <Upload className="w-4 h-4" style={{ color: appearance.secondaryColor }} />
            <span>
              {photoUrl ? t('تم إرفاق صورة الكشف ✓', 'Photo attached ✓') : t('إرفاق صورة اختيارية (وصفة أو وجه)', 'Optional photo (Rx or frame)')}
            </span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>

          <button
            type="submit"
            style={{ backgroundColor: appearance.primaryColor }}
            className="w-full py-2.5 rounded-lg text-white font-bold text-sm"
          >
            {t('إرسال الاستشارة', 'Submit Consultation')}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-4">
          {consults.map((c) => {
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
                className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-zinc-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold">
                      {topicObj ? (locale === 'ar' ? topicObj.labelAr : topicObj.labelEn) : c.topic}
                    </h3>
                    <span className="text-[11px] text-stone-500 dark:text-zinc-400">
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
                          : 'bg-stone-100 dark:bg-zinc-900 me-auto'
                      }`}
                    >
                      <div className="font-bold text-[11px] text-stone-700 dark:text-zinc-300">
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
                      placeholder={t('اكتب رداً في المحادثة...', 'Reply in thread...')}
                      className="flex-1 px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const txt = (replyTexts[c.id] || '').trim();
                        if (!txt) return;
                        replyConsult(c.id, txt, 'customer');
                        setReplyTexts((prev) => ({ ...prev, [c.id]: '' }));
                      }}
                      className="px-4 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {t('إرسال', 'Send')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
