'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { TrainingRecord } from '@/utils/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Home() {
  const [tab, setTab] = useState<'checkin' | 'dashboard'>('checkin');
  
  // Check-in stavy
  const [feeling, setFeeling] = useState('Neutrální');
  const [rhr, setRhr] = useState('50');
  const [bodyBattery, setBodyBattery] = useState('80');
  const [sleep, setSleep] = useState('7.5');
  const [yesterdayActivity, setYesterdayActivity] = useState('Odpočinek / Nic');
  
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<{ text: string, score: number, targetStrain: number, sleepNeed: number } | null>(null);

  // Dashboard stavy
  const [history, setHistory] = useState<TrainingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggleExpand = (id: string | undefined) => {
    if (!id) return;
    setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  useEffect(() => {
    if (tab === 'dashboard') {
      loadHistory();
    }
  }, [tab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/history');
      const json = await res.json();
      if (json.data) {
        setHistory(json.data);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    }
    setLoadingHistory(false);
  };

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    if (!confirm('Opravdu chceš tento záznam smazat?')) return;
    
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setHistory(history.filter(r => r.id !== id));
      } else {
        alert('Smazání se nezdařilo.');
      }
    } catch (err) {
      alert('Došlo k chybě při mazání.');
    }
  };

  const parseChartData = () => {
    return history.map(r => {
      let recovery = 0, rhr = 0;
      
      const recMatch = r.activity.match(/Recovery: (\d+)%/);
      if(recMatch) recovery = parseInt(recMatch[1]);
      
      const rhrMatch = r.activity.match(/RHR: (\d+)/);
      if(rhrMatch) rhr = parseInt(rhrMatch[1]);
      
      const dateStr = new Date(r.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
      return { date: dateStr, recovery, rhr };
    }).reverse();
  };

  const getRecoveryColor = (score: number) => {
    if (score >= 67) return 'var(--accent-green)';
    if (score >= 34) return 'var(--accent-yellow)';
    return 'var(--accent-red)';
  };

  const handleGenerate = async () => {
    setLoading(true);
    setPlan(null);
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          feeling,
          rhr: parseInt(rhr) || 50,
          bodyBattery: parseInt(bodyBattery) || 80,
          sleep: parseFloat(sleep) || 8.0,
          yesterdayActivity
        })
      });
      const data = await res.json();
      if (data.plan) {
        setPlan({ 
          text: data.plan, 
          score: data.recoveryScore,
          targetStrain: data.targetStrain || 8.0,
          sleepNeed: data.sleepNeed || 8.0
        });
        if (data.saveError) {
          alert(`Doporučení bylo vygenerováno, ale uložení do databáze selhalo: ${data.saveError}`);
        }
      } else {
        alert(data.error || 'Chyba při generování doporučení.');
      }
    } catch (err: any) {
      alert(err.message || 'Došlo k chybě připojení.');
    } finally {
      setLoading(false);
    }
  };

  // SVG Kruh pro Recovery
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = plan ? circumference - (plan.score / 100) * circumference : circumference;

  return (
    <>
      <header className="header">
        <h1>AI Coach</h1>
      </header>

      <div className="tabs">
        <button 
          className={`tab-btn ${tab === 'checkin' ? 'active' : ''}`} 
          onClick={() => { setTab('checkin'); setPlan(null); }}
        >
          Dnešní Check-in
        </button>
        <button 
          className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} 
          onClick={() => setTab('dashboard')}
        >
          Deník & Trendy
        </button>
      </div>

      {tab === 'checkin' && (
        <>
          {!plan && !loading && (
            <div className="glass-card animate-fade-in">
              <div className="form-group">
                <label htmlFor="feeling">Jak se dnes cítíš? (Zánět)</label>
                <select id="feeling" value={feeling} onChange={(e) => setFeeling(e.target.value)}>
                  <option value="Skvěle (Bez zánětu)">Skvěle (Bez zánětu & energie)</option>
                  <option value="Neutrální (Bez bolesti)">Neutrální (Bez bolesti)</option>
                  <option value="Mírná únava / Tuhost">Mírná únava / Tuhost kloubů</option>
                  <option value="Cítím zánět / Bolest">Cítím zánět / Bolest kloubů</option>
                  <option value="Vyčerpání / Nemoc">Vyčerpání / Náběh na nemoc</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="yesterdayActivity">Včerejší aktivita</label>
                <select id="yesterdayActivity" value={yesterdayActivity} onChange={(e) => setYesterdayActivity(e.target.value)}>
                  <option value="Odpočinek / Volno">Odpočinek / Volno</option>
                  <option value="Kolo">Jízda na kole</option>
                  <option value="Běh">Běh</option>
                  <option value="Chůze / Hike">Chůze / Hike (Turistika)</option>
                  <option value="Lehké protažení / Mobilita">Lehké protažení / Mobilita</option>
                  <option value="Náročný den / Stres">Náročný den / Stres</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.2rem', alignItems: 'start' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="bodyBattery">Body Battery / HRV</label>
                  <input type="number" id="bodyBattery" value={bodyBattery} onChange={(e) => setBodyBattery(e.target.value)} placeholder="0-100" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="sleep">Spánek (hodin)</label>
                  <input type="number" id="sleep" step="0.1" value={sleep} onChange={(e) => setSleep(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="rhr">Klidový tep (RHR - bpm)</label>
                <input type="number" id="rhr" value={rhr} onChange={(e) => setRhr(e.target.value)} />
              </div>

              <button className="btn" onClick={handleGenerate} disabled={loading}>
                Spočítat Recovery
              </button>
            </div>
          )}

          {loading && (
            <div className="loader animate-fade-in">
              <div className="spinner"></div>
              <div>Analýza imunity, zánětu a WHOOP metrik...</div>
            </div>
          )}

          {plan && !loading && (
            <div className="glass-card animate-fade-in">
              {/* WHOOP 3-PILLARS VISUAL OVERVIEW */}
              <div className="recovery-container" style={{ paddingBottom: '1rem' }}>
                <div className={`inflammation-tag ${plan.score >= 67 ? 'healthy' : ''}`}>
                  {plan.score < 34 ? '⚠️ Riziko zánětu – Šetři tělo' : plan.score < 67 ? '🟡 Udržovací režim – Volný tempo' : '🟢 Výborná imunita – Plná regenerace'}
                </div>

                <div className="recovery-ring" style={{ width: '180px', height: '180px' }}>
                  <svg>
                    <circle cx="90" cy="90" r={radius} className="ring-bg" />
                    <circle 
                      cx="90" 
                      cy="90" 
                      r={radius} 
                      className="ring-progress" 
                      style={{ 
                        strokeDasharray: circumference, 
                        strokeDashoffset: strokeDashoffset,
                        stroke: getRecoveryColor(plan.score)
                      }} 
                    />
                  </svg>
                  <div className="ring-text">
                    <h2 style={{ color: getRecoveryColor(plan.score), fontSize: '2.5rem' }}>{plan.score}%</h2>
                    <p style={{ fontSize: '0.85rem' }}>Recovery</p>
                  </div>
                </div>

                {/* 3 WHOOP PILLARS GRID */}
                <div className="pillars-grid">
                  <div className="pillar-card recovery">
                    <div className="pillar-title">1. Regenerace</div>
                    <div className="pillar-value" style={{ color: getRecoveryColor(plan.score) }}>{plan.score}%</div>
                    <div className="pillar-subtitle">RHR: {rhr} bpm</div>
                  </div>

                  <div className="pillar-card strain">
                    <div className="pillar-title">2. Cílová Zátěž</div>
                    <div className="pillar-value" style={{ color: 'var(--accent-cyan)' }}>{plan.targetStrain}</div>
                    <div className="pillar-subtitle">Ze škály 0–21</div>
                    <div className="strain-bar-bg">
                      <div className="strain-bar-fill" style={{ width: `${(plan.targetStrain / 21) * 100}%` }}></div>
                    </div>
                  </div>

                  <div className="pillar-card sleep">
                    <div className="pillar-title">3. Spánek Dnes</div>
                    <div className="pillar-value" style={{ color: 'var(--accent-blue)' }}>{plan.sleepNeed}h</div>
                    <div className="pillar-subtitle">Cílový odpočinek</div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '1.5rem 0' }}></div>

              {/* AI Markdown Plan Content */}
              <div className="plan-content">
                <ReactMarkdown>{plan.text}</ReactMarkdown>
              </div>

              <button 
                onClick={() => setPlan(null)} 
                style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  color: 'white', 
                  width: '100%', 
                  padding: '0.8rem', 
                  borderRadius: '12px', 
                  marginTop: '1.5rem', 
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                ← Nový Check-in
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'dashboard' && (
        <div className="animate-fade-in">
          {loadingHistory ? (
            <div className="loader">
              <div className="spinner"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', opacity: 0.7 }}>
              <p>Zatím tu nemáš žádné záznamy.</p>
            </div>
          ) : (
            <>
              {/* CHARTS SECTION */}
              <div className="glass-card" style={{ padding: '1rem', marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'center' }}>Trend Regenerace (%)</h3>
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <LineChart data={parseChartData()} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} tickMargin={10} />
                      <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: 'white' }} />
                      <Line type="monotone" dataKey="recovery" stroke="var(--accent-green)" strokeWidth={3} dot={{ r: 4, fill: "var(--accent-green)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1rem', marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'center' }}>Klidová tepovka (RHR)</h3>
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <LineChart data={parseChartData()} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" fontSize={12} tickMargin={10} />
                      <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px', color: 'white' }} />
                      <Line type="monotone" name="RHR (bpm)" dataKey="rhr" stroke="var(--accent-red)" strokeWidth={3} dot={{ r: 4, fill: "var(--accent-red)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <h3 style={{ color: 'white', marginBottom: '1rem', marginLeft: '0.5rem' }}>Deník tréninků</h3>

              {history.map((record, index) => {
                const match = record.activity.match(/Recovery: (\d+)%/);
                const score = match ? parseInt(match[1]) : 0;
                const color = score > 0 ? getRecoveryColor(score) : 'var(--text-secondary)';

                return (
                  <div key={record.id || index} className="glass-card plan-content" style={{ padding: '1.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div>
                        <strong style={{ fontSize: '1.1rem', display: 'block' }}>{new Date(record.date).toLocaleDateString('cs-CZ')}</strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{record.feeling}</span>
                      </div>
                      {score > 0 && (
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '20px', border: `1px solid ${color}` }}>
                          <strong style={{ color: color, fontSize: '1.2rem' }}>{score}%</strong>
                        </div>
                      )}
                      <button 
                        onClick={() => handleDelete(record.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: '0.5rem', fontSize: '1.2rem' }}
                        title="Smazat záznam"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
                      {record.activity}
                    </div>
                    
                    <div style={{ 
                      maxHeight: expandedIds.includes(record.id || '') ? 'none' : '100px', 
                      overflow: 'hidden', 
                      position: 'relative' 
                    }}>
                      <ReactMarkdown>{record.ai_recommendation}</ReactMarkdown>
                      {!expandedIds.includes(record.id || '') && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(transparent, rgba(15, 20, 25, 0.9))' }}></div>
                      )}
                    </div>
                    <button 
                      onClick={() => toggleExpand(record.id)}
                      style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        color: 'var(--text-secondary)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        padding: '0.5rem 1rem', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        marginTop: '1rem', 
                        width: '100%',
                        transition: 'all 0.2s ease',
                        fontFamily: 'inherit',
                        fontSize: '0.9rem'
                      }}
                    >
                      {expandedIds.includes(record.id || '') ? 'Skrýt detail' : 'Zobrazit celý plán'}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </>
  );
}
