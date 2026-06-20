import BlockedConstraints from './BlockedConstraints.jsx';
import { hasText } from '../../lib/chapterPlan.js';

const insetTitleClass = 'font-serif text-[13px] font-semibold tracking-[0.04em] text-[color:var(--brand-deep)]';

function ReadinessPill({ kind, title, text }) {
  const toneClass = {
    success: 'text-[color:#2f6a46]',
    warning: 'text-[color:#8a5a1f]',
    error: 'text-[color:#a03a3a]'
  }[kind] || 'text-[color:var(--brand-deep)]';

  return (
    null
  );
}

function RiskReview({ items, hasCritical, generationRiskConfirmed, isGenerating, onGenerationRiskConfirm }) {
  if (!items.length) return null;

  return (
    <section className="space-y-4 border-b border-[color:color-mix(in_srgb,var(--line)_68%,transparent)] pb-5">
      <div className="border-l-2 border-[color:color-mix(in_srgb,var(--status-error-border)_82%,transparent)] pl-4">
        <p className={insetTitleClass}>高风险控制点</p>
        <p className="mt-2 text-[14px] leading-7 text-[color:var(--muted)]">这里只保留最容易带偏正文的风险项。</p>
      </div>

      <div className="divide-y divide-[color:color-mix(in_srgb,var(--line)_65%,transparent)]">
        {items.map((item, index) => (
          <article key={`${item.title}-${index}`} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong className="text-[15px] font-semibold text-[color:var(--text)]">{item.title}</strong>
              <em className="font-mono text-[11px] font-bold not-italic tracking-[0.08em] text-[color:var(--brand-deep)]">
                {item.level === 'critical' ? '高风险' : '提醒'}
              </em>
            </div>
            <p className="mt-2 text-[14px] leading-7 text-[color:var(--muted)]">{item.text}</p>
            <p className="mt-1 text-[13px] leading-6 text-[color:var(--brand-deep)]">{item.action}</p>
          </article>
        ))}
      </div>

      {hasCritical ? (
        <label className="flex items-start gap-3 border-l-2 border-[color:color-mix(in_srgb,var(--status-error-border)_72%,transparent)] pl-4">
          <input
            className="mt-1 accent-[var(--brand)]"
            type="checkbox"
            checked={generationRiskConfirmed}
            onChange={(event) => onGenerationRiskConfirm(event.target.checked)}
            disabled={isGenerating}
          />
          <span className="text-[14px] leading-7 text-[color:var(--muted)]">
            我确认：本章已放开高风险项，接受掌控度下降。
          </span>
        </label>
      ) : null}
    </section>
  );
}

function BriefColumn({ title, meta, children }) {
  return (
    <section className="space-y-3 border-l-2 border-[color:color-mix(in_srgb,var(--line-strong)_72%,transparent)] pl-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={insetTitleClass}>{title}</p>
        {meta ? <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-[color:var(--muted)]">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

export default function GenerationBanner(props) {
  const {
    chapterContext,
    constraintOverrides,
    generationRiskReview,
    generationReadiness,
    generationRequiredItems,
    generationRecommendedItems,
    generationRiskConfirmed,
    isGenerating,
    onSetConstraintOverride,
    onGenerationRiskConfirm
  } = props;

  const requiredReadyCount = generationRequiredItems.filter((item) => hasText(item.value)).length;
  const recommendedReadyCount = generationRecommendedItems.filter((item) => hasText(item.value)).length;

  return (
    <div className="space-y-6">
      <ReadinessPill
        kind={generationReadiness.kind}
        title={generationReadiness.title}
        text={generationReadiness.text}
      />

      <BlockedConstraints
        generationConstraints={chapterContext.generationConstraints}
        constraintOverrides={constraintOverrides}
        setConstraintOverride={onSetConstraintOverride}
      />

      <RiskReview
        items={generationRiskReview.items}
        hasCritical={generationRiskReview.hasCritical}
        generationRiskConfirmed={generationRiskConfirmed}
        isGenerating={isGenerating}
        onGenerationRiskConfirm={onGenerationRiskConfirm}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <BriefColumn title="计划引用" meta="跟随左栏">
        </BriefColumn>

        <BriefColumn title="必填信息" meta={`${requiredReadyCount}/${generationRequiredItems.length} 已就位`}>
          <div className="flex flex-wrap gap-2">
            {generationRequiredItems.map((item) => (
              <span
                key={item.key}
                className={
                  'inline-flex min-h-8 items-center rounded-full px-3 text-[12px] font-semibold ' +
                  (hasText(item.value)
                    ? 'bg-[color:rgba(219,240,224,0.8)] text-[color:#315e44]'
                    : 'bg-[color:rgba(247,232,204,0.78)] text-[color:#8a5a1f]')
                }
              >
                {item.label}：{hasText(item.value) ? '已填' : '未填'}
              </span>
            ))}
          </div>
        </BriefColumn>

        <BriefColumn title="建议补充" meta={`${recommendedReadyCount}/${generationRecommendedItems.length} 已补齐`}>
          <div className="flex flex-wrap gap-2">
            {generationRecommendedItems.map((item) => (
              <span
                key={item.key}
                className={
                  'inline-flex min-h-8 items-center rounded-full px-3 text-[12px] font-semibold ' +
                  (hasText(item.value)
                    ? 'bg-[color:rgba(219,240,224,0.8)] text-[color:#315e44]'
                    : 'bg-[color:rgba(243,237,225,0.76)] text-[color:var(--muted)]')
                }
              >
                {item.label}：{hasText(item.value) ? '已填' : '可补'}
              </span>
            ))}
          </div>
        </BriefColumn>
      </div>
    </div>
  );
}
