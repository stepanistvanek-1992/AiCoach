'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { TrainingRecord } from '@/utils/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function Home() {
  const [tab, setTab] = useState<'checkin' | 'dashboard'>('dashboard');
  
  // Check-in stavy
  const [feeling, setFeeling] = useState('Neutrální');
  const [rhr, setRhr] = useState('50');
  const [bodyBattery, setBodyBattery] = useState('80');
  const [sleep, setSleep] = useState('7.5');
  const [yesterdayActivity, setYesterdayActivity] = useState('Odpočinek / Nic');
  
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<{ text: string, score: number } | null>(null);

  // Dashboard stavy
  const [history, setHistory] = useState<TrainingRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  const parseChartData = () => {
    return history.map(r => {
      let recovery = 0, rhr = 0, bb = 0, sleep = 0;
      
      const recMatch = r.activity.match(/Recovery: (\d+)%/);
      if(recMatch) recovery = parseInt(recMatch[1]);
      
      const rhrMatch = r.activity.match(/RHR: (\d+)/);
      if(rhrMatch) rhr = parseInt(rhrMatch[1]);
      
      const dateStr = new Date(r.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
      return { date: dateStr, recovery, rhr };
    }).reverse(); // Pro graf chceme nejstarší zleva doprava
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
        setPlan({ text: data.plan, score: data.recoveryScore });
      } else {
        alert(data.error || 'Chyba při generování plánu.');
      }
    } catch (err: any) {
      alert(err.message || 'Došlo k chybě připojení.');
    } finally {
      setLoading(false);
    }
  };

  // Vykreslení kruhu (SVG)
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = plan ? circumference - (plan.score / 100) * circumference : circumference;

  return (
    <>
      <header className="header">
        <h1>AI Coach</h1>
        <p>Optimalizace zátěže & ochrana imunity</p>
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
          Historie
        </button>
      </div>

      {tab === 'checkin' && (
        <>
          {!plan && !loading && (
            <div className="glass-card animate-fade-in">
              <div className="form-group">
                <label htmlFor="yesterdayActivity">Co jsi včera reálně odtrénoval?</label>
                <select id="yesterdayActivity" value={yesterdayActivity} onChange={(e) => setYesterdayActivity(e.target.value)}>
                  <option value="Odpočinek / Nic">Odpočinek / Nic</option>
                  <option value="Běh">Běh</option>
                  <option value="Kolo">Kolo</option>
                  <option value="Cvičení (Silový trénink)">Cvičení (Silový trénink)</option>
                  <option value="Chůze">Chůze</option>
                  <option value="Hike (Turistika)">Hike (Turistika)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="feeling">Jak se dnes ráno cítíš?</label>
                <select id="feeling" value={feeling} onChange={(e) => setFeeling(e.target.value)}>
                  <option value="Skvěle">Skvěle (100% regenerace)</option>
                  <option value="Neutrální">Neutrální (Běžná únava)</option>
                  <option value="Cítím zánět">Cítím zánět / Náběh na nemoc</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="bodyBattery">Body Battery</label>
                  <input type="number" id="bodyBattery" value={bodyBattery} onChange={(e) => setBodyBattery(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="sleep">Spánek (h)</label>
                  <input type="number" id="sleep" step="0.1" value={sleep} onChange={(e) => setSleep(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="rhr">Klidovka (RHR)</label>
                  <input type="number" id="rhr" value={rhr} onChange={(e) => setRhr(e.target.value)} />
                </div>
              </div>

              <button className="btn" onClick={handleGenerate} disabled={loading}>
                Analyzovat Recovery
              </button>
            </div>
          )}

          {loading && (
            <div className="loader animate-fade-in">
              <div className="spinner"></div>
              <div>Kalkuluji Whoop Recovery & AI doporučení...</div>
            </div>
          )}

          {plan && !loading && (
            <div className="glass-card animate-fade-in">
              {/* Whoop Recovery UI */}
              <div className="recovery-container">
                <div className="recovery-ring">
                  <svg>
                    <circle cx="100" cy="100" r={radius} className="ring-bg" />
                    <circle 
                      cx="100" 
                      cy="100" 
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
                    <h2 style={{ color: getRecoveryColor(plan.score) }}>{plan.score}%</h2>
                    <p>Recovery</p>
                  </div>
                </div>

                <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  <div className="metric-item">
                    <div className="metric-value">{bodyBattery}</div>
                    <div className="metric-label">B. Battery</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-value">{sleep}h</div>
                    <div className="metric-label">Spánek</div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '2rem 0' }}></div>

              {/* AI Markdown Plan */}
              <div className="plan-content">
                <ReactMarkdown>{plan.text}</ReactMarkdown>
              </div>
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
                    </div>
                    
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
                      {record.activity}
                    </div>
                    
                    <div style={{ maxHeight: '100px', overflow: 'hidden', position: 'relative' }}>
                      <ReactMarkdown>{record.ai_recommendation}</ReactMarkdown>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(transparent, rgba(15, 20, 25, 0.9))' }}></div>
                    </div>
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
