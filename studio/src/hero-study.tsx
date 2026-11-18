import { useState } from 'react';
import { Maximize2, Sparkles, X } from 'lucide-react';
import { Modal } from './ui';
import type { Lang } from './types';

const labels = {
  zh: {
    title: '三种参考，一个角色',
    pose: '姿势',
    costume: '服饰',
    character: '人物',
    result: '生成结果',
    example: '原项目生成示例',
    open: '放大查看',
    close: '关闭',
  },
  en: {
    title: 'Three references. One character.',
    pose: 'Pose',
    costume: 'Costume',
    character: 'Character',
    result: 'Generated result',
    example: 'Original project example',
    open: 'View larger',
    close: 'Close',
  },
};
type ImageKind = 'pose' | 'costume' | 'character' | 'result';

export function HeroStudy({ lang, onUse }: { lang: Lang; onUse?: () => void }) {
  const t = labels[lang];
  const [selected, setSelected] = useState<ImageKind | null>(null);
  const source = (kind: ImageKind) => `${import.meta.env.BASE_URL}images/hero/${kind}.webp`;
  return (
    <section className="hero-study" aria-label={t.title}>
      <div className="hero-study-heading">
        <span>{t.title}</span>
        <Sparkles size={14} />
      </div>
      {onUse && <button type="button" onClick={onUse}>{lang === 'zh' ? '使用这组三张参考图' : 'Use these three references'}</button>}
      <div className="hero-equation">
        <div className="hero-inputs">
          {(['pose', 'costume', 'character'] as const).map((kind, index) => (
            <div className="hero-input-group" key={kind}>
              {index > 0 && (
                <span className="hero-plus" aria-hidden="true">
                  +
                </span>
              )}
              <button
                type="button"
                className="hero-input"
                onClick={() => setSelected(kind)}
                aria-label={`${t.open}: ${t[kind]}`}
              >
                <img src={source(kind)} alt={t[kind]} width={60} height={72} />
                <span>
                  {t[kind]}
                  <small>{kind.toUpperCase()}</small>
                </span>
              </button>
            </div>
          ))}
        </div>
        <span className="hero-equals" aria-hidden="true">
          =
        </span>
        <button
          type="button"
          className="hero-result"
          onClick={() => setSelected('result')}
          aria-label={`${t.open}: ${t.result}`}
        >
          <img
            src={source('result')}
            alt={t.result}
            width={1024}
            height={1536}
            fetchPriority="high"
          />
          <span>
            <span>
              {t.result}
              <small>{t.example}</small>
            </span>
            <Maximize2 size={13} />
          </span>
        </button>
      </div>
      {selected && (
        <Modal onClose={() => setSelected(null)} label={t[selected]} className="hero-study-modal">
          <div className="panel-heading">
            <h2>{t[selected]}</h2>
            <button className="icon-button" onClick={() => setSelected(null)} aria-label={t.close}>
              <X size={21} />
            </button>
          </div>
          <img src={source(selected)} alt={t[selected]} />
        </Modal>
      )}
    </section>
  );
}
