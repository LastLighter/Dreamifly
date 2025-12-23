'use client'
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  BoltIcon,
  ClockIcon,
  XMarkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { createPortal } from 'react-dom';

interface Stats {
  totalGenerations: number;
  dailyGenerations: number;
  uptime: {
    days: number;
    hours: number;
    minutes: number;
  };
}

type Accent = 'orange' | 'emerald' | 'blue';

const accentStyles: Record<
  Accent,
  { chipBg: string; chipText: string; iconBg: string; iconText: string; ring: string }
> = {
  orange: {
    chipBg: 'bg-orange-500/10',
    chipText: 'text-orange-700',
    iconBg: 'bg-orange-500/10',
    iconText: 'text-orange-700',
    ring: 'ring-orange-200/60',
  },
  emerald: {
    chipBg: 'bg-emerald-500/10',
    chipText: 'text-emerald-700',
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-700',
    ring: 'ring-emerald-200/60',
  },
  blue: {
    chipBg: 'bg-sky-500/10',
    chipText: 'text-sky-700',
    iconBg: 'bg-sky-500/10',
    iconText: 'text-sky-700',
    ring: 'ring-sky-200/60',
  },
};

function StatSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-orange-200/60 bg-white/55 backdrop-blur-md shadow-[0_25px_70px_-45px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-24 h-64 w-64 rounded-full bg-gradient-to-br from-orange-200/30 via-amber-200/15 to-transparent blur-2xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-200/25 via-emerald-200/10 to-transparent blur-2xl" />
      </div>

      <div className="relative p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="h-5 w-28 rounded-full bg-gray-200/80 animate-pulse" />
          <div className="h-4 w-40 rounded-full bg-gray-200/70 animate-pulse hidden sm:block" />
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm ring-1 ring-black/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gray-200/80 animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-24 rounded bg-gray-200/80 animate-pulse" />
                      <div className="mt-2 h-6 w-28 rounded bg-gray-200/80 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QrModal({
  open,
  title,
  subtitle,
  qrAlt,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  qrAlt: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl ring-1 ring-black/10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-orange-200/35 to-transparent blur-2xl" />
          <div className="absolute -bottom-20 -right-24 h-72 w-72 rounded-full bg-gradient-to-bl from-sky-200/22 to-transparent blur-2xl" />
        </div>

        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 leading-snug">{title}</div>
              {subtitle && (
                <div className="mt-1 text-xs text-gray-600 leading-relaxed">
                  {subtitle}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-gray-700 ring-1 ring-black/5 hover:bg-white transition"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4">
            <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl border border-orange-200/70 bg-white p-3 shadow-inner">
              <Image
                src="/common/qrcode_qq.jpg"
                alt={qrAlt}
                width={320}
                height={320}
                className="h-full w-full object-contain rounded-xl"
                priority={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function formatNumber(num: number): string {
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  if (num >= 1000) return (num / 1000).toFixed(1) + '千';
  return num.toLocaleString();
}

export default function SiteStats() {
  const t = useTranslations('home.stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 120000); // 每两分钟更新一次

    return () => clearInterval(interval);
  }, []);

  const days = stats?.uptime?.days ?? 0;

  const cards = useMemo(() => {
    if (!stats) return [] as Array<{
      accent: Accent;
      label: string;
      value: string;
      unit: string;
      Icon: typeof ClockIcon;
    }>;

    return [
      {
        accent: 'emerald' as const,
        label: t('uptime'),
        value: days.toLocaleString(),
        unit: t('intro.days'),
        Icon: ClockIcon,
      },
      {
        accent: 'orange' as const,
        label: t('totalGenerations'),
        value: formatNumber(stats.totalGenerations),
        unit: t('intro.pieces'),
        Icon: SparklesIcon,
      },
      {
        accent: 'blue' as const,
        label: t('dailyGenerations'),
        value: formatNumber(stats.dailyGenerations),
        unit: t('intro.pieces'),
        Icon: BoltIcon,
      },
    ];
  }, [days, stats, t]);

  if (loading) {
    return <StatSkeleton />;
  }

  if (!stats) {
    return (
      <div className="rounded-3xl border border-orange-200/60 bg-white/55 backdrop-blur-md p-6 sm:p-8 text-center text-gray-600 shadow-[0_25px_70px_-45px_rgba(0,0,0,0.45)]">
        <span className="text-gray-500">{t('loadFailed')}</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-orange-200/60 bg-gradient-to-br from-white/70 via-white/45 to-orange-50/60 backdrop-blur-md shadow-[0_25px_70px_-45px_rgba(0,0,0,0.45)]">
      {/* 装饰层：轻量、克制的渐变光斑，让区块更“精致”但不喧宾夺主 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-28 h-72 w-72 rounded-full bg-gradient-to-br from-orange-200/35 via-amber-200/18 to-transparent blur-2xl" />
        <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-gradient-to-tr from-sky-200/25 via-emerald-200/12 to-transparent blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_30%_10%,rgba(255,255,255,0.55),transparent_55%)]" />
      </div>

      <div className="relative p-4 sm:p-5">
        {/* 统计：一行紧凑卡片，尽可能压缩高度；小屏自动换行 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cards.map(({ accent, label, value, unit, Icon }) => {
            const styles = accentStyles[accent];
            return (
              <div
                key={label}
                className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/60 p-4 ring-1 ring-black/5 transition-all duration-300 hover:shadow-md"
              >
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br from-orange-200/22 to-transparent blur-2xl" />
                </div>

                <div className="relative flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${styles.iconBg} ${styles.ring} ring-1`}
                  >
                    <Icon className={`h-5 w-5 ${styles.iconText}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-gray-600 truncate">{label}</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <div className="text-lg sm:text-xl font-bold tracking-tight text-gray-900 tabular-nums whitespace-nowrap">
                        {value}
                      </div>
                      <div className="text-xs font-medium text-gray-500">{unit}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 加入QQ群：放到统计卡片下方，去掉修饰性文案，信息更直观 */}
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="mt-3 w-full group relative overflow-hidden rounded-2xl border border-orange-200/70 bg-gradient-to-r from-orange-50/85 via-white/65 to-white/55 px-4 py-3 text-left ring-1 ring-orange-200/60 shadow-[0_16px_55px_-45px_rgba(249,115,22,0.85)] hover:shadow-[0_20px_70px_-45px_rgba(249,115,22,0.95)] transition-all"
        >
          <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute -top-16 -right-16 h-52 w-52 rounded-full bg-gradient-to-br from-orange-200/30 to-transparent blur-2xl" />
            <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-gradient-to-tr from-sky-200/18 to-transparent blur-2xl" />
          </div>

          <div className="relative flex items-start gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/10 ring-1 ring-orange-200/70">
                <Image src="/common/qq.svg" alt="" width={20} height={20} className="h-5 w-5" priority={false} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 leading-snug line-clamp-1">{t('joinGroup.title')}</div>
                <div className="mt-0.5 text-xs text-gray-600 leading-snug line-clamp-2">
                  {t('joinGroup.subtitle')}
                </div>
              </div>
            </div>

            <div className="shrink-0 ml-auto">
              <div className="h-12 w-12 overflow-hidden rounded-xl border border-orange-200/70 bg-white shadow-inner">
                <Image
                  src="/common/qrcode_qq.jpg"
                  alt={t('joinGroup.qrAlt')}
                  width={96}
                  height={96}
                  className="h-full w-full object-contain"
                  priority={false}
                />
              </div>
            </div>
          </div>
        </button>

        {/* 弹窗二维码：默认不占高度 */}
        <QrModal
          open={qrOpen}
          title={t('joinGroup.title')}
          subtitle={t('joinGroup.subtitle')}
          qrAlt={t('joinGroup.qrAlt')}
          onClose={() => setQrOpen(false)}
        />
      </div>
    </div>
  );
} 