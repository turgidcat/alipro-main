import { useState } from 'react';
import { getApiBase } from '../lib/apiBase.js';
import './model-monitor-page.css';

const experiments = [
  ['01', '先确认采集连接', '打开观察台，确认顶部显示“客户端连接本地后端”，并有采集心跳。先生成一个书名或角色名字，看到真实输入、输出后再继续。'],
  ['02', '做一次单变量对比', '选同一章、同一模型和参数，生成一次作为A；只改一条要求后再生成B。在B的“前后对比”里选A，检查新增内容和输入字符变化。'],
  ['03', '追踪自动追加', '生成一章细纲或正文。展开该次操作，依次看初稿、审校、修稿。重点检查支线节点、出场角色、上一章结果是否进入对应请求，有没有反复追加无关全文。'],
  ['04', '把证据交给我修正', '在“我的判断”写下具体异常，复制诊断包或导出完整JSON。发给我“预期什么、实际什么”和对应记录；截图模式适合展示重点段落。']
];

export default function ModelMonitorPage() {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const desktop = Boolean(window.ide?.openModelMonitor);
  const local = window.ide?.experiment;
  async function open() {
    setOpening(true); setError('');
    try { await window.ide.openModelMonitor(); } catch (e) { setError(e.message); }
    finally { setOpening(false); }
  }
  return <section className="model-monitor-page">
    <span className="model-monitor-kicker">ALIPRO · 模型观察台 0.1.2</span>
    <h1>边创作，边看模型收到了什么</h1>
    <p className="model-monitor-intro">观察台在客户端内打开独立窗口。创作台继续操作，观察窗口同步查看完整输入、输出和自动修稿链。</p>
    <div className="model-monitor-connection">
      <strong>{local ? '当前：本地实验 · 作品副本' : '当前：' + (getApiBase().startsWith('http://127.0.0.1:') ? '本地后端' : '云端创作')}</strong>
      <code>{getApiBase()}</code>
      <p>{local ? '实验数据和采集记录保存在本机。生成会使用本地后端配置的模型，正常消耗模型额度。' : '本机观察台可查阅本地记录。云端后端尚未接入采集，云端生成不会出现在此观察台中。开发机可双击项目根目录 start-model-experiment.cmd 进入本地实验。'}</p>
    </div>
    {desktop ? <button className="model-monitor-open" onClick={open} disabled={opening}>{opening ? '正在打开…' : '打开观察窗口'} <small>Ctrl + Shift + M</small></button> : <p>此入口需要新版 Windows 客户端。</p>}
    {error && <p role="alert">{error}</p>}
    <h2>按这四步实验</h2>
    <div className="model-monitor-experiments">{experiments.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
    <p className="model-monitor-footnote">第一轮只做一章。输入变长不一定有问题，结合新增内容是否必要判断。已完成表示模型返回完成，是否采用修稿请结合创作台结果。</p>
  </section>;
}
