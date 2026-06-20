import {
  ChapterStageIcon,
  CharacterRoleIcon,
  GenreDivider,
  GenreMainIcon,
  WorldElementIcon,
  getGenreCssVars
} from '../genre-ui/index.js';
import LightNovelPrimaryButton from '../components/lightnovel/LightNovelPrimaryButton.jsx';

const THEME_KEY = 'lightnovel';

const NAV_ITEMS = ['首页', '故事', '角色', '世界观', '画廊', '资讯'];

const CHARACTER_CARDS = [
  {
    key: 'protagonist',
    label: '主角',
    title: '主角',
    description: '负责成长与选择',
    tags: ['成长', '命运'],
    tone: 'pink',
    rotate: '-rotate-[1deg]'
  },
  {
    key: 'companion',
    label: '伙伴',
    title: '伙伴',
    description: '负责羁绊与支援',
    tags: ['羁绊', '守护'],
    tone: 'blue',
    rotate: 'rotate-[0.8deg]'
  },
  {
    key: 'mystery',
    label: '神秘人物',
    title: '神秘人物',
    description: '负责谜团与转折',
    tags: ['谜团', '转折'],
    tone: 'purple',
    rotate: '-rotate-[0.6deg]'
  }
];

const CHAPTER_STAGES = [
  { key: 'opening', number: '01', label: '相遇', color: 'violet' },
  { key: 'awakening', number: '02', label: '觉醒', color: 'blue' },
  { key: 'trial', number: '03', label: '试炼', color: 'pink', active: true },
  { key: 'crisis', number: '04', label: '危机', color: 'violet' },
  { key: 'climax', number: '05', label: '高潮', color: 'gold' }
];

const WORLD_NOTES = [
  {
    key: 'faction',
    title: '学院 / 社团',
    description: '知识与青春交织的舞台，成长与梦想从这里启程。',
    tone: 'pink',
    tape: '-rotate-[10deg]'
  },
  {
    key: 'location',
    title: '异世界入口',
    description: '隐藏在日常中的门扉，通往未知与奇迹的彼岸。',
    tone: 'blue',
    tape: 'rotate-[8deg]'
  },
  {
    key: 'artifact',
    title: '魔法道具',
    description: '承载力量与故事的物品，改变命运的关键所在。',
    tone: 'gold',
    tape: '-rotate-[8deg]'
  },
  {
    key: 'secret',
    title: '秘密约定',
    description: '不为人知的誓言与契约，是羁绊，也是故事的伏笔。',
    tone: 'purple',
    tape: 'rotate-[7deg]'
  }
];

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6.2" />
      <path d="M16 16L20 20" />
    </svg>
  );
}

function BookButtonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 7.5C7.2 7 8.5 7.1 10 8V18C8.5 17.2 7.2 17.1 5.5 17.5V7.5Z" />
      <path d="M18.5 7.5C16.8 7 15.5 7.1 14 8V18C15.5 17.2 16.8 17.1 18.5 17.5V7.5Z" />
      <path d="M10 8C11 7.4 13 7.4 14 8" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 5.5H16.5V18.5L12 15.5L7.5 18.5V5.5Z" />
    </svg>
  );
}

function FeatherIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 4C13 5 8.2 9.2 6.4 15.2L5 20L9.8 18.6C15.8 16.8 20 12 21 6C21.3 4.3 20.7 3.7 19 4Z" />
      <path d="M8.5 15.5L15 9" />
      <path d="M10.8 18.2L7 14.4" />
    </svg>
  );
}

function Sparkle({ className = '', size = 'sm' }) {
  const sizeClassMap = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={joinClasses(sizeClassMap[size] || sizeClassMap.sm, className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.8L13.7 8.3L19.2 10L13.7 11.7L12 17.2L10.3 11.7L4.8 10L10.3 8.3L12 2.8Z" />
      <path d="M19 3.8L19.7 6L21.9 6.7L19.7 7.4L19 9.6L18.3 7.4L16.1 6.7L18.3 6L19 3.8Z" />
    </svg>
  );
}

function Petal({ className = '' }) {
  return (
    <svg viewBox="0 0 28 18" aria-hidden="true" className={joinClasses('h-4 w-7', className)} fill="none">
      <path d="M3 9C8 2.4 16.5 0.8 24 4.2C22.2 12.2 14.4 17.6 6.2 15.8C4.2 15.4 2.8 13.4 3 9Z" fill="currentColor" opacity="0.88" />
      <path d="M5 10.8C10.4 8.2 14.4 6.8 21.4 5.8" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function StickerLabel({ children }) {
  return (
    <div className="inline-flex rotate-[-5deg] items-center gap-2 rounded-[18px] border border-[rgba(236,111,159,0.34)] bg-[linear-gradient(135deg,#f7a8c5,#ef7aa8)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(236,111,159,0.22)]">
      <Sparkle size="sm" className="text-[#fff6e9]" />
      <span>{children}</span>
    </div>
  );
}

function PastelButton({ variant = 'primary', icon, children }) {
  const classes = {
    primary: 'border-[#f19abc] bg-[linear-gradient(180deg,#ff96bc,#ea6fa0)] text-white shadow-[0_12px_24px_rgba(236,111,159,0.24)]',
    secondary: 'border-[rgba(209,175,236,0.42)] bg-[rgba(255,255,255,0.84)] text-[#7a5c95] shadow-[0_10px_22px_rgba(185,167,255,0.12)]'
  };

  return (
    <button
      type="button"
      className={joinClasses(
        'inline-flex min-h-14 items-center justify-center gap-3 rounded-full border px-7 text-lg font-semibold transition duration-200 hover:-translate-y-[2px]',
        classes[variant] || classes.primary
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-12 w-12" fill="none">
      <path d="M12 36C20 35 26 38 32 44C38 38 44 35 52 36" stroke="url(#logo-book)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 20L30 28L32 44L12 36L14 20Z" fill="url(#logo-left)" stroke="#c89ae7" strokeWidth="1.5" />
      <path d="M50 20L34 28L32 44L52 36L50 20Z" fill="url(#logo-right)" stroke="#c89ae7" strokeWidth="1.5" />
      <path d="M32 14L34.5 19.8L40.8 20.3L35.8 24.2L37.4 30.2L32 26.7L26.6 30.2L28.2 24.2L23.2 20.3L29.5 19.8L32 14Z" fill="#f4ca6d" stroke="#f4ca6d" strokeWidth="1" />
      <defs>
        <linearGradient id="logo-left" x1="12" y1="20" x2="32" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f6d3e6" />
          <stop offset="1" stopColor="#b79cf9" />
        </linearGradient>
        <linearGradient id="logo-right" x1="32" y1="20" x2="52" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffdee9" />
          <stop offset="1" stopColor="#d1c6ff" />
        </linearGradient>
        <linearGradient id="logo-book" x1="12" y1="36" x2="52" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9c7ae6" />
          <stop offset="1" stopColor="#ef7aa8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function FloatingBookmark() {
  return (
    <div className="hidden h-[168px] w-[60px] rotate-[-4deg] rounded-[20px] border border-[rgba(176,154,230,0.42)] bg-[linear-gradient(180deg,#bba7ff,#7f73d7)] p-3 text-white shadow-[0_14px_26px_rgba(157,127,221,0.22)] lg:flex lg:flex-col lg:items-center lg:justify-between">
      <Sparkle size="sm" className="text-[#fff4cf]" />
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(255,255,255,0.34)]">
        <FeatherIcon />
      </div>
      <Sparkle size="sm" className="text-[#ffdfe7]" />
    </div>
  );
}

function FloatingNote() {
  return (
    <div className="absolute right-[2%] top-[23%] z-20 w-[144px] rotate-[6deg] rounded-[18px] border border-[rgba(202,180,213,0.42)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,248,252,0.9))] px-5 py-7 text-center text-[#7d668f] shadow-[0_16px_26px_rgba(189,161,209,0.16)]">
      <div className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#d6b37b]" />
      <div className="absolute inset-x-5 top-4 h-[1px] bg-[linear-gradient(90deg,transparent,rgba(212,193,225,0.8),transparent)]" />
      <p className="text-lg leading-9">
        每一次选择
        <br />
        都在书写
        <br />
        独一无二的未来。
      </p>
    </div>
  );
}

function SoftCharacterSilhouette({ side = 'left' }) {
  const sideClass = side === 'left'
    ? 'left-[23%] top-[16%] text-[rgba(255,160,196,0.26)]'
    : 'right-[16%] top-[18%] text-[rgba(138,146,240,0.28)]';

  return (
    <svg
      viewBox="0 0 180 240"
      aria-hidden="true"
      className={joinClasses('absolute z-[1] hidden h-[220px] w-[160px] blur-[0.2px] lg:block', sideClass)}
      fill="none"
    >
      <path d="M88 18C108 18 124 36 124 58C124 73 117 84 109 95C126 100 139 114 145 135C151 157 149 182 141 205C125 213 112 217 88 218C66 219 48 215 34 206C28 184 30 156 37 134C44 112 57 99 75 94C66 84 58 71 58 58C58 35 69 18 88 18Z" fill="currentColor" />
      <path d="M80 42C67 48 59 58 58 78C53 64 56 43 68 32C84 18 111 18 124 42C116 34 105 31 92 32C86 32 82 35 80 42Z" fill="currentColor" opacity="0.78" />
    </svg>
  );
}

function SparkleField() {
  const sparkles = [
    'left-[11%] top-[8%] text-[#f7c96e]',
    'left-[6%] top-[41%] text-[#f4aac6]',
    'left-[32%] bottom-[23%] text-[#f4aac6]',
    'right-[28%] top-[7%] text-[#f7c96e]',
    'right-[15%] top-[14%] text-[#b8a5ff]',
    'right-[34%] bottom-[18%] text-[#f4aac6]',
    'right-[48%] top-[18%] text-[#fff4cf]'
  ];

  return (
    <>
      {sparkles.map((className, index) => (
        <Sparkle
          key={className}
          size={index === 0 || index === 3 ? 'lg' : index === 4 ? 'sm' : 'md'}
          className={joinClasses('absolute z-[3]', className)}
        />
      ))}
    </>
  );
}

function RibbonBanner() {
  return (
    <div className="absolute bottom-[22%] left-1/2 z-20 -translate-x-1/2">
      <div className="relative rounded-full border border-[rgba(255,214,231,0.86)] bg-[linear-gradient(180deg,#ef87ad,#d86c99)] px-8 py-3 text-lg font-semibold tracking-[0.08em] text-white shadow-[0_16px_28px_rgba(236,111,159,0.28)]">
        <span className="absolute left-[-28px] top-1/2 h-0 w-0 -translate-y-1/2 border-b-[18px] border-l-[28px] border-t-[18px] border-b-transparent border-l-[#ca79b0] border-t-transparent" />
        <span className="absolute right-[-28px] top-1/2 h-0 w-0 -translate-y-1/2 border-b-[18px] border-r-[28px] border-t-[18px] border-b-transparent border-r-[#ca79b0] border-t-transparent" />
        书页翻开 · 命运开篇
      </div>
    </div>
  );
}

function BookStarEmblem() {
  return (
    <div className="absolute inset-x-[12%] top-[6%] z-10 h-[250px]">
      <div className="absolute inset-x-[10%] top-[2%] h-[222px] rounded-full border-[4px] border-[rgba(163,132,255,0.7)] bg-[radial-gradient(circle_at_center,rgba(255,248,255,0.36),rgba(195,168,255,0.08)_72%,transparent_100%)] shadow-[0_0_0_8px_rgba(255,255,255,0.34),0_22px_46px_rgba(173,138,244,0.24)]" />
      <div className="absolute inset-x-[18%] top-[14%] h-[160px] rounded-full border border-[rgba(255,255,255,0.76)]" />
      <div className="absolute left-1/2 top-[13%] flex h-[168px] w-[168px] -translate-x-1/2 items-center justify-center rounded-full bg-[radial-gradient(circle,#fffefc_0%,#fff2fb_54%,rgba(255,255,255,0.56)_78%,transparent_100%)] text-[#8d6cf0]">
        <GenreMainIcon genre={THEME_KEY} className="h-24 w-24" />
      </div>

      <svg viewBox="0 0 470 280" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="hero-book-cover" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c72d8" />
            <stop offset="45%" stopColor="#7f5fd6" />
            <stop offset="100%" stopColor="#4f4bb8" />
          </linearGradient>
          <linearGradient id="hero-book-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff9ef" />
            <stop offset="100%" stopColor="#ffe7be" />
          </linearGradient>
        </defs>
        <g transform="translate(150 38)">
          <path d="M85 12C113 24 128 46 128 80V168H96L86 72L74 168H43V80C43 46 58 24 85 12Z" fill="url(#hero-book-cover)" stroke="#f6e5ff" strokeWidth="3.5" />
          <path d="M85 22L95 168" stroke="#f2defe" strokeWidth="3.4" />
          <path d="M85 22C61 10 32 15 7 36L43 80C55 66 68 60 85 62" fill="#fff8ef" stroke="url(#hero-book-edge)" strokeWidth="3.4" />
          <path d="M85 22C109 10 138 15 163 36L128 80C116 66 102 60 85 62" fill="#fff8ef" stroke="url(#hero-book-edge)" strokeWidth="3.4" />
          <path d="M85 72L93 109L130 116L97 136L104 174L85 150L66 174L73 136L40 116L77 109L85 72Z" fill="none" stroke="#f2cf6d" strokeWidth="3.2" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-[40px] border border-[rgba(236,111,159,0.22)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,249,253,0.7))] px-6 py-6 shadow-[0_26px_60px_rgba(236,111,159,0.08)] sm:px-8 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(255,214,231,0.44),transparent_26%),radial-gradient(circle_at_72%_18%,rgba(185,167,255,0.34),transparent_32%),radial-gradient(circle_at_82%_72%,rgba(159,201,255,0.18),transparent_25%)]" />
      <div className="absolute left-[2%] top-[14%] h-[72%] w-[52%] rounded-[48px] border border-[rgba(244,196,220,0.16)] bg-[radial-gradient(circle_at_16%_40%,rgba(255,255,255,0.48),transparent_30%),linear-gradient(180deg,rgba(255,248,251,0.82),rgba(255,248,252,0.36))]" />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,0.98fr)_minmax(460px,1.02fr)] lg:items-center">
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <FloatingBookmark />
            <StickerLabel>轻小说类型包</StickerLabel>
          </div>

          <div className="relative max-w-[39rem] rounded-[42px] border border-[rgba(243,198,224,0.3)] bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(255,249,252,0.68))] px-6 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] sm:px-9">
            <div className="absolute bottom-6 left-0 top-6 w-6">
              <span className="absolute left-2 top-4 h-3 w-3 rounded-full border border-[rgba(236,111,159,0.22)] bg-white/88" />
              <span className="absolute left-2 top-16 h-3 w-3 rounded-full border border-[rgba(236,111,159,0.22)] bg-white/88" />
              <span className="absolute left-2 top-28 h-3 w-3 rounded-full border border-[rgba(236,111,159,0.22)] bg-white/88" />
              <span className="absolute left-2 top-40 h-3 w-3 rounded-full border border-[rgba(236,111,159,0.22)] bg-white/88" />
            </div>
            <div className="absolute inset-[18px] rounded-[32px] border border-dashed border-[rgba(236,111,159,0.18)]" />
            <svg viewBox="0 0 520 270" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-50">
              <path d="M40 52C120 16 220 18 296 44C360 66 420 74 476 52" stroke="rgba(245,184,209,0.5)" strokeWidth="1.4" strokeDasharray="4 8" fill="none" />
              <path d="M34 182C98 154 176 154 262 174C336 192 420 194 482 174" stroke="rgba(194,178,230,0.36)" strokeWidth="1.2" strokeDasharray="4 8" fill="none" />
              <path d="M72 104C150 88 244 86 330 102" stroke="rgba(255,214,231,0.44)" strokeWidth="1.1" fill="none" />
            </svg>

            <h1 className="bg-[linear-gradient(180deg,#f5a6c3_0%,#d86b9b_54%,#9a6ee8_100%)] bg-clip-text text-[clamp(3.4rem,7vw,6rem)] font-semibold tracking-[0.06em] text-transparent [text-shadow:0_6px_26px_rgba(236,111,159,0.18)]">
              星页之约
            </h1>
            <div className="mt-4 flex items-center gap-3 text-[#c4976d]">
              <Sparkle size="sm" />
              <p className="text-[1.3rem] font-medium leading-9 text-[#705372]">
                在翻开的书页里，遇见命运写下的下一行。
              </p>
              <Sparkle size="sm" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-[#ef8bb0]">
              <Sparkle size="sm" />
              <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(236,111,159,0.32),transparent)]" />
              <Sparkle size="sm" className="text-[#f5c66d]" />
            </div>
            <p className="mt-5 max-w-[34rem] text-lg leading-9 text-[#8a7896]">
              适合校园、异世界、冒险与角色羁绊题材的小说视觉系统。
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <LightNovelPrimaryButton>
              开始阅读
            </LightNovelPrimaryButton>
            <PastelButton variant="secondary" icon={<BookmarkIcon />}>
              查看角色
            </PastelButton>
          </div>
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-[38px]">
          <div className="absolute inset-0 rounded-[38px] bg-[linear-gradient(180deg,rgba(255,251,253,0.28),rgba(255,255,255,0))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,0.54),transparent_26%),radial-gradient(circle_at_70%_22%,rgba(185,167,255,0.34),transparent_30%),radial-gradient(circle_at_42%_62%,rgba(255,198,221,0.34),transparent_28%),radial-gradient(circle_at_78%_72%,rgba(159,201,255,0.2),transparent_26%)]" />
          <SoftCharacterSilhouette side="left" />
          <SoftCharacterSilhouette side="right" />
          <BookStarEmblem />
          <RibbonBanner />
          <FloatingNote />
          <SparkleField />
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[#f0be63]">
        <Sparkle size="sm" />
        <h2 className="text-[clamp(2rem,3.5vw,3rem)] font-semibold tracking-[0.04em] text-[#4b365d]">
          {title}
        </h2>
        <Sparkle size="sm" />
      </div>
      <p className="max-w-[16rem] text-[1rem] leading-8 text-[#8a7896]">{subtitle}</p>
    </div>
  );
}

function CharacterAvatar({ tone, roleKey }) {
  const toneMap = {
    pink: 'from-[#ffd9e7] via-[#f7a7c7] to-[#d882ad] text-[#d86d9e]',
    blue: 'from-[#dde9ff] via-[#9bbbf6] to-[#6c85dc] text-[#6f7fce]',
    purple: 'from-[#ebe1ff] via-[#c0a2ff] to-[#8f6dd5] text-[#9066cc]'
  };

  return (
    <div className={joinClasses(
      'relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full border border-[rgba(231,191,210,0.46)] bg-gradient-to-br shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]',
      toneMap[tone] || toneMap.pink
    )}>
      <div className="absolute inset-4 rounded-full border border-dashed border-[rgba(255,255,255,0.66)]" />
      <CharacterRoleIcon genre={THEME_KEY} role={roleKey} className="h-16 w-16" />
    </div>
  );
}

function CharacterCard({ card }) {
  const accentMap = {
    pink: {
      border: 'border-[rgba(236,111,159,0.28)]',
      glow: 'shadow-[0_20px_34px_rgba(236,111,159,0.12)]',
      label: 'bg-[linear-gradient(180deg,#f59dc1,#ea6f9f)]'
    },
    blue: {
      border: 'border-[rgba(145,189,255,0.34)]',
      glow: 'shadow-[0_20px_34px_rgba(159,201,255,0.12)]',
      label: 'bg-[linear-gradient(180deg,#93c5ff,#6ea2ea)]'
    },
    purple: {
      border: 'border-[rgba(191,164,248,0.34)]',
      glow: 'shadow-[0_20px_34px_rgba(185,167,255,0.14)]',
      label: 'bg-[linear-gradient(180deg,#b493ff,#8f70df)]'
    }
  };

  return (
    <div className={joinClasses(
      'group relative rounded-[30px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,250,252,0.82))] px-5 pb-5 pt-6 transition duration-200 hover:-translate-y-[4px]',
      accentMap[card.tone].border,
      accentMap[card.tone].glow,
      card.rotate
    )}>
      <div className={joinClasses(
        'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white px-4 py-1 text-sm font-semibold text-white shadow-[0_10px_18px_rgba(236,111,159,0.18)]',
        accentMap[card.tone].label
      )}>
        {card.label}
      </div>
      <span className={joinClasses(
        'absolute right-10 top-5 h-5 w-12 rounded-[6px] bg-[rgba(245,213,141,0.72)] shadow-[0_4px_8px_rgba(212,182,126,0.16)]',
        card.tone === 'pink' ? 'rotate-[10deg]' : '',
        card.tone === 'blue' ? '-rotate-[9deg]' : '',
        card.tone === 'purple' ? 'rotate-[8deg]' : ''
      )} />
      <div className="absolute right-5 top-7 text-[#f2bf69]">
        <Sparkle size="sm" />
      </div>
      <div className="absolute bottom-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(236,111,159,0.2)] bg-[rgba(255,255,255,0.84)] text-[#ef7aa8] shadow-[0_8px_16px_rgba(236,111,159,0.1)]">
        <Sparkle size="sm" />
      </div>
      <div className="rounded-[24px] border border-dashed border-[rgba(236,111,159,0.18)] p-4">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <CharacterAvatar tone={card.tone} roleKey={card.key} />
          <div className="space-y-3">
            <h3 className="text-[2.1rem] font-semibold tracking-[0.03em] text-[#4b365d]">{card.title}</h3>
            <p className="text-lg text-[#7d6889]">{card.description}</p>
            <div className="flex flex-wrap gap-2">
              {card.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border border-[rgba(236,111,159,0.18)] bg-[rgba(255,255,255,0.84)] px-3 py-1 text-sm text-[#8f769f]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CharacterSection() {
  return (
    <section className="rounded-[34px] border border-[rgba(236,111,159,0.16)] bg-[rgba(255,255,255,0.68)] px-6 py-6 shadow-[0_22px_48px_rgba(221,177,208,0.08)] sm:px-8">
      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)] xl:items-start">
        <SectionTitle title="角色介绍" subtitle="他们，构成了这个故事的核心。" />
        <div className="grid gap-4">
          {CHARACTER_CARDS.map((card) => (
            <CharacterCard key={card.key} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ChapterBookmark({ stage }) {
  const paletteMap = {
    violet: {
      fill: 'bg-[linear-gradient(180deg,#ab8ce8,#8b72d2)]',
      icon: 'text-white'
    },
    blue: {
      fill: 'bg-[linear-gradient(180deg,#8eb7ff,#7393e5)]',
      icon: 'text-white'
    },
    pink: {
      fill: 'bg-[linear-gradient(180deg,#ff9ec1,#ef7aa8)]',
      icon: 'text-white shadow-[0_14px_28px_rgba(236,111,159,0.26)]'
    },
    gold: {
      fill: 'bg-[linear-gradient(180deg,#f5d58a,#efb86d)]',
      icon: 'text-white'
    }
  };

  const palette = paletteMap[stage.color] || paletteMap.violet;

  return (
    <div className={joinClasses(
      'relative flex flex-col items-center gap-3',
      stage.active ? '-translate-y-3 scale-[1.04]' : ''
    )}>
      <div className={joinClasses(
        'relative flex h-[94px] w-[72px] flex-col items-center justify-center rounded-t-[18px] border border-white/70 px-2 pb-4 pt-2 text-center shadow-[0_12px_24px_rgba(174,150,216,0.14)]',
        palette.fill,
        palette.icon
      )}>
        <p className="text-[1.8rem] font-semibold leading-none">{stage.number}</p>
        <span className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/50 bg-white/10">
          <ChapterStageIcon genre={THEME_KEY} stage={stage.key} className="h-4 w-4" />
        </span>
        <span className="absolute inset-x-0 bottom-[-16px] mx-auto h-0 w-0 border-l-[18px] border-r-[18px] border-t-[16px] border-l-transparent border-r-transparent border-t-white/70" />
      </div>
      <div className="text-center">
        <p className={joinClasses(
          'text-[1.7rem] font-semibold tracking-[0.04em]',
          stage.active ? 'text-[#e76f9f]' : 'text-[#5d4d72]'
        )}>
          {stage.label}
        </p>
      </div>
    </div>
  );
}

function ChapterRibbonSection() {
  return (
    <section className="rounded-[34px] border border-[rgba(236,111,159,0.16)] bg-[rgba(255,255,255,0.7)] px-6 py-6 shadow-[0_20px_44px_rgba(221,177,208,0.08)] sm:px-8">
      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)] xl:items-center">
        <SectionTitle title="章节进度" subtitle="跟随命运的指引，解锁故事的篇章。" />

        <div className="relative rounded-[30px] border border-[rgba(236,111,159,0.14)] bg-[rgba(255,255,255,0.8)] px-5 py-8">
          <div className="absolute left-4 top-1/2 hidden -translate-y-1/2 text-[#d7b2e8] lg:block">
            <svg viewBox="0 0 120 72" aria-hidden="true" className="h-12 w-20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 20C30 18 38 19 48 24V54C38 49 30 48 22 50V20Z" fill="rgba(255,255,255,0.75)" />
              <path d="M98 20C90 18 82 19 72 24V54C82 49 90 48 98 50V20Z" fill="rgba(255,255,255,0.75)" />
              <path d="M48 24C56 20 64 20 72 24" />
            </svg>
          </div>

          <div className="absolute left-[8%] right-[5%] top-1/2 hidden -translate-y-1/2 items-center md:flex">
            <svg viewBox="0 0 980 110" aria-hidden="true" className="h-[72px] w-full overflow-visible">
              <defs>
                <linearGradient id="chapter-ribbon-main" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f39aba" />
                  <stop offset="50%" stopColor="#9ca8ff" />
                  <stop offset="100%" stopColor="#f1c36d" />
                </linearGradient>
              </defs>
              <path
                d="M40 50C140 8 238 96 338 50C438 8 536 96 636 50C736 8 834 96 934 50"
                stroke="url(#chapter-ribbon-main)"
                strokeWidth="9"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M40 59C140 17 238 105 338 59C438 17 536 105 636 59C736 17 834 105 934 59"
                stroke="rgba(255,255,255,0.88)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <path d="M938 50C952 47 964 38 977 28C978 42 978 55 972 70" stroke="#e48fb5" strokeWidth="5.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M972 28C985 40 988 54 984 69" stroke="#d987ab" strokeWidth="4.2" fill="none" strokeLinecap="round" />
            </svg>
          </div>

          <div className="relative grid gap-8 md:grid-cols-5 md:gap-3">
            {CHAPTER_STAGES.map((stage) => (
              <div key={stage.key} className="relative flex justify-center">
                <ChapterBookmark stage={stage} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MemoTape({ rotateClass = '' }) {
  return (
    <span className={joinClasses(
      'absolute left-8 top-[-10px] h-6 w-14 rounded-[6px] bg-[rgba(245,213,141,0.74)] shadow-[0_4px_8px_rgba(212,182,126,0.16)]',
      rotateClass
    )} />
  );
}

function WorldMemoCard({ note }) {
  const toneMap = {
    pink: {
      card: 'border-[rgba(240,164,196,0.34)] bg-[linear-gradient(180deg,rgba(255,247,251,0.98),rgba(255,239,246,0.9))]',
      icon: 'text-[#eb7aa8]',
      sticker: 'text-[#f09cbb]'
    },
    blue: {
      card: 'border-[rgba(162,196,255,0.36)] bg-[linear-gradient(180deg,rgba(248,252,255,0.98),rgba(237,245,255,0.92))]',
      icon: 'text-[#7ca7ef]',
      sticker: 'text-[#8db8f6]'
    },
    gold: {
      card: 'border-[rgba(241,198,117,0.36)] bg-[linear-gradient(180deg,rgba(255,252,245,0.98),rgba(255,245,224,0.92))]',
      icon: 'text-[#e3a85f]',
      sticker: 'text-[#f0be6d]'
    },
    purple: {
      card: 'border-[rgba(190,165,245,0.36)] bg-[linear-gradient(180deg,rgba(251,247,255,0.98),rgba(242,236,255,0.92))]',
      icon: 'text-[#9c7ae6]',
      sticker: 'text-[#b59ef5]'
    }
  };

  const tone = toneMap[note.tone] || toneMap.pink;

  return (
    <div className={joinClasses(
      'relative rounded-[30px] border p-5 shadow-[0_14px_28px_rgba(204,179,221,0.1)]',
      tone.card,
      note.tone === 'pink' ? '-rotate-[1.4deg]' : '',
      note.tone === 'blue' ? 'rotate-[1deg]' : '',
      note.tone === 'gold' ? '-rotate-[0.8deg]' : '',
      note.tone === 'purple' ? 'rotate-[1.2deg]' : ''
    )}>
      <MemoTape rotateClass={note.tape} />
      <div className="rounded-[22px] border border-dashed border-[rgba(205,179,221,0.28)] p-4">
        <div className="flex items-start gap-4">
          <div className={joinClasses(
            'inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-white/80 bg-white/60',
            tone.icon
          )}>
            <WorldElementIcon genre={THEME_KEY} element={note.key} className="h-7 w-7" />
          </div>
          <div className="space-y-3">
            <h3 className="text-[1.7rem] font-semibold text-[#4b365d]">{note.title}</h3>
            <p className="text-[1rem] leading-8 text-[#7d6889]">{note.description}</p>
          </div>
        </div>
      </div>
      <div className={joinClasses('absolute bottom-4 right-4', tone.sticker)}>
        <Sparkle size="sm" />
      </div>
    </div>
  );
}

function WorldMemoSection() {
  return (
    <section className="rounded-[34px] border border-[rgba(236,111,159,0.16)] bg-[rgba(255,255,255,0.7)] px-6 py-6 shadow-[0_20px_44px_rgba(221,177,208,0.08)] sm:px-8">
      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)] xl:items-start">
        <SectionTitle title="世界观便签" subtitle="记录构成这个世界的关键要素。" />
        <div className="grid gap-4 md:grid-cols-2">
          {WORLD_NOTES.map((note) => (
            <WorldMemoCard key={note.key} note={note} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReadingCta() {
  return (
    <section className="relative overflow-hidden rounded-[44px] border border-[rgba(236,111,159,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,248,252,0.78))] px-6 py-8 shadow-[0_24px_56px_rgba(221,177,208,0.08)] sm:px-8 lg:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,214,231,0.22),transparent_22%),radial-gradient(circle_at_80%_80%,rgba(185,167,255,0.12),transparent_20%)]" />
      <div className="absolute bottom-3 left-5 hidden text-[#9981c9] lg:block">
        <svg viewBox="0 0 120 120" aria-hidden="true" className="h-28 w-28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 98L42 26H55L77 98" />
          <path d="M34 76H63" />
          <path d="M88 22V98" />
          <path d="M88 28C100 28 108 36 108 46C108 57 100 64 88 64" />
        </svg>
      </div>
      <div className="absolute bottom-4 right-4 hidden text-[#d8a3bb] lg:block">
        <svg viewBox="0 0 170 122" aria-hidden="true" className="h-24 w-32" fill="none">
          <path d="M18 48L84 18L150 48V96H18V48Z" fill="rgba(255,255,255,0.8)" stroke="currentColor" strokeWidth="2.2" />
          <path d="M18 48L84 80L150 48" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <circle cx="84" cy="64" r="8" fill="rgba(236,111,159,0.16)" stroke="currentColor" strokeWidth="2" />
          <path d="M84 72L84 96" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
      <Petal className="absolute left-[20%] top-[32%] hidden rotate-[14deg] text-[#f2abc4] lg:block" />
      <Petal className="absolute right-[18%] top-[24%] hidden -rotate-[12deg] text-[#f4c2d2] lg:block" />
      <Petal className="absolute right-[14%] bottom-[28%] hidden rotate-[18deg] text-[#f7adc8] lg:block" />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-5 text-center">
        <GenreDivider genre={THEME_KEY} variant="ornate" className="h-5 w-full max-w-[460px] text-[#e88aac]" />
        <h2 className="text-[clamp(2.2rem,4vw,4rem)] font-semibold tracking-[0.06em] text-[#4b365d]">
          准备进入这个故事了吗？
        </h2>
        <p className="max-w-3xl text-[1.05rem] leading-8 text-[#8a7896]">
          从第一章开始，逐步解锁角色关系、世界秘密与命运分支。
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <PastelButton variant="primary" icon={<Sparkle size="sm" />}>
            进入章节
          </PastelButton>
          <PastelButton variant="secondary" icon={<BookmarkIcon />}>
            查看大纲
          </PastelButton>
        </div>
      </div>
    </section>
  );
}

function TopNav() {
  return (
    <header className="sticky top-4 z-30 rounded-[32px] border border-[rgba(185,167,255,0.34)] bg-[rgba(255,255,255,0.8)] px-5 py-4 shadow-[0_18px_42px_rgba(214,182,226,0.12)] backdrop-blur-md sm:px-7">
      <div className="flex flex-wrap items-center gap-4 lg:flex-nowrap">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark />
          <div className="min-w-0">
            <p className="truncate text-[1.75rem] font-semibold tracking-[0.06em] text-[#6d4f89]">星页之约</p>
            <p className="text-sm text-[#9b88a5]">轻小说视觉系统</p>
          </div>
        </div>

        <nav className="order-3 flex w-full flex-wrap items-center justify-center gap-6 pt-1 text-[1.05rem] text-[#6d5a7a] lg:order-none lg:w-auto lg:flex-1 lg:justify-center lg:pt-0">
          {NAV_ITEMS.map((item, index) => (
            <a
              key={item}
              href="#"
              className={joinClasses(
                'relative px-1 pb-2 transition hover:text-[#ef7aa8]',
                index === 0 ? 'font-semibold text-[#ef7aa8]' : ''
              )}
            >
              {item}
              {index === 0 ? (
                <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[linear-gradient(90deg,#ff8db7,#f4ca6d)]" />
              ) : null}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-3 lg:ml-0">
          <label className="flex h-12 min-w-[240px] items-center gap-2 rounded-full border border-[rgba(209,175,236,0.38)] bg-[rgba(255,255,255,0.84)] px-4 text-[#aa98b5] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <input
              type="text"
              placeholder="搜索故事、角色..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#bba9c5]"
            />
            <SearchIcon />
          </label>
          <button
            type="button"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-[rgba(236,111,159,0.26)] bg-[rgba(255,255,255,0.84)] px-5 text-sm font-semibold text-[#8b698f] shadow-[0_10px_20px_rgba(236,111,159,0.08)]"
          >
            <Sparkle size="sm" className="text-[#f0a3b7]" />
            <span>收藏本作</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function PageDecorations() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_14%,rgba(255,214,231,0.34),transparent_22%),radial-gradient(circle_at_88%_14%,rgba(185,167,255,0.22),transparent_22%),radial-gradient(circle_at_78%_60%,rgba(159,201,255,0.16),transparent_18%),radial-gradient(circle_at_24%_72%,rgba(255,216,233,0.2),transparent_18%)]" />
      <Sparkle size="md" className="pointer-events-none fixed left-[6%] top-[14%] z-[1] hidden text-[#f4b8cf] lg:block" />
      <Sparkle size="sm" className="pointer-events-none fixed right-[9%] top-[22%] z-[1] hidden text-[#cbb6ff] lg:block" />
      <Sparkle size="sm" className="pointer-events-none fixed left-[10%] bottom-[20%] z-[1] hidden text-[#f6c76b] lg:block" />
      <Petal className="pointer-events-none fixed right-[10%] bottom-[16%] z-[1] hidden rotate-[22deg] text-[#f5a9c5] lg:block" />
      <Petal className="pointer-events-none fixed left-[14%] bottom-[34%] z-[1] hidden -rotate-[14deg] text-[#efbad2] lg:block" />
    </>
  );
}

export default function LightNovelShowcasePage() {
  const pageVars = getGenreCssVars(THEME_KEY);

  return (
    <div
      style={pageVars}
      className="min-h-screen bg-[linear-gradient(180deg,#fff7fb_0%,#fffaf2_42%,#f7f3ff_100%)] px-4 py-6 text-[#4b365d] sm:px-6 lg:px-8"
    >
      <PageDecorations />

      <div className="relative mx-auto flex w-full max-w-[var(--layout-max-width)] flex-col gap-5 pb-6">
        <TopNav />
        <HeroSection />
        <CharacterSection />
        <ChapterRibbonSection />
        <WorldMemoSection />
        <ReadingCta />
      </div>
    </div>
  );
}
